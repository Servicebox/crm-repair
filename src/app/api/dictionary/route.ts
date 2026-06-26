import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

const DictionarySchema = z.object({
  type: z.enum(['deviceType', 'condition', 'accessories', 'defect']),
  value: z.string().min(1).max(200),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Dictionary } } = auth

  const { searchParams } = req.nextUrl
  const type = searchParams.get('type')
  const q = searchParams.get('q')

  const filter: Record<string, unknown> = { isActive: true }
  if (type) filter.type = type
  if (q) filter.value = { $regex: q, $options: 'i' }

  const items = await Dictionary.find(filter)
    .sort({ sortOrder: 1, value: 1 })
    .lean()

  return ok(items)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Dictionary } } = auth

  const body = await req.json().catch(() => null)
  const parsed = DictionarySchema.safeParse(body)
  if (!parsed.success) return err('Некорректные данные', 400)

  const exists = await Dictionary.findOne({ type: parsed.data.type, value: parsed.data.value })
  if (exists) return err('Такое значение уже есть в словаре', 409)

  const item = await Dictionary.create(parsed.data)
  return ok(item, 201)
}
