import { NextRequest } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import { notifyStaff } from '@/lib/notify'
import { fireWebhook } from '@/lib/outboundWebhook'
import { ORDER_STATUSES } from '@/constants/orders'

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { models: { Order } } = authResult

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  const order = await Order.findById(params.id).lean()
  if (!order) return err('Заказ не найден', 404)
  return ok(order)
}

const UpdateStatusSchema = z.object({
  status: z.enum(['new', 'diagnostics', 'waiting_approval', 'waiting_parts', 'in_repair', 'quality_check', 'ready', 'issued', 'cancelled', 'client_declined']),
  comment: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'online', 'qr', 'invoice']).default('cash'),
})

const UpdateOrderSchema = z.object({
  // client fields
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  clientType: z.string().optional(),
  source: z.string().optional(),
  // device fields
  deviceType: z.string().optional(),
  deviceBrand: z.string().optional(),
  deviceModel: z.string().optional(),
  deviceColor: z.string().optional(),
  deviceSerial: z.string().optional(),
  deviceImei: z.string().optional(),
  devicePassword: z.string().optional(),
  deviceCondition: z.string().optional(),
  deviceAccessories: z.string().optional(),
  defectDescription: z.string().optional(),
  // staff & work
  masterId: z.string().optional(),
  masterName: z.string().optional(),
  masterComment: z.string().optional(),
  adminComment: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  // works and parts
  works: z.array(z.object({
    serviceId: z.string().optional(),
    name: z.string(),
    price: z.number(),
    discount: z.number().optional(),
    duration: z.number().optional(),
    cost: z.number().optional(),
    masterId: z.string().optional(),
    masterName: z.string().optional(),
  })).optional(),
  parts: z.array(z.object({
    productId: z.string().optional(),
    name: z.string(),
    quantity: z.number(),
    cost: z.number(),
    price: z.number(),
  })).optional(),
  payments: z.array(z.object({
    amount: z.number(),
    method: z.enum(['cash', 'card', 'transfer', 'online', 'qr', 'invoice']),
    date: z.string().or(z.date()),
    note: z.string().optional(),
  })).optional(),
  // financial
  finalCost: z.number().optional(),
  prepayment: z.number().optional(),
  discount: z.number().optional(),
  estimatedCost: z.number().optional(),
  // scheduling
  dueDate: z.string().optional(),
  warrantyDays: z.number().optional(),
  // status (handled separately but kept here for passthrough)
  status: z.string().optional(),
  statusComment: z.string().optional(),
  // other
  checklist: z.record(z.string()).optional(),
  customFields: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  photos: z.array(z.string()).optional(),
  deviceAtClient: z.boolean().optional(),
  approvalMessage: z.string().optional(),
  approvalStatus: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { session, models: { Order, Client, Transaction } } = authResult

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  try {
    const order = await Order.findById(params.id)
    if (!order) return err('Заказ не найден', 404)

    const body = await req.json()

    // Track changes for post-save notifications
    let statusChanged: string | null = null
    let masterChangedId: string | null = null

    if (body.status && body.status !== order.status) {
      const parsed = UpdateStatusSchema.parse({
        status: body.status,
        comment: body.statusComment,
        paymentMethod: body.paymentMethod,
      })
      statusChanged = parsed.status
      order.statusHistory.push({
        status: parsed.status,
        comment: parsed.comment,
        userId: session!.user.id as unknown as import('mongoose').Types.ObjectId,
        userName: session!.user.name ?? 'Пользователь',
        createdAt: new Date(),
      })
      order.status = parsed.status

      // Guard: only create transaction and set issuedAt once
      if (parsed.status === 'issued' && !order.issuedAt) {
        order.issuedAt = new Date()
        if (order.warrantyDays > 0) {
          order.warrantyExpires = new Date(Date.now() + order.warrantyDays * 24 * 60 * 60 * 1000)
        }
        await Client.findByIdAndUpdate(order.clientId, {
          $inc: { totalRevenue: order.finalCost },
        })
        if (order.finalCost > 0) {
          await Transaction.create({
            type: 'income',
            amount: order.finalCost,
            category: 'Ремонт',
            description: `Оплата заказа ${order.number}`,
            orderId: order._id,
            orderNumber: order.number,
            paymentMethod: parsed.paymentMethod,
            userId: session!.user.id,
            date: new Date(),
          })

          // autoReceipt: автоматическая фискализация при выдаче
          try {
            const { connectToDatabase } = await import('@/lib/mongodb')
            const Company = (await import('@/models/Company')).default
            await connectToDatabase()
            const company = await Company.findOne({ dbName: session!.user.dbName }).lean() as Record<string, unknown> | null
            const cashierSettings = company?.cashierSettings as Record<string, unknown> | undefined
            const globalCfg = cashierSettings?.global as Record<string, unknown> | undefined
            if (globalCfg?.autoReceipt) {
              const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
              await fetch(`${baseUrl}/api/v1/fiscal/receipt`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': process.env.API_SECRET_KEY ?? '',
                },
                body: JSON.stringify({
                  orderId: order._id.toString(),
                  orderNumber: order.number,
                  paymentMethod: parsed.paymentMethod,
                  total: order.finalCost,
                  clientEmail: order.clientEmail ?? undefined,
                  dbName: session!.user.dbName,
                }),
              })
            }
          } catch {
            // Фискализация не должна блокировать выдачу заказа
          }
        }
      }
    }

    const updates = UpdateOrderSchema.parse(body)
    const simpleStrings: Array<keyof typeof updates> = [
      'clientName', 'clientPhone', 'clientEmail', 'clientType', 'source',
      'deviceType', 'deviceBrand', 'deviceModel', 'deviceColor',
      'deviceSerial', 'deviceImei', 'devicePassword', 'deviceCondition', 'deviceAccessories',
      'defectDescription', 'masterName', 'masterComment', 'adminComment',
    ]
    for (const key of simpleStrings) {
      if (updates[key] !== undefined) (order as unknown as Record<string, unknown>)[key] = updates[key]
    }
    if (updates.masterId !== undefined) {
      const prevMasterId = order.masterId?.toString()
      order.masterId = updates.masterId as unknown as mongoose.Types.ObjectId
      if (updates.masterName) order.masterName = updates.masterName
      if (updates.masterId && updates.masterId !== prevMasterId) {
        masterChangedId = updates.masterId
      }
    }
    if (updates.priority !== undefined) order.priority = updates.priority
    if (updates.works !== undefined) order.works = updates.works as typeof order.works
    if (updates.parts !== undefined) order.parts = updates.parts as typeof order.parts
    if (updates.payments !== undefined) order.payments = updates.payments.map(p => ({ ...p, date: new Date(p.date) })) as typeof order.payments
    if (updates.finalCost !== undefined) order.finalCost = updates.finalCost
    if (updates.prepayment !== undefined) order.prepayment = updates.prepayment
    if (updates.discount !== undefined) order.discount = updates.discount
    if (updates.estimatedCost !== undefined) order.estimatedCost = updates.estimatedCost
    if (updates.dueDate) order.dueDate = new Date(updates.dueDate)
    if (updates.warrantyDays !== undefined) order.warrantyDays = updates.warrantyDays
    if (updates.checklist !== undefined) order.checklist = updates.checklist as Record<string, import('@/models/Order').ChecklistValue>
    if (updates.customFields !== undefined) order.customFields = updates.customFields
    if (updates.photos !== undefined) order.photos = updates.photos
    if (updates.deviceAtClient !== undefined) order.deviceAtClient = updates.deviceAtClient
    if (updates.approvalMessage !== undefined) order.approvalMessage = updates.approvalMessage
    if (updates.approvalStatus !== undefined) order.approvalStatus = updates.approvalStatus

    await order.save()

    // ── Post-save: Telegram notifications + outbound webhook ────────────────
    const companyId = session!.user.companyId
    const dbName = session!.user.dbName
    const device = [order.deviceType, order.deviceBrand, order.deviceModel].filter(Boolean).join(' ')

    if (statusChanged) {
      const statusLabel = ORDER_STATUSES.find(s => s.value === statusChanged)?.label ?? statusChanged

      if (statusChanged === 'ready') {
        notifyStaff(companyId, dbName, 'order_ready', {
          orderNumber: order.number,
          clientName: order.clientName,
          device,
        })
      } else {
        notifyStaff(companyId, dbName, 'order_status', {
          orderNumber: order.number,
          status: statusLabel,
        })
      }

      fireWebhook(companyId, 'order.status_changed', {
        orderNumber: order.number,
        status: statusChanged,
        statusLabel,
        clientName: order.clientName,
        device,
      })
    }

    if (masterChangedId) {
      notifyStaff(companyId, dbName, 'order_assigned', {
        orderNumber: order.number,
        clientName: order.clientName,
        device,
        defect: order.defectDescription?.slice(0, 80),
        targetUserId: masterChangedId,
      })
    }
    // ────────────────────────────────────────────────────────────────────────

    return ok(order)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка обновления заказа', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { models: { Order, Client, Transaction } } = authResult

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  const order = await Order.findByIdAndDelete(params.id)
  if (!order) return err('Заказ не найден', 404)

  // Cascade: remove transactions and restore client counters
  await Transaction.deleteMany({ orderId: order._id })
  if (order.clientId) {
    const revenueDecrement = order.status === 'issued' ? (order.finalCost ?? 0) : 0
    await Client.findByIdAndUpdate(order.clientId, {
      $inc: { totalOrders: -1, totalRevenue: -revenueDecrement },
    })
  }

  return ok({ deleted: true })
}
