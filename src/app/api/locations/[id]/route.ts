import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireRole, ok, err } from '@/lib/api-helpers'
import Location from '@/models/Location'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const body = await req.json()
  const location = await Location.findByIdAndUpdate(params.id, body, { new: true })
  if (!location) return err('Локация не найдена', 404)
  return ok(location)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  await Location.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
