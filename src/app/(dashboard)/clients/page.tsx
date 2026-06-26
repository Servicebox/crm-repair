'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, User, Phone, Mail, Loader2, X, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'

type ClientStatus = 'excellent' | 'good' | 'problematic' | 'blacklist'

interface Client {
  _id: string
  name: string
  phone?: string
  email?: string
  source?: string
  totalOrders: number
  totalRevenue: number
  lastOrderDate?: string
  tags: string[]
  discount: number
  status?: ClientStatus
  pendingDebt: number
  pendingOrdersCount: number
  createdAt: string
}

const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  excellent: 'Отличный',
  good: 'Хороший',
  problematic: 'Проблемный',
  blacklist: 'Чёрный список',
}

const CLIENT_STATUS_COLORS: Record<ClientStatus, string> = {
  excellent: 'bg-emerald-100 text-emerald-700',
  good: 'bg-blue-100 text-blue-700',
  problematic: 'bg-amber-100 text-amber-700',
  blacklist: 'bg-red-100 text-red-700',
}

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Все' },
  { value: 'excellent', label: 'Отличные' },
  { value: 'good', label: 'Хорошие' },
  { value: 'problematic', label: 'Проблемные' },
  { value: 'blacklist', label: 'Чёрный список' },
]

export default function ClientsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: '', notes: '' })
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/clients?${params}`)
      const json = await res.json()
      return json.data
    },
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ name: '', phone: '', email: '', source: '', notes: '' })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
    setCreating(false)
  }

  const clients: Client[] = data?.clients ?? []

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Клиенты</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Всего: {data?.total ?? 0}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Добавить клиента
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, email..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                statusFilter === f.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-transparent bg-accent hover:bg-accent/80 text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Клиентов не найдено</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <Link key={client._id} href={`/clients/${client._id}`}>
              <div className={`bg-card border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer ${client.status === 'blacklist' ? 'border-red-200' : ''}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${client.status === 'blacklist' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{client.name}</div>
                    {client.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="w-3 h-3" />
                        {client.phone}
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {client.email}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {client.status && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CLIENT_STATUS_COLORS[client.status]}`}>
                        {CLIENT_STATUS_LABELS[client.status]}
                      </span>
                    )}
                    {client.discount > 0 && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                        -{client.discount}%
                      </span>
                    )}
                  </div>
                </div>

                {client.pendingDebt > 0 && (
                  <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="text-xs text-amber-700 font-medium">
                      Долг: {formatCurrency(client.pendingDebt)}
                      {client.pendingOrdersCount > 1 && ` (${client.pendingOrdersCount} заказа)`}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-center border-t pt-3">
                  <div>
                    <div className="font-semibold">{client.totalOrders}</div>
                    <div className="text-xs text-muted-foreground">заказов</div>
                  </div>
                  <div>
                    <div className="font-semibold">{formatCurrency(client.totalRevenue)}</div>
                    <div className="text-xs text-muted-foreground">выручка</div>
                  </div>
                </div>
                {client.lastOrderDate && (
                  <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                    Последний заказ: {formatDate(client.lastOrderDate)}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Новый клиент</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-accent rounded-lg transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">ФИО <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Иванов Иван Иванович" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Телефон</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+7 999 ..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="client@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Заметки</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2} placeholder="Дополнительная информация..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition">
                  Отмена
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
