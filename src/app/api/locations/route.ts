import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, requireTenantRole, ok, err } from '@/lib/api-helpers'

const LocationSchema = z.object({
  name: z.string().min(1, 'Укажите название'),
  address: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export async function GET() {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Location } } = auth

  const locations = await Location.find({ isActive: true }).lean()
  return ok(locations)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Location } } = auth

  try {
    const body = await req.json()
    const data = LocationSchema.parse(body)
    const location = await Location.create(data)
    return ok(location, 201)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка создания локации', 500)
  }
}
