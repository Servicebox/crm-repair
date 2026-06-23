import { NextRequest } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Client from '@/models/Client'
import Order from '@/models/Order'

const UpdateClientSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  notes: z.string().optional(),
  discount: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
})

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  await connectToDatabase()
  const [client, orders] = await Promise.all([
    Client.findById(params.id).lean(),
    Order.find({ clientId: params.id }).sort({ createdAt: -1 }).lean(),
  ])
  if (!client) return err('Клиент не найден', 404)
  return ok({ client, orders })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  try {
    await connectToDatabase()
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
  const auth = await requireAuth()
  if (auth.error) return auth.error

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  await connectToDatabase()
  await Client.findByIdAndDelete(params.id)
  return ok({ deleted: true })
}
