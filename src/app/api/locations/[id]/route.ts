import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'

const UpdateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Location } } = auth

  try {
    const body = await req.json()
    const data = UpdateLocationSchema.parse(body)
    const location = await Location.findByIdAndUpdate(params.id, { $set: data }, { new: true })
    if (!location) return err('Локация не найдена', 404)
    return ok(location)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка обновления локации', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Location } } = auth

  await Location.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
