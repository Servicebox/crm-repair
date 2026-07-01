import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { getTenantConnection, getDefaultDbName } from '@/lib/tenantDb'
import { getModels } from '@/lib/models'
import Order from '@/models/Order'
import Company from '@/models/Company'
import { notifyStaff } from '@/lib/notify'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findOrderForUpdate(param: string) {
  await connectToDatabase()

  const isToken = UUID_RE.test(param)
  const query = isToken ? { trackToken: param } : { number: param }

  const tenantCompanies = await Company.find(
    { dbName: { $exists: true, $ne: getDefaultDbName() } },
    { dbName: 1 }
  ).lean() as { dbName?: string }[]

  // Search tenant DBs first — prevents number collisions with default DB
  for (const comp of tenantCompanies) {
    if (!comp.dbName) continue
    try {
      const conn = await getTenantConnection(comp.dbName)
      const { Order: TenantOrder } = getModels(conn)
      const order = await TenantOrder.findOne(query)
      if (order) return order
    } catch { continue }
  }

  return Order.findOne(query)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const { action, comment } = await req.json() as { action?: string; comment?: string }
    if (action !== 'approve' && action !== 'decline') {
      return NextResponse.json({ error: 'Неверное действие' }, { status: 400 })
    }

    const order = await findOrderForUpdate(params.number)

    if (!order) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
    }

    if (order.status !== 'waiting_approval') {
      return NextResponse.json({ error: 'Заказ не ожидает согласования' }, { status: 409 })
    }

    const newStatus = action === 'approve' ? 'in_repair' : 'client_declined'
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

    // Fire-and-forget notifications to owners/admins and assigned master
    if (order.companyId) {
      const company = await Company.findById(order.companyId).select('dbName').lean() as { dbName?: string } | null
      const dbName = company?.dbName ?? getDefaultDbName()
      const companyId = order.companyId.toString()
      const event = action === 'approve' ? 'client_approved' : 'client_rejected'
      const payload = {
        orderNumber: order.number as string,
        clientName: order.clientName as string,
        device: [order.deviceBrand, order.deviceModel].filter(Boolean).join(' ') || (order.deviceType as string),
      }
      notifyStaff(companyId, dbName, event, payload)
      if (order.masterId) {
        notifyStaff(companyId, dbName, event, { ...payload, targetUserId: order.masterId.toString() })
      }
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch {
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
