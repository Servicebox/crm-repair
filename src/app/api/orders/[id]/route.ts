import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Order from '@/models/Order'
import Client from '@/models/Client'
import Transaction from '@/models/Transaction'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  await connectToDatabase()
  const order = await Order.findById(params.id).lean()
  if (!order) return err('Заказ не найден', 404)
  return ok(order)
}

const UpdateStatusSchema = z.object({
  status: z.enum(['new', 'diagnostics', 'waiting_approval', 'waiting_parts', 'in_repair', 'quality_check', 'ready', 'issued', 'cancelled']),
  comment: z.string().optional(),
})

const UpdateOrderSchema = z.object({
  masterId: z.string().optional(),
  masterName: z.string().optional(),
  works: z.array(z.object({
    serviceId: z.string().optional(),
    name: z.string(),
    price: z.number(),
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
  finalCost: z.number().optional(),
  prepayment: z.number().optional(),
  discount: z.number().optional(),
  masterComment: z.string().optional(),
  adminComment: z.string().optional(),
  estimatedCost: z.number().optional(),
  dueDate: z.string().optional(),
  warrantyDays: z.number().optional(),
  status: z.string().optional(),
  statusComment: z.string().optional(),
  checklist: z.record(z.string()).optional(),
  devicePassword: z.string().optional(),
  deviceCondition: z.string().optional(),
  deviceAccessories: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error
  const { session } = authResult

  await connectToDatabase()
  const order = await Order.findById(params.id)
  if (!order) return err('Заказ не найден', 404)

  const body = await req.json()

  if (body.status && body.status !== order.status) {
    const parsed = UpdateStatusSchema.parse({ status: body.status, comment: body.statusComment })
    order.statusHistory.push({
      status: parsed.status,
      comment: parsed.comment,
      userId: session!.user.id as unknown as import('mongoose').Types.ObjectId,
      userName: session!.user.name ?? 'Пользователь',
      createdAt: new Date(),
    })
    order.status = parsed.status

    if (parsed.status === 'issued') {
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
          paymentMethod: 'cash',
          userId: session!.user.id,
          date: new Date(),
        })
      }
    }
  }

  const updates = UpdateOrderSchema.parse(body)
  Object.assign(order, {
    ...(updates.masterId !== undefined && { masterId: updates.masterId, masterName: updates.masterName }),
    ...(updates.works !== undefined && { works: updates.works }),
    ...(updates.parts !== undefined && { parts: updates.parts }),
    ...(updates.finalCost !== undefined && { finalCost: updates.finalCost }),
    ...(updates.prepayment !== undefined && { prepayment: updates.prepayment }),
    ...(updates.discount !== undefined && { discount: updates.discount }),
    ...(updates.masterComment !== undefined && { masterComment: updates.masterComment }),
    ...(updates.adminComment !== undefined && { adminComment: updates.adminComment }),
    ...(updates.estimatedCost !== undefined && { estimatedCost: updates.estimatedCost }),
    ...(updates.dueDate && { dueDate: new Date(updates.dueDate) }),
    ...(updates.warrantyDays !== undefined && { warrantyDays: updates.warrantyDays }),
    ...(updates.checklist !== undefined && { checklist: updates.checklist }),
    ...(updates.devicePassword !== undefined && { devicePassword: updates.devicePassword }),
    ...(updates.deviceCondition !== undefined && { deviceCondition: updates.deviceCondition }),
    ...(updates.deviceAccessories !== undefined && { deviceAccessories: updates.deviceAccessories }),
  })

  await order.save()
  return ok(order)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  await connectToDatabase()
  const order = await Order.findByIdAndDelete(params.id)
  if (!order) return err('Заказ не найден', 404)
  return ok({ deleted: true })
}
