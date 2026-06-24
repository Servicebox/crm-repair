import { NextRequest } from 'next/server'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Service } } = auth

  const body = await req.json()
  const service = await Service.findByIdAndUpdate(params.id, body, { new: true })
  if (!service) return err('Услуга не найдена', 404)
  return ok(service)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Service } } = auth

  await Service.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
