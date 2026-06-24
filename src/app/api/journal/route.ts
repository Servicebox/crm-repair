import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

const AuditLogSchema = z.object({
  type: z.string().min(1),
  action: z.string().min(1),
  description: z.string().min(1),
  userId: z.string().optional(),
  userName: z.string().optional(),
  ip: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { models: { AuditLog } } = authResult

  const { searchParams } = req.nextUrl
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '15')
  const search = searchParams.get('search')
  const type = searchParams.get('type')
  const action = searchParams.get('action')

  const filter: Record<string, unknown> = {}
  if (type) filter.type = type
  if (action) filter.action = action
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { description: { $regex: escaped, $options: 'i' } },
      { userName: { $regex: escaped, $options: 'i' } },
    ]
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ])

  return ok({ logs, total, page, limit, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { models: { AuditLog } } = authResult

  try {
    const body = await req.json()
    const data = AuditLogSchema.parse(body)
    const log = await AuditLog.create(data)
    return ok(log, 201)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка создания записи', 500)
  }
}
