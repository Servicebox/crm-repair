import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Order from '@/models/Order'

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const { action } = await req.json() as { action?: string }
    if (action !== 'approve' && action !== 'decline') {
      return NextResponse.json({ error: 'Неверное действие' }, { status: 400 })
    }

    await connectToDatabase()
    const order = await Order.findOne({ number: params.number })

    if (!order) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
    }

    if (order.status !== 'waiting_approval') {
      return NextResponse.json({ error: 'Заказ не ожидает согласования' }, { status: 409 })
    }

    const newStatus = action === 'approve' ? 'in_repair' : 'cancelled'
    const comment =
      action === 'approve'
        ? 'Клиент согласовал ремонт через форму отслеживания'
        : 'Клиент отказался от ремонта через форму отслеживания'

    order.status = newStatus
    order.statusHistory.push({
      status: newStatus,
      comment,
      userId: order.createdBy,
      userName: 'Клиент',
      createdAt: new Date(),
    })
    await order.save()

    return NextResponse.json({ success: true, status: newStatus })
  } catch {
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
