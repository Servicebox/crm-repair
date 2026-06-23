import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Client from '@/models/Client'

const ClientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  notes: z.string().optional(),
  discount: z.number().default(0),
  tags: z.array(z.string()).default([]),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '30')

  const filter: Record<string, unknown> = {}
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ]
  }

  const [clients, total] = await Promise.all([
    Client.find(filter).sort({ lastOrderDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Client.countDocuments(filter),
  ])

  return ok({ clients, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const body = await req.json()
  const data = ClientSchema.parse(body)

  await connectToDatabase()
  const client = await Client.create(data)
  return ok(client, 201)
}
