import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Service from '@/models/Service'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  const body = await req.json()
  const service = await Service.findByIdAndUpdate(params.id, body, { new: true })
  if (!service) return err('Услуга не найдена', 404)
  return ok(service)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  await Service.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
