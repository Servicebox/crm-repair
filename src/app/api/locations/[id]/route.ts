import { NextRequest } from 'next/server'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Location } } = auth

  const body = await req.json()
  const location = await Location.findByIdAndUpdate(params.id, body, { new: true })
  if (!location) return err('Локация не найдена', 404)
  return ok(location)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Location } } = auth

  await Location.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
