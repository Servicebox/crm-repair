import { Wrench, CheckCircle, Clock, Package, AlertCircle, Star } from 'lucide-react'
import { connectToDatabase } from '@/lib/mongodb'
import { getTenantConnection, getDefaultDbName } from '@/lib/tenantDb'
import { getModels } from '@/lib/models'
import Order from '@/models/Order'
import Company from '@/models/Company'
import ApprovalButtons from '@/components/track/ApprovalButtons'

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

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  new: Clock,
  diagnostics: Wrench,
  waiting_approval: AlertCircle,
  waiting_parts: Package,
  in_repair: Wrench,
  quality_check: CheckCircle,
  ready: CheckCircle,
  issued: CheckCircle,
  cancelled: AlertCircle,
}

const STATUS_COLORS: Record<string, string> = {
  new: 'text-slate-500',
  diagnostics: 'text-purple-500',
  waiting_approval: 'text-yellow-500',
  waiting_parts: 'text-orange-500',
  in_repair: 'text-blue-500',
  quality_check: 'text-indigo-500',
  ready: 'text-green-600',
  issued: 'text-emerald-600',
  cancelled: 'text-red-500',
}

// Defined order of statuses for the progress timeline
const STATUS_FLOW = ['new', 'diagnostics', 'waiting_approval', 'in_repair', 'quality_check', 'ready', 'issued']

async function findOrderAcrossDbs(number: string) {
  // 1. Try default DB first
  await connectToDatabase()
  const defaultOrder = await Order.findOne({ number }).lean()
  if (defaultOrder) {
    const company = defaultOrder.companyId
      ? await Company.findById(defaultOrder.companyId).lean()
      : await Company.findOne().lean()
    return { order: defaultOrder, company }
  }

  // 2. Search all tenant DBs
  const companies = await Company.find(
    { dbName: { $exists: true, $ne: getDefaultDbName() } },
    { dbName: 1, name: 1, phone: 1, address: 1, logo: 1, reviewUrl: 1 }
  ).lean() as Array<{ _id: unknown; dbName?: string; name?: string; phone?: string; address?: string; logo?: string; reviewUrl?: string }>

  for (const comp of companies) {
    if (!comp.dbName) continue
    try {
      const conn = await getTenantConnection(comp.dbName)
      const { Order: TenantOrder } = getModels(conn)
      const found = await TenantOrder.findOne({ number }).lean()
      if (found) return { order: found, company: comp }
    } catch { continue }
  }
  return null
}

async function getOrder(number: string) {
  try {
    const result = await findOrderAcrossDbs(decodeURIComponent(number))
    if (!result) return null
    const { order, company } = result
    return {
      number: order.number,
      status: order.status as string,
      statusLabel: STATUS_LABELS[order.status] ?? order.status,
      deviceType: order.deviceType,
      deviceModel: order.deviceModel,
      deviceBrand: order.deviceBrand,
      defectDescription: order.defectDescription,
      masterComment: order.masterComment,
      photos: order.photos ?? [],
      approvalMessage: order.approvalMessage,
      approvalStatus: order.approvalStatus,
      clientApprovalComment: order.clientApprovalComment,
      estimatedCost: order.estimatedCost,
      finalCost: order.finalCost,
      dueDate: order.dueDate ? order.dueDate.toISOString() : null,
      issuedAt: order.issuedAt ? order.issuedAt.toISOString() : null,
      warrantyExpires: order.warrantyExpires ? order.warrantyExpires.toISOString() : null,
      history: (order.statusHistory ?? []).map(h => ({
        status: h.status as string,
        statusLabel: STATUS_LABELS[h.status] ?? h.status,
        comment: h.comment,
        date: h.createdAt instanceof Date ? h.createdAt.toISOString() : String(h.createdAt),
      })),
      company: company
        ? {
            name: company.name,
            phone: company.phone,
            address: company.address,
            logo: company.logo,
            reviewUrl: company.reviewUrl,
          }
        : null,
    }
  } catch {
    return null
  }
}

