import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Order from '@/models/Order'

export async function GET(
  _request: NextRequest,
  { params }: { params: { number: string } }
) {
  await connectToDatabase()

  const order = await Order.findOne(
    { number: params.number },
    'number status clientName deviceType deviceBrand deviceModel dueDate createdAt'
  ).lean()

  if (!order) {
    return NextResponse.json({ success: false, error: 'Заказ не найден' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: order })
}
