import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Order from '@/models/Order'

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const { action, comment } = await req.json() as { action?: string; comment?: string }
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
    const approvalStatus = action === 'approve' ? 'approved' : 'rejected'
    const historyComment = action === 'approve'
      ? `Клиент согласовал ремонт${comment ? `: «${comment}»` : ''}`
      : `Клиент отказался от ремонта${comment ? `: «${comment}»` : ''}`

    order.status = newStatus
    order.approvalStatus = approvalStatus
    if (comment) order.clientApprovalComment = comment
    order.statusHistory.push({
      status: newStatus,
      comment: historyComment,
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
