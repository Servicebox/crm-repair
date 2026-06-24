import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Order from '@/models/Order'
import Client from '@/models/Client'
import Company from '@/models/Company'
import Notification from '@/models/Notification'
import AuditLog from '@/models/AuditLog'

const CreateOrderSchema = z.object({
  type: z.enum(['repair', 'service']).default('repair'),
  clientId: z.string().optional(),
  clientName: z.string().min(1, 'Укажите клиента'),
  clientPhone: z.string().optional(),
  clientEmail: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  deviceType: z.string().min(1, 'Укажите тип устройства'),
  deviceBrand: z.string().optional(),
  deviceModel: z.string().optional(),
  deviceColor: z.string().optional(),
  deviceSerial: z.string().optional(),
  deviceImei: z.string().optional(),
  devicePassword: z.string().optional(),
  deviceCondition: z.string().optional(),
  deviceAccessories: z.string().optional(),
  defectDescription: z.string().min(1, 'Опишите неисправность'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  clientType: z.enum(['b2c', 'b2b', 'individual', 'ip', 'company']).default('individual'),
  masterId: z.string().optional(),
  masterName: z.string().optional(),
  locationId: z.string().optional(),
  checklist: z.record(z.string(), z.enum(['ok', 'defect', 'na'])).optional(),
  customChecklistItems: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  dueDate: z.string().optional(),
  warrantyDays: z.number().default(30),
  estimatedCost: z.number().optional(),
  prepayment: z.number().default(0),
  prepaymentReceived: z.boolean().optional(),
  prepaymentMethod: z.string().optional(),
  discount: z.number().default(0),
  adminComment: z.string().optional(),
  customFields: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  acceptedAt: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  await connectToDatabase()

  const { searchParams } = req.nextUrl
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const masterId = searchParams.get('masterId')
  const locationId = searchParams.get('locationId')
  const type = searchParams.get('type')

  const filter: Record<string, unknown> = {}
  if (status && status !== 'all') filter.status = status
  if (masterId) filter.masterId = masterId
  if (locationId) filter.locationId = locationId
  if (type) filter.type = type
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { number: { $regex: escaped, $options: 'i' } },
      { clientName: { $regex: escaped, $options: 'i' } },
      { clientPhone: { $regex: escaped, $options: 'i' } },
      { deviceModel: { $regex: escaped, $options: 'i' } },
      { deviceImei: { $regex: escaped, $options: 'i' } },
    ]
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ])

  return ok({ orders, total, page, limit, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error
  const { session } = authResult

  try {
    const body = await req.json()
    const data = CreateOrderSchema.parse(body)

    await connectToDatabase()

    const company = await Company.findOneAndUpdate(
      {},
      { $inc: { orderCounter: 1 } },
      { new: true }
    )
    if (!company) return err('Компания не настроена', 500)

    const number = `${company.orderPrefix}-${String(company.orderCounter).padStart(6, '0')}`

    let clientId = data.clientId
    if (!clientId) {
      let client = await Client.findOne({ phone: data.clientPhone || undefined, name: data.clientName })
      if (!client) {
        client = await Client.create({
          name: data.clientName,
          phone: data.clientPhone,
          email: data.clientEmail,
          source: data.source,
        })
      }
      clientId = client._id.toString()
    }

    const order = await Order.create({
      number,
      type: data.type,
      clientId,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      clientEmail: data.clientEmail,
      source: data.source,
      deviceType: data.deviceType,
      deviceBrand: data.deviceBrand,
      deviceModel: data.deviceModel,
      deviceColor: data.deviceColor,
      deviceSerial: data.deviceSerial,
      deviceImei: data.deviceImei,
      devicePassword: data.devicePassword,
      deviceCondition: data.deviceCondition,
      deviceAccessories: data.deviceAccessories,
      defectDescription: data.defectDescription,
      priority: data.priority,
      clientType: data.clientType,
      masterId: data.masterId,
      masterName: data.masterName,
      locationId: data.locationId,
      checklist: data.checklist ?? {},
      customChecklistItems: data.customChecklistItems ?? [],
      customFields: data.customFields ?? [],
      dueDate: data.dueDate ? new Date(data.dueDate) : (() => {
        const d = new Date(); d.setDate(d.getDate() + 4); return d
      })(),
      warrantyDays: data.warrantyDays ?? company.defaultWarrantyDays,
      estimatedCost: data.estimatedCost,
      prepayment: data.prepayment ?? 0,
      prepaymentReceived: data.prepaymentReceived ?? false,
      prepaymentMethod: data.prepaymentMethod,
      discount: data.discount ?? 0,
      adminComment: data.adminComment,
      receivedByName: session!.user.name ?? 'Система',
      receivedById: session!.user.id,
      acceptedAt: data.acceptedAt ? new Date(data.acceptedAt) : new Date(),
      createdBy: session!.user.id,
      statusHistory: [
        {
          status: 'new',
          userId: session!.user.id,
          userName: session!.user.name ?? 'Система',
          createdAt: new Date(),
        },
      ],
    })

    await Client.findByIdAndUpdate(clientId, {
      $inc: { totalOrders: 1 },
      $set: { lastOrderDate: new Date() },
    })

    await Notification.create({
      type: 'order_new',
      title: `Новый заказ ${number}`,
      body: `${data.clientName} — ${data.deviceType}${data.deviceBrand ? ` ${data.deviceBrand}` : ''}${data.deviceModel ? ` ${data.deviceModel}` : ''}`,
      link: `/orders/${order._id.toString()}`,
      orderId: order._id,
      orderNumber: number,
    })

    try {
      await AuditLog.create({
        type: 'order',
        action: 'create',
        description: `Создан заказ ${number} — ${data.deviceType}${data.deviceBrand ? ` ${data.deviceBrand}` : ''}${data.deviceModel ? ` ${data.deviceModel}` : ''}, ${data.defectDescription.slice(0, 60)}`,
        userId: session!.user.id,
        userName: session!.user.name ?? 'Система',
        ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
      })
    } catch {
      // audit log is non-critical, don't fail the request
    }

    return ok(order, 201)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка создания заказа', 500)
  }
}
