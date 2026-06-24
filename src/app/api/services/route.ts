import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok } from '@/lib/api-helpers'

const ServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  deviceTypes: z.array(z.string()).default([]),
  price: z.number().default(0),
  cost: z.number().default(0),
  warrantyDays: z.number().default(30),
})

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Service } } = auth

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')
  const deviceType = searchParams.get('deviceType')

  const filter: Record<string, unknown> = { isActive: true }
  if (search) filter.name = { $regex: search, $options: 'i' }
  if (deviceType) filter.$or = [{ deviceTypes: { $size: 0 } }, { deviceTypes: deviceType }]

  const services = await Service.find(filter).sort({ category: 1, name: 1 }).lean()
  return ok(services)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Service } } = auth

  const body = await req.json()
  const data = ServiceSchema.parse(body)
  const service = await Service.create(data)
  return ok(service, 201)
}
