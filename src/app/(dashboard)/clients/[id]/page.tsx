'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, User, Phone, Mail, Edit2, Save, X,
  ClipboardList, Loader2, Tag, AlertCircle, Trash2,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

type ClientStatus = 'excellent' | 'good' | 'problematic' | 'blacklist'

interface Client {
  _id: string
  name: string
  phone?: string
  email?: string
  source?: string
  notes?: string
  discount: number
  tags: string[]
  status?: ClientStatus
  createdAt: string
}

interface Order {
  _id: string
  number: string
  clientName: string
  deviceType: string
  status: string
  finalCost: number
  createdAt: string
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  in_repair: 'В работе',
  waiting_parts: 'Ожидает запчасти',
  ready: 'Готов',
  issued: 'Выдан',
  cancelled: 'Отказ',
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  in_repair: 'bg-amber-100 text-amber-700',
  waiting_parts: 'bg-purple-100 text-purple-700',
  ready: 'bg-green-100 text-green-700',
  issued: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
}

const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  excellent: 'Отличный',
  good: 'Хороший',
  problematic: 'Проблемный',
  blacklist: 'Чёрный список',
}

const CLIENT_STATUS_COLORS: Record<ClientStatus, string> = {
  excellent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  good: 'bg-blue-100 text-blue-700 border-blue-200',
  problematic: 'bg-amber-100 text-amber-700 border-amber-200',
  blacklist: 'bg-red-100 text-red-700 border-red-200',
}

function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  )
}

type EditForm = {
  name: string
  phone: string
  email: string
  discount: string
  notes: string
  status: ClientStatus | ''
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [form, setForm] = useState<EditForm>({ name: '', phone: '', email: '', discount: '', notes: '', status: '' })
  const nameRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}`)
      const json = await res.json()
      return json.data as { client: Client; orders: Order[]; pendingDebt: number; pendingOrdersCount: number }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      router.push('/clients')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<EditForm>) => {
      const body: Record<string, unknown> = {
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        discount: payload.discount !== undefined ? Number(payload.discount) : undefined,
        notes: payload.notes,
      }
      if (payload.status !== undefined) {
        body.status = payload.status === '' ? null : payload.status
      }
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setEditing(false)
    },
  })

  function startEditing() {
    if (!data?.client) return
    const c = data.client
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      discount: String(c.discount ?? 0),
      notes: c.notes ?? '',
      status: c.status ?? '',
    })
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  useEffect(() => {
    if (editing) {
      nameRef.current?.focus()
    }
  }, [editing])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!data?.client) {
    return (
      <div className="p-6 text-muted-foreground">Клиент не найден</div>
    )
  }

  const { client, orders, pendingDebt, pendingOrdersCount } = data

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-20">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/clients"
          className="p-1.5 hover:bg-accent rounded-lg transition"
          aria-label="Назад к клиентам"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{client.name}</h1>
            {client.status && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${CLIENT_STATUS_COLORS[client.status]}`}>
                {CLIENT_STATUS_LABELS[client.status]}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Клиент с {formatDate(client.createdAt)}
          </p>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-accent transition"
            >
              <Edit2 className="w-4 h-4" />
              Редактировать
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Pending debt alert */}
      {pendingDebt > 0 && (
        <div className="flex items-start gap-2.5 mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Неоплаченные заказы</div>
            <div className="text-sm text-amber-700 mt-0.5">
              {pendingOrdersCount} {pendingOrdersCount === 1 ? 'заказ готов' : 'заказа готовы'} к выдаче —
              сумма к оплате: <span className="font-semibold">{formatCurrency(pendingDebt)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: client info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${client.status === 'blacklist' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{client.name}</div>
                {client.source && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Источник: {client.source}
                  </div>
                )}
              </div>
            </div>

            {!editing ? (
              <div className="space-y-2.5 text-sm">
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>{client.email}</span>
                  </div>
                )}
                {client.discount > 0 && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>Скидка: <span className="font-medium text-orange-600">{client.discount}%</span></span>
                  </div>
                )}
                {client.tags && client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {client.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {client.notes && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Заметки</div>
                    <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                  </div>
                )}
                {!client.phone && !client.email && !client.notes && (
                  <p className="text-muted-foreground italic text-xs">Дополнительные данные не указаны</p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    ФИО <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      ref={nameRef}
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      required
                      className="flex-1 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Телефон</label>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      className="flex-1 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+7 999 ..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="flex-1 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="client@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Скидка (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.discount}
                    onChange={e => setForm(p => ({ ...p, discount: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Статус клиента</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value as ClientStatus | '' }))}
                    className="w-full px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                  >
                    <option value="">— не задан —</option>
                    <option value="excellent">Отличный</option>
                    <option value="good">Хороший</option>
                    <option value="problematic">Проблемный</option>
                    <option value="blacklist">Чёрный список</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Заметки</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Дополнительная информация..."
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border rounded-lg text-sm hover:bg-accent transition"
                  >
                    <X className="w-4 h-4" />
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
                  >
                    {updateMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    Сохранить
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right: order history */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-xl p-4">
            <h2 className="flex items-center gap-2 font-semibold mb-4 text-sm">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              История заказов
              {orders.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {orders.length}
                </span>
              )}
            </h2>

            {orders.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-25" />
                <p className="text-sm">Заказов ещё нет</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left pb-2 font-medium pr-4">Номер</th>
                      <th className="text-left pb-2 font-medium pr-4">Устройство</th>
                      <th className="text-left pb-2 font-medium pr-4">Статус</th>
                      <th className="text-right pb-2 font-medium pr-4">Сумма</th>
                      <th className="text-right pb-2 font-medium">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map(order => (
                      <tr key={order._id} className={`hover:bg-accent/40 transition-colors ${order.status === 'ready' ? 'bg-amber-50/50' : ''}`}>
                        <td className="py-2.5 pr-4">
                          <Link
                            href={`/orders/${order._id}`}
                            className="font-mono text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {order.number}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {order.deviceType || '—'}
                        </td>
                        <td className="py-2.5 pr-4">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="py-2.5 pr-4 text-right font-medium">
                          {order.finalCost > 0 ? formatCurrency(order.finalCost) : '—'}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground whitespace-nowrap">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-semibold">Удалить клиента?</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {client.name} будет удалён без возможности восстановления
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition"
              >
                Отмена
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
