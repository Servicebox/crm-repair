import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Order from '@/models/Order'
import Company from '@/models/Company'

const STATUS_LABELS: Record<string, string> = {
  new: 'Принят',
  diagnostics: 'Диагностика',
  waiting_approval: 'Ожидает согласования',
  waiting_parts: 'Ожидает запчасти',
  in_repair: 'В ремонте',
  quality_check: 'Проверка качества',
  ready: 'Готов к выдаче',
  issued: 'Выдан',
  cancelled: 'Отменён',
}

export async function GET(_req: NextRequest, { params }: { params: { number: string } }) {
  await connectToDatabase()

  const order = await Order.findOne({ number: params.number }).lean()
  if (!order) {
    return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  }

  const company = await Company.findOne().lean()

  return NextResponse.json({
    number: order.number,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] ?? order.status,
    deviceType: order.deviceType,
    deviceModel: order.deviceModel,
    deviceBrand: order.deviceBrand,
    defectDescription: order.defectDescription,
    masterComment: order.masterComment,
    estimatedCost: order.estimatedCost,
    dueDate: order.dueDate,
    issuedAt: order.issuedAt,
    warrantyExpires: order.warrantyExpires,
    history: order.statusHistory.map(h => ({
      status: h.status,
      statusLabel: STATUS_LABELS[h.status] ?? h.status,
      comment: h.comment,
      date: h.createdAt,
    })),
    company: company
      ? { name: company.name, phone: company.phone, address: company.address }
      : null,
  })
}
