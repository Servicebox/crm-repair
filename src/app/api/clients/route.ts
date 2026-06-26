import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

const ClientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  notes: z.string().optional(),
  discount: z.number().default(0),
  tags: z.array(z.string()).default([]),
  status: z.enum(['excellent', 'good', 'problematic', 'blacklist']).optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Client, Order } } = auth

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')
  const statusFilter = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))

  const filter: Record<string, unknown> = {}
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ]
  }
  if (statusFilter && ['excellent', 'good', 'problematic', 'blacklist'].includes(statusFilter)) {
    filter.status = statusFilter
  }

  const skip = (page - 1) * limit

  const [clients, total] = await Promise.all([
    Client.find(filter).sort({ lastOrderDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Client.countDocuments(filter),
  ])

  // Compute pending debt (ready but not issued orders) for each client
  const clientIds = clients.map(c => c._id)
  const debtAgg = await Order.aggregate([
    { $match: { clientId: { $in: clientIds }, status: 'ready' } },
    { $group: { _id: '$clientId', debt: { $sum: '$finalCost' }, count: { $sum: 1 } } },
  ])
  const debtMap = new Map(
    debtAgg.map(d => [d._id.toString(), { debt: d.debt as number, count: d.count as number }])
  )

  const enriched = clients.map(c => ({
    ...c,
    pendingDebt: debtMap.get(String(c._id))?.debt ?? 0,
    pendingOrdersCount: debtMap.get(String(c._id))?.count ?? 0,
  }))

  return ok({ clients: enriched, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Client } } = auth

  try {
    const body = await req.json()
    const data = ClientSchema.parse(body)
    const client = await Client.create(data)
    return ok(client, 201)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка создания клиента', 500)
  }
}
