import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, apiUnauthorized } from '@/lib/apiAuth'
import { connectToDatabase } from '@/lib/mongodb'
import Order from '@/models/Order'

export async function GET(
  request: NextRequest,
  { params }: { params: { number: string } }
) {
  if (!validateApiKey(request)) return apiUnauthorized()

  await connectToDatabase()

  const order = await Order.findOne({ number: params.number }, '-adminComment -__v').lean()
  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: order })
}
