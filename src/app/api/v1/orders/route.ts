import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, apiUnauthorized } from '@/lib/apiAuth'
import { connectToDatabase } from '@/lib/mongodb'
import Order from '@/models/Order'

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return apiUnauthorized()

  await connectToDatabase()

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)
  const page = Number(searchParams.get('page') ?? 1)
  const clientPhone = searchParams.get('clientPhone')

  const query: Record<string, unknown> = {}
  if (status) query.status = status
  if (clientPhone) query.clientPhone = clientPhone

  const total = await Order.countDocuments(query)
  const orders = await Order.find(query, '-adminComment -__v')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  return NextResponse.json({ success: true, data: orders, meta: { total, page, limit } })
}
