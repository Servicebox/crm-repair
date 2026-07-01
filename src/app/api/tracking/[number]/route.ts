import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { getTenantConnection, getDefaultDbName } from '@/lib/tenantDb'
import { getModels } from '@/lib/models'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = Record<string, any>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findOrderAcrossDbsLean(param: string): Promise<{ order: AnyDoc; company: AnyDoc | null } | null> {
  await connectToDatabase()

  const isToken = UUID_RE.test(param)
  const query = isToken ? { trackToken: param } : { number: param }
  const defaultDbName = getDefaultDbName()

  const tenantCompanies = await Company.find(
    { dbName: { $exists: true, $ne: defaultDbName } },
    { dbName: 1, name: 1, phone: 1, address: 1 }
  ).lean() as AnyDoc[]

  // Tenant DBs first to avoid number collisions with default DB
  for (const comp of tenantCompanies) {
    if (!comp.dbName) continue
    try {
      const conn = await getTenantConnection(comp.dbName)
      const { Order: TenantOrder } = getModels(conn)
      const found = await TenantOrder.findOne(query).lean() as AnyDoc | null
      if (found) return { order: found, company: comp }
    } catch { continue }
  }

  const defaultOrder = await Order.findOne(query).lean() as AnyDoc | null
  if (defaultOrder) {
    const company = defaultOrder.companyId
      ? await Company.findById(defaultOrder.companyId).lean() as AnyDoc | null
      : await Company.findOne().lean() as AnyDoc | null
    return { order: defaultOrder, company }
  }

  return null
}

export async function GET(_req: NextRequest, { params }: { params: { number: string } }) {
  const result = await findOrderAcrossDbsLean(params.number)
  if (!result) {
    return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  }

  const { order, company } = result

  return NextResponse.json({
    number: order.number,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] ?? order.status,
    deviceType: order.deviceType,
    deviceModel: order.deviceModel,
    deviceBrand: order.deviceBrand,
    defectDescription: order.defectDescription,
    masterComment: order.masterComment,
    photos: order.photos ?? [],
    approvalMessage: order.approvalMessage,
    approvalStatus: order.approvalStatus,
    estimatedCost: order.estimatedCost,
    dueDate: order.dueDate,
    issuedAt: order.issuedAt,
    warrantyExpires: order.warrantyExpires,
    history: (order.statusHistory ?? []).map((h: AnyDoc) => ({
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
