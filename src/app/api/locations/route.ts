import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, requireRole, ok, err } from '@/lib/api-helpers'
import Location from '@/models/Location'

const LocationSchema = z.object({
  name: z.string().min(1, 'Укажите название'),
  address: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  const locations = await Location.find({ isActive: true }).lean()
  return ok(locations)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  try {
    const body = await req.json()
    const data = LocationSchema.parse(body)
    await connectToDatabase()
    const location = await Location.create(data)
    return ok(location, 201)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка создания локации', 500)
  }
}
