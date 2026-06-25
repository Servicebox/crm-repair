import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'

const UpdateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  deviceTypes: z.array(z.string()).optional(),
  price: z.number().optional(),
  cost: z.number().optional(),
  warrantyDays: z.number().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Service } } = auth

  try {
    const body = await req.json()
    const data = UpdateServiceSchema.parse(body)
    const service = await Service.findByIdAndUpdate(params.id, { $set: data }, { new: true })
    if (!service) return err('Услуга не найдена', 404)
    return ok(service)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка обновления услуги', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Service } } = auth

  await Service.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
