import { NextRequest } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

const UpdateClientSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  notes: z.string().optional(),
  discount: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['excellent', 'good', 'problematic', 'blacklist']).nullable().optional(),
})

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Client, Order } } = auth

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  const oid = new mongoose.Types.ObjectId(params.id)
  const [client, orders] = await Promise.all([
    Client.findById(params.id).lean(),
    Order.find({ clientId: oid }).sort({ createdAt: -1 }).lean(),
  ])
  if (!client) return err('Клиент не найден', 404)

  const pendingOrders = (orders as unknown as Array<{ status: string; finalCost: number }>)
    .filter(o => o.status === 'ready')
  const pendingDebt = pendingOrders.reduce((s, o) => s + (o.finalCost ?? 0), 0)

  return ok({ client, orders, pendingDebt, pendingOrdersCount: pendingOrders.length })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Client } } = auth

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  try {
    const body = await req.json()
    const data = UpdateClientSchema.parse(body)
    const client = await Client.findByIdAndUpdate(params.id, data, { new: true })
    if (!client) return err('Клиент не найден', 404)
    return ok(client)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка обновления клиента', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Client } } = auth

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  await Client.findByIdAndDelete(params.id)
  return ok({ deleted: true })
}