export default async function TrackPage({ params }: { params: { number: string } }) {
  const order = await getOrder(params.number)

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800">Заказ не найден</h1>
          <p className="text-slate-500 mt-2">Проверьте номер заказа и попробуйте снова.</p>
        </div>
      </div>
    )
  }

  const StatusIcon = STATUS_ICONS[order.status] ?? Clock
  const statusColor = STATUS_COLORS[order.status] ?? 'text-slate-500'
  const isCancelled = order.status === 'cancelled'
  const isIssued = order.status === 'issued'

  // Build timeline from statusHistory (unique statuses in flow order)
  const seenStatuses = new Set((order.history ?? []).map(h => h.status))
  seenStatuses.add(order.status)

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Company header */}
        {order.company && (
          <div className="text-center mb-6 pt-4">
            {order.company.logo && (
              <img src={order.company.logo} alt={order.company.name} className="h-10 mx-auto mb-2 object-contain" />
            )}
            <h2 className="font-bold text-slate-800">{order.company.name}</h2>
            {order.company.phone && <p className="text-sm text-slate-500">{order.company.phone}</p>}
            {order.company.address && <p className="text-sm text-slate-500">{order.company.address}</p>}
          </div>
        )}

        {/* Status progress bar */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl shadow p-4 mb-4">
            <div className="text-xs font-medium text-slate-500 mb-3">Ход ремонта</div>
            <div className="flex items-center gap-0">
              {STATUS_FLOW.map((s, i) => {
                const done = seenStatuses.has(s)
                const active = order.status === s
                const Icon = STATUS_ICONS[s] ?? Clock
                return (
                  <div key={s} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                        active ? 'border-blue-500 bg-blue-500 text-white' :
                        done ? 'border-green-500 bg-green-500 text-white' :
                        'border-slate-200 bg-white text-slate-300'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className={`text-[9px] mt-1 text-center leading-tight max-w-[48px] ${
                        active ? 'text-blue-600 font-semibold' :
                        done ? 'text-green-600' : 'text-slate-400'
                      }`}>
                        {STATUS_LABELS[s]?.split(' ')[0]}
                      </span>
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-0.5 mb-4 ${done && !active ? 'bg-green-400' : 'bg-slate-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Main order card */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 ${
              isCancelled ? 'bg-red-50' : isIssued ? 'bg-green-50' : 'bg-blue-50'
            }`}>
              <StatusIcon className={`w-8 h-8 ${statusColor}`} />
            </div>
            <div className="text-sm text-slate-500 mb-1">Заказ № {order.number}</div>
            <div className={`text-2xl font-bold ${statusColor}`}>{order.statusLabel}</div>
          </div>

          <div className="space-y-3 text-sm border-t pt-4">
            <div className="flex justify-between">
              <span className="text-slate-500">Устройство</span>
              <span className="font-medium text-right">{[order.deviceBrand, order.deviceModel || order.deviceType].filter(Boolean).join(' ')}</span>
            </div>
            {order.defectDescription && (
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">Неисправность</span>
                <span className="font-medium text-right">{order.defectDescription}</span>
              </div>
            )}
            {order.estimatedCost != null && order.estimatedCost > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Стоимость ремонта</span>
                <span className="font-medium">{order.estimatedCost.toLocaleString('ru-RU')} ₽</span>
              </div>
            )}
            {order.dueDate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Срок готовности</span>
                <span className="font-medium">{new Date(order.dueDate).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
            {order.issuedAt && (
              <div className="flex justify-between">
                <span className="text-slate-500">Выдан</span>
                <span className="font-medium">{new Date(order.issuedAt).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
            {order.warrantyExpires && (
              <div className="flex justify-between">
                <span className="text-slate-500">Гарантия до</span>
                <span className="font-medium text-green-600">{new Date(order.warrantyExpires).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
          </div>

          {order.masterComment && (
            <div className="mt-4 p-3 bg-blue-50 rounded-xl text-sm">
              <div className="font-medium text-blue-700 mb-1">Комментарий мастера</div>
              <div className="text-blue-600">{order.masterComment}</div>
            </div>
          )}

          {/* Approval info */}
          {order.approvalMessage && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
              <div className="font-medium text-amber-700 mb-1">Результат диагностики</div>
              <div className="text-amber-700">{order.approvalMessage}</div>
              {order.approvalStatus && (
                <div className={`mt-2 text-xs font-medium px-2 py-0.5 rounded-full inline-block ${
                  order.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' :
                  order.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {order.approvalStatus === 'approved' ? '✓ Вы согласовали ремонт' :
                   order.approvalStatus === 'rejected' ? '✗ Вы отказались от ремонта' :
                   '⏳ Ожидает вашего решения'}
                </div>
              )}
              {order.clientApprovalComment && (
                <div className="mt-2 text-xs text-slate-600">
                  <span className="font-medium">Ваш комментарий:</span> {order.clientApprovalComment}
                </div>
              )}
            </div>
          )}

          {/* Photos */}
          {order.photos && order.photos.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-slate-700 mb-2">Фото устройства</div>
              <div className="grid grid-cols-3 gap-2">
                {order.photos.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Фото ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border hover:opacity-80 transition" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Approval buttons — only when waiting for client decision and not yet decided */}
        {order.status === 'waiting_approval' && !['approved', 'rejected'].includes(order.approvalStatus ?? '') && (
          <div className="mb-4">
            <ApprovalButtons
              orderNumber={order.number}
              estimatedCost={order.estimatedCost}
              approvalMessage={order.approvalMessage}
            />
          </div>
        )}

        {/* Review QR — only on issued orders */}
        {isIssued && order.company?.reviewUrl && (
          <div className="bg-white rounded-2xl shadow p-5 mb-4 text-center">
            <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <div className="font-semibold text-slate-800 mb-1">Понравился сервис?</div>
            <div className="text-sm text-slate-500 mb-3">Оставьте отзыв — это очень важно для нас</div>
            <a
              href={order.company.reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold px-5 py-2.5 rounded-xl text-sm transition"
            >
              Оставить отзыв
            </a>
          </div>
        )}

        {/* Status history */}
        {order.history && order.history.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-6 mb-4">
            <h3 className="font-semibold mb-4 text-sm text-slate-700">История статусов</h3>
            <div className="space-y-3">
              {[...order.history].reverse().map((h: { status: string; statusLabel: string; comment?: string; date: string }, i: number) => {
                const Icon = STATUS_ICONS[h.status] ?? Clock
                const color = STATUS_COLORS[h.status] ?? 'text-slate-500'
                const isLatest = i === 0
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        isLatest ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                      }`}>
                        <Icon className={`w-4 h-4 ${isLatest ? 'text-blue-600' : 'text-slate-400'}`} />
                      </div>
                      {i < order.history.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                    </div>
                    <div className="pb-3 flex-1">
                      <div className={`font-medium text-sm ${isLatest ? color : 'text-slate-600'}`}>
                        {h.statusLabel}
                      </div>
                      {h.comment && <div className="text-xs text-slate-500 mt-0.5">{h.comment}</div>}
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(h.date).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-2 pb-6">
          Powered by ServiceBox CRM
        </p>
      </div>
    </div>
  )
}
