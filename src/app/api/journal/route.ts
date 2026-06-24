import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok } from '@/lib/api-helpers'
import AuditLog from '@/models/AuditLog'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  await connectToDatabase()

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
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  await connectToDatabase()
  const body = await req.json() as Record<string, unknown>

  const log = await AuditLog.create(body)
  return ok(log, 201)
}
