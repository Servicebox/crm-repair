'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Printer, Edit2, Plus, Trash2, Loader2, Clock, User, Smartphone, Wrench, DollarSign, CheckSquare } from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/components/orders/OrderBadge'
import { formatDateTime, formatDate, formatCurrency } from '@/lib/utils'
import { ORDER_STATUSES } from '@/constants/orders'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editStatus, setEditStatus] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusComment, setStatusComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${id}`)
      const json = await res.json()
      return json.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      setEditStatus(false)
      setStatusComment('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => router.push('/orders'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!data) return <div className="p-6">Заказ не найден</div>

  const order = data

  function handleStatusChange() {
    if (!newStatus) return
    updateMutation.mutate({ status: newStatus, statusComment })
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="p-2 hover:bg-accent rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-mono">{order.number}</h1>
              <StatusBadge status={order.status} />
              <PriorityBadge priority={order.priority} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Создан {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/orders/${id}/print`} className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-accent transition">
            <Printer className="w-4 h-4" />
            Печать
          </Link>
          <button
            onClick={() => { if (confirm('Удалить заказ?')) deleteMutation.mutate() }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Client */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
              <User className="w-4 h-4 text-blue-500" />
              Клиент
            </h3>
            <div className="space-y-1 text-sm">
              <div><span className="text-muted-foreground">Имя:</span> <span className="font-medium">{order.clientName}</span></div>
              {order.clientPhone && <div><span className="text-muted-foreground">Телефон:</span> <a href={`tel:${order.clientPhone}`} className="text-blue-600 hover:underline">{order.clientPhone}</a></div>}
              {order.clientEmail && <div><span className="text-muted-foreground">Email:</span> {order.clientEmail}</div>}
              {order.source && <div><span className="text-muted-foreground">Источник:</span> {order.source}</div>}
            </div>
          </div>

          {/* Device */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
              <Smartphone className="w-4 h-4 text-blue-500" />
              Устройство
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Тип:</span> {order.deviceType}</div>
              {order.deviceBrand && <div><span className="text-muted-foreground">Бренд:</span> {order.deviceBrand}</div>}
              {order.deviceModel && <div><span className="text-muted-foreground">Модель:</span> {order.deviceModel}</div>}
              {order.deviceColor && <div><span className="text-muted-foreground">Цвет:</span> {order.deviceColor}</div>}
              {order.deviceImei && <div><span className="text-muted-foreground">IMEI:</span> <span className="font-mono">{order.deviceImei}</span></div>}
              {order.deviceSerial && <div><span className="text-muted-foreground">S/N:</span> <span className="font-mono">{order.deviceSerial}</span></div>}
              {order.devicePassword && <div><span className="text-muted-foreground">Пароль:</span> <span className="font-mono">{order.devicePassword}</span></div>}
            </div>
            {order.deviceCondition && (
              <div className="mt-2 text-sm"><span className="text-muted-foreground">Состояние:</span> {order.deviceCondition}</div>
            )}
            {order.deviceAccessories && (
              <div className="mt-1 text-sm"><span className="text-muted-foreground">Комплектация:</span> {order.deviceAccessories}</div>
            )}
          </div>

          {/* Defect */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
              <Wrench className="w-4 h-4 text-blue-500" />
              Неисправность и работы
            </h3>
            <p className="text-sm mb-3">{order.defectDescription}</p>

            {/* Works */}
            {order.works && order.works.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">Выполненные работы</div>
                {order.works.map((w: { name: string; price: number }, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{w.name}</span>
                    <span className="font-medium">{formatCurrency(w.price)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Parts */}
            {order.parts && order.parts.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">Запчасти</div>
                {order.parts.map((p: { name: string; quantity: number; price: number }, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{p.name} × {p.quantity}</span>
                    <span className="font-medium">{formatCurrency(p.price * p.quantity)}</span>
                  </div>
                ))}
              </div>
            )}

            {order.masterComment && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                <div className="text-xs font-medium text-blue-600 mb-1">Комментарий мастера</div>
                {order.masterComment}
              </div>
            )}
          </div>

          {/* Checklist */}
          {order.checklist && Object.keys(order.checklist).length > 0 && (
            <div className="bg-card border rounded-xl p-4">
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
                <CheckSquare className="w-4 h-4 text-blue-500" />
                Акт осмотра при приёмке
              </h3>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {Object.entries(order.checklist).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 py-1">
                    <span className={val === 'ok' ? 'text-green-600' : val === 'defect' ? 'text-red-600' : 'text-slate-400'}>
                      {val === 'ok' ? '✓' : val === 'defect' ? '✗' : 'Н/П'}
                    </span>
                    <span className="text-muted-foreground">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status history */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
              <Clock className="w-4 h-4 text-blue-500" />
              История статусов
            </h3>
            <div className="space-y-3">
              {order.statusHistory?.map((h: { status: string; comment?: string; userName: string; createdAt: string }, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    {i < order.statusHistory.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-3 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={h.status} />
                      <span className="text-xs text-muted-foreground">{h.userName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(h.createdAt)}</span>
                    </div>
                    {h.comment && <p className="text-sm text-muted-foreground mt-1">{h.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Status change */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">Изменить статус</h3>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background mb-2"
            >
              <option value="">Выберите статус</option>
              {ORDER_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <textarea
              value={statusComment}
              onChange={e => setStatusComment(e.target.value)}
              placeholder="Комментарий..."
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              rows={2}
            />
            <button
              onClick={handleStatusChange}
              disabled={!newStatus || updateMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2 rounded-lg transition flex items-center justify-center gap-2"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Обновить статус
            </button>
          </div>

          {/* Finance */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
              <DollarSign className="w-4 h-4 text-blue-500" />
              Финансы
            </h3>
            <div className="space-y-2 text-sm">
              {order.estimatedCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Смета:</span>
                  <span>{formatCurrency(order.estimatedCost)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Итого:</span>
                <span className="font-semibold text-lg">{formatCurrency(order.finalCost)}</span>
              </div>
              {order.prepayment > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Предоплата:</span>
                  <span className="text-green-600">{formatCurrency(order.prepayment)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Скидка:</span>
                  <span className="text-orange-600">{formatCurrency(order.discount)}</span>
                </div>
              )}
              {order.prepayment > 0 && (
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>К доплате:</span>
                  <span>{formatCurrency(Math.max(0, order.finalCost - order.prepayment))}</span>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">Детали</h3>
            <div className="space-y-2 text-sm">
              {order.masterName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Мастер:</span>
                  <span>{order.masterName}</span>
                </div>
              )}
              {order.dueDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Срок:</span>
                  <span>{formatDate(order.dueDate)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Гарантия:</span>
                <span>{order.warrantyDays} дн.</span>
              </div>
              {order.warrantyExpires && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Истекает:</span>
                  <span>{formatDate(order.warrantyExpires)}</span>
                </div>
              )}
              {order.issuedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Выдан:</span>
                  <span>{formatDateTime(order.issuedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Track link */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold mb-1 text-sm text-blue-800">Ссылка для клиента</h3>
            <p className="text-xs text-blue-600 mb-2">Клиент может отследить статус заказа:</p>
            <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs font-mono break-all text-blue-700">
              {typeof window !== 'undefined' ? window.location.origin : ''}/track/{order.number}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
