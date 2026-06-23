import { Wrench, CheckCircle, Clock, Package, AlertCircle } from 'lucide-react'
import ApprovalButtons from '@/components/track/ApprovalButtons'

async function getOrder(number: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'https://koznova.site'
    const res = await fetch(`${baseUrl}/api/tracking/${number}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
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

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Company header */}
        {order.company && (
          <div className="text-center mb-6 pt-4">
            <h2 className="font-bold text-slate-800">{order.company.name}</h2>
            {order.company.phone && <p className="text-sm text-slate-500">{order.company.phone}</p>}
            {order.company.address && <p className="text-sm text-slate-500">{order.company.address}</p>}
          </div>
        )}

        {/* Order card */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-3">
              <StatusIcon className={`w-8 h-8 ${statusColor}`} />
            </div>
            <div className="text-sm text-slate-500 mb-1">Заказ № {order.number}</div>
            <div className={`text-2xl font-bold ${statusColor}`}>{order.statusLabel}</div>
          </div>

          <div className="space-y-3 text-sm border-t pt-4">
            <div className="flex justify-between">
              <span className="text-slate-500">Устройство</span>
              <span className="font-medium">{order.deviceBrand} {order.deviceModel || order.deviceType}</span>
            </div>
            {order.defectDescription && (
              <div className="flex justify-between">
                <span className="text-slate-500">Неисправность</span>
                <span className="font-medium max-w-[55%] text-right">{order.defectDescription}</span>
              </div>
            )}
            {order.estimatedCost && (
              <div className="flex justify-between">
                <span className="text-slate-500">Стоимость</span>
                <span className="font-medium">{order.estimatedCost.toLocaleString('ru-RU')} ₽</span>
              </div>
            )}
            {order.dueDate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Срок готовности</span>
                <span className="font-medium">{new Date(order.dueDate).toLocaleDateString('ru-RU')}</span>
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
        </div>

        {/* Approval buttons when waiting for client decision */}
        {order.status === 'waiting_approval' && (
          <div className="mb-4">
            <ApprovalButtons orderNumber={order.number} estimatedCost={order.estimatedCost} />
          </div>
        )}

        {/* History */}
        {order.history && order.history.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h3 className="font-semibold mb-4">История статусов</h3>
            <div className="space-y-3">
              {order.history.map((h: { status: string; statusLabel: string; comment?: string; date: string }, i: number) => {
                const Icon = STATUS_ICONS[h.status] ?? Clock
                const color = STATUS_COLORS[h.status] ?? 'text-slate-500'
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${i === order.history.length - 1 ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                        <Icon className={`w-4 h-4 ${i === order.history.length - 1 ? 'text-blue-600' : 'text-slate-400'}`} />
                      </div>
                      {i < order.history.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                    </div>
                    <div className="pb-3 flex-1">
                      <div className={`font-medium text-sm ${i === order.history.length - 1 ? color : 'text-slate-600'}`}>
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

        <p className="text-center text-xs text-slate-400 mt-6 pb-4">
          Powered by ServiceBox CRM
        </p>
      </div>
    </div>
  )
}
