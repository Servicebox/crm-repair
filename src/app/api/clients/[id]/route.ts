import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Client from '@/models/Client'
import Order from '@/models/Order'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

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

  await connectToDatabase()
  const body = await req.json()
  const client = await Client.findByIdAndUpdate(params.id, body, { new: true })
  if (!client) return err('Клиент не найден', 404)
  return ok(client)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  await Client.findByIdAndDelete(params.id)
  return ok({ deleted: true })
}
