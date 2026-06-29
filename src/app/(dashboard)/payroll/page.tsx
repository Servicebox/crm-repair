'use client'
import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  DollarSign, RefreshCw, Loader2, X, ChevronRight,
  CheckCircle, Clock, Plus, Trash2, ExternalLink,
  TrendingUp, ClipboardList, Banknote, Users, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { SOURCE_LABELS, METHOD_LABELS, type RuleResult } from '@/lib/salary'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  _id: string
  name: string
  email: string
  role: string
  isActive: boolean
  salary?: {
    type?: string
    value?: number
    hourlyRate?: number
    guaranteed?: number
    rules?: unknown[]
  }
}

interface PayrollAdjustment {
  _id: string
  amount: number
  reason: string
  addedAt: string
}

interface PayrollRecord {
  _id: string
  userId: string
  month: string
  ordersCount: number
  worksCount: number
  revenue: number
  profit: number
  hoursWorked: number
  shiftsCount: number
  accrued: number
  paid: number
  paidAt?: string
  status: 'pending' | 'paid'
  notes?: string
  bonuses: PayrollAdjustment[]
  deductions: PayrollAdjustment[]
  breakdown?: RuleResult[]
}

interface OrderRow {
  _id: string
  number: string
  clientName: string
  deviceBrand?: string
  deviceModel?: string
  works: { name: string; price: number }[]
  parts: { name: string; price: number; quantity: number }[]
  finalCost: number
  createdAt: string
  status: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(month: string): { dateFrom: string; dateTo: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(last).padStart(2, '0')}`,
  }
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
}

function salarySchemeLabel(salary?: Employee['salary']): string {
  if (!salary) return '—'
  if (Array.isArray(salary.rules) && salary.rules.length > 0)
    return `Гибкая (${salary.rules.length} прав.)`
  if (!salary.type) return '—'
  if (salary.type === 'hourly') return `${salary.hourlyRate ?? salary.value} ₽/ч`
  if (salary.type.includes('percent')) return `${salary.value}% ${salary.type === 'percent_revenue' ? 'выручки' : 'прибыли'}`
  if (salary.type === 'rate_per_order') return `${salary.value} ₽/заказ`
  return `${salary.value} ₽ оклад`
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  manager: 'Менеджер',
  master: 'Мастер',
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  employee,
  record,
  month,
  onClose,
  onRecalc,
  onPayout,
  recalcPending,
}: {
  employee: Employee
  record: PayrollRecord | undefined
  month: string
  onClose: () => void
  onRecalc: () => void
  onPayout: (amount: number, notes: string) => void
  recalcPending: boolean
}) {
  const queryClient = useQueryClient()
  const [adjType, setAdjType] = useState<'bonus' | 'deduction'>('bonus')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [adjError, setAdjError] = useState('')
  const [payoutAmount, setPayoutAmount] = useState(record?.accrued ?? 0)
  const [payoutNotes, setPayoutNotes] = useState('')
  const [showPayout, setShowPayout] = useState(false)

  const { dateFrom, dateTo } = monthRange(month)

  const { data: orders = [], isFetching: ordersFetching } = useQuery<OrderRow[]>({
    queryKey: ['payroll-orders', employee._id, month],
    queryFn: async () => {
      const params = new URLSearchParams({
        masterId: employee._id,
        status: 'issued',
        dateFrom,
        dateTo,
        limit: '100',
      })
      const res = await fetch(`/api/orders?${params}`)
      const json = await res.json()
      return (json.data?.orders ?? json.data ?? []) as OrderRow[]
    },
  })

  const addAdjMutation = useMutation({
    mutationFn: async () => {
      if (!record) throw new Error('Нет записи начислений')
      const amount = parseFloat(adjAmount)
      if (!amount || amount <= 0) throw new Error('Введите сумму')
      if (!adjReason.trim()) throw new Error('Введите причину')
      const res = await fetch(`/api/payroll/${record._id}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: adjType, amount, reason: adjReason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', month] })
      setAdjAmount('')
      setAdjReason('')
      setAdjError('')
    },
    onError: (e: Error) => setAdjError(e.message),
  })

  const removeAdjMutation = useMutation({
    mutationFn: async ({ type, adjustmentId }: { type: 'bonus' | 'deduction'; adjustmentId: string }) => {
      if (!record) throw new Error('Нет записи')
      const res = await fetch(`/api/payroll/${record._id}/adjustments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, adjustmentId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      return json
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', month] }),
  })

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-lg bg-background border-l shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
            {employee.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{employee.name}</div>
            <div className="text-xs text-muted-foreground">{ROLE_LABELS[employee.role] ?? employee.role} · {formatMonth(month)}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg transition"><X className="w-4 h-4" /></button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Recalc bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRecalc}
              disabled={recalcPending}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition"
            >
              {recalcPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Пересчитать
            </button>
            {!record && <span className="text-xs text-amber-600">Данные не рассчитаны</span>}
          </div>

          {/* Stats */}
          {record && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Заказов', value: record.ordersCount, sub: `${record.worksCount} работ` },
                { label: 'Часов', value: `${record.hoursWorked}`, sub: `${record.shiftsCount} смен` },
                { label: 'Выручка', value: formatCurrency(record.revenue), sub: `Прибыль ${formatCurrency(record.profit)}` },
                { label: 'Начислено', value: formatCurrency(record.accrued), sub: record.status === 'paid' ? `✓ Выплачено ${formatCurrency(record.paid)}` : 'Ожидает выплаты', accent: true },
              ].map(({ label, value, sub, accent }) => (
                <div key={label} className="bg-muted/40 rounded-xl p-3">
                  <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                  <div className={cn('text-lg font-bold', accent && record.accrued > 0 && 'text-green-600')}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Breakdown by rules */}
          {record?.breakdown && record.breakdown.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Разбивка по правилам</div>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {record.breakdown.map(row => (
                      <tr key={row.ruleId}>
                        <td className="px-3 py-2">
                          <div className="text-xs font-medium">{SOURCE_LABELS[row.source]}</div>
                          <div className="text-xs text-muted-foreground">{METHOD_LABELS[row.method]}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                          {row.method === 'fixed' ? `${row.base} шт.` : formatCurrency(row.base)}
                        </td>
                        <td className={cn('px-3 py-2 text-right text-sm font-semibold', row.amount > 0 ? 'text-green-600' : 'text-muted-foreground')}>
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders list */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-2">
              Заказы за период
              {ordersFetching && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            {orders.length === 0 && !ordersFetching && (
              <div className="text-xs text-muted-foreground py-3 text-center border rounded-xl">Нет выданных заказов за период</div>
            )}
            {orders.length > 0 && (
              <div className="border rounded-xl overflow-hidden divide-y divide-border">
                {orders.map(order => {
                  const worksTotal = order.works.reduce((s, w) => s + w.price, 0)
                  const partsTotal = order.parts.reduce((s, p) => s + p.price * p.quantity, 0)
                  const total = worksTotal + partsTotal
                  return (
                    <Link
                      key={order._id}
                      href={`/orders/${order._id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-semibold text-blue-600">#{order.number}</span>
                          <span className="text-xs text-muted-foreground truncate">{order.clientName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {[order.deviceBrand, order.deviceModel].filter(Boolean).join(' ')}
                          {order.works.length > 0 && (
                            <span className="ml-1">· {order.works.slice(0, 2).map(w => w.name).join(', ')}{order.works.length > 2 ? ` +${order.works.length - 2}` : ''}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold">{formatCurrency(total)}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Adjustments */}
          {record && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Корректировки</div>

              {/* Existing bonuses */}
              {(record.bonuses ?? []).length > 0 && (
                <div className="space-y-1 mb-2">
                  {(record.bonuses ?? []).map(b => (
                    <div key={b._id} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-green-700 font-medium">+{formatCurrency(b.amount)}</span>
                      <span className="flex-1 text-green-800">{b.reason}</span>
                      <button
                        onClick={() => removeAdjMutation.mutate({ type: 'bonus', adjustmentId: b._id })}
                        className="text-green-600 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing deductions */}
              {(record.deductions ?? []).length > 0 && (
                <div className="space-y-1 mb-2">
                  {(record.deductions ?? []).map(d => (
                    <div key={d._id} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-red-700 font-medium">-{formatCurrency(d.amount)}</span>
                      <span className="flex-1 text-red-800">{d.reason}</span>
                      <button
                        onClick={() => removeAdjMutation.mutate({ type: 'deduction', adjustmentId: d._id })}
                        className="text-red-600 hover:text-red-700 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add adjustment form */}
              <div className="border rounded-xl p-3 space-y-2">
                <div className="flex gap-1">
                  {(['bonus', 'deduction'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdjType(t)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        adjType === t
                          ? t === 'bonus' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          : 'bg-muted text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {t === 'bonus' ? '+ Бонус' : '− Вычет'}
                    </button>
                  ))}
                </div>
                {adjError && <div className="text-xs text-red-600">{adjError}</div>}
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={adjAmount}
                    onChange={e => setAdjAmount(e.target.value)}
                    placeholder="Сумма ₽"
                    min={0}
                    className="w-24 px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                  />
                  <input
                    type="text"
                    value={adjReason}
                    onChange={e => setAdjReason(e.target.value)}
                    placeholder="Причина"
                    className="flex-1 px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => addAdjMutation.mutate()}
                    disabled={addAdjMutation.isPending}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs rounded-lg font-medium transition flex items-center gap-1"
                  >
                    {addAdjMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer: payout */}
        {record && record.status === 'pending' && record.accrued > 0 && (
          <div className="border-t px-4 py-3 shrink-0">
            {!showPayout ? (
              <button
                onClick={() => { setPayoutAmount(record.accrued); setShowPayout(true) }}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition"
              >
                Выплатить {formatCurrency(record.accrued)}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={e => setPayoutAmount(+e.target.value)}
                    className="w-32 px-2 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
                    min={0}
                  />
                  <input
                    type="text"
                    value={payoutNotes}
                    onChange={e => setPayoutNotes(e.target.value)}
                    placeholder="Примечание"
                    className="flex-1 px-2 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPayout(false)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition">
                    Отмена
                  </button>
                  <button
                    onClick={() => { onPayout(payoutAmount, payoutNotes); setShowPayout(false) }}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition"
                  >
                    Подтвердить
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {record?.status === 'paid' && (
          <div className="border-t px-4 py-3 shrink-0 bg-green-50">
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>
                Выплачено {formatCurrency(record.paid)}
                {record.paidAt ? ` · ${new Date(record.paidAt).toLocaleDateString('ru-RU')}` : ''}
                {record.notes ? ` · ${record.notes}` : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const [month, setMonth] = useState<string>(currentMonth)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recalcingId, setRecalcingId] = useState<string | null>(null)
  const [recalcAllProgress, setRecalcAllProgress] = useState<{ done: number; total: number } | null>(null)

  const isPrivileged = session?.user?.role === 'owner' || session?.user?.role === 'admin'

  const { data: employees = [], isLoading: empLoading } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      const json = await res.json()
      return (json.data ?? []) as Employee[]
    },
  })

  const { data: records = [], isLoading: recLoading } = useQuery<PayrollRecord[]>({
    queryKey: ['payroll', month],
    queryFn: async () => {
      const res = await fetch(`/api/payroll?month=${month}`)
      const json = await res.json()
      return (json.data ?? []) as PayrollRecord[]
    },
  })

  const recordById = useMemo(
    () => new Map(records.map(r => [r.userId, r])),
    [records],
  )

  const activeEmployees = employees.filter(e => e.isActive)
  const selectedEmployee = selectedId ? employees.find(e => e._id === selectedId) ?? null : null
  const selectedRecord = selectedId ? recordById.get(selectedId) : undefined

  // Summary totals
  const totalAccrued = records.reduce((s, r) => s + r.accrued, 0)
  const totalPaid = records.reduce((s, r) => s + r.paid, 0)
  const pendingCount = records.filter(r => r.status === 'pending' && r.accrued > 0).length

  async function recalcOne(userId: string) {
    setRecalcingId(userId)
    try {
      await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, userId }),
      })
      queryClient.invalidateQueries({ queryKey: ['payroll', month] })
    } finally {
      setRecalcingId(null)
    }
  }

  async function recalcAll() {
    const list = activeEmployees
    setRecalcAllProgress({ done: 0, total: list.length })
    for (let i = 0; i < list.length; i++) {
      await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, userId: list[i]._id }),
      })
      setRecalcAllProgress({ done: i + 1, total: list.length })
    }
    setRecalcAllProgress(null)
    queryClient.invalidateQueries({ queryKey: ['payroll', month] })
  }

  const payoutMutation = useMutation({
    mutationFn: async ({ recordId, paid, notes }: { recordId: string; paid: number; notes: string }) => {
      const res = await fetch(`/api/payroll/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid, notes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      return json
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', month] }),
  })

  const isLoading = empLoading || recLoading

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">Зарплатная ведомость</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{formatMonth(month)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
          />
          {isPrivileged && (
            <button
              onClick={recalcAll}
              disabled={!!recalcAllProgress}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
            >
              {recalcAllProgress
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {recalcAllProgress.done}/{recalcAllProgress.total}</>
                : <><RefreshCw className="w-4 h-4" /> Пересчитать всех</>}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Начислено итого
          </div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalAccrued)}</div>
          <div className="text-xs text-muted-foreground mt-1">{activeEmployees.length} сотрудников</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Выплачено
          </div>
          <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {records.filter(r => r.status === 'paid').length} из {records.length}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <Clock className="w-3.5 h-3.5" />
            Ожидает выплаты
          </div>
          <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalAccrued - totalPaid)}</div>
          <div className="text-xs text-muted-foreground mt-1">{pendingCount} сотрудников</div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Сотрудник</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Схема</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right hidden md:table-cell">Заказы</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right hidden lg:table-cell">Выручка</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right hidden md:table-cell">Часы</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Начислено</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Статус</th>
                <th className="px-4 py-3 font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Нет активных сотрудников
                  </td>
                </tr>
              )}
              {activeEmployees.map(emp => {
                const pr = recordById.get(emp._id)
                const isRecalcing = recalcingId === emp._id
                const isSelected = selectedId === emp._id

                return (
                  <tr
                    key={emp._id}
                    onClick={() => setSelectedId(isSelected ? null : emp._id)}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-muted/30',
                    )}
                  >
                    {/* Employee */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{emp.name}</div>
                          <div className="text-xs text-muted-foreground">{ROLE_LABELS[emp.role] ?? emp.role}</div>
                        </div>
                      </div>
                    </td>

                    {/* Salary scheme */}
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {salarySchemeLabel(emp.salary)}
                    </td>

                    {/* Orders */}
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      {pr ? (
                        <div>
                          <div className="font-medium">{pr.ordersCount}</div>
                          <div className="text-xs text-muted-foreground">{pr.worksCount} работ</div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Revenue */}
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      {pr ? (
                        <div>
                          <div className="font-medium">{formatCurrency(pr.revenue)}</div>
                          <div className="text-xs text-muted-foreground">прибыль {formatCurrency(pr.profit)}</div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Hours */}
                    <td className="px-4 py-3 text-right text-sm hidden md:table-cell">
                      {pr ? (
                        <div>
                          <div className="font-medium">{pr.hoursWorked} ч</div>
                          <div className="text-xs text-muted-foreground">{pr.shiftsCount} смен</div>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Accrued */}
                    <td className="px-4 py-3 text-right">
                      {pr ? (
                        <div>
                          <div className="font-bold text-green-600">{formatCurrency(pr.accrued)}</div>
                          {((pr.bonuses ?? []).length > 0 || (pr.deductions ?? []).length > 0) && (
                            <div className="text-xs text-muted-foreground">
                              {(pr.bonuses ?? []).length > 0 && <span className="text-green-600">+{formatCurrency((pr.bonuses ?? []).reduce((s, b) => s + b.amount, 0))}</span>}
                              {(pr.deductions ?? []).length > 0 && <span className="text-red-600 ml-1">-{formatCurrency((pr.deductions ?? []).reduce((s, d) => s + d.amount, 0))}</span>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Не рассчитано</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {pr ? (
                        pr.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 text-xs px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Выплачено
                          </span>
                        ) : pr.accrued > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 text-xs px-2 py-1 rounded-full">
                            <Clock className="w-3 h-3" /> Ожидает
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">0 ₽</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        {isPrivileged && (
                          <button
                            onClick={() => recalcOne(emp._id)}
                            disabled={isRecalcing}
                            title="Пересчитать"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            {isRecalcing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedId(isSelected ? null : emp._id)}
                          title="Детали"
                          className={cn('p-1.5 hover:bg-blue-50 rounded-lg transition', isSelected ? 'text-blue-600' : 'text-muted-foreground')}
                        >
                          <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', isSelected && 'rotate-90')} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {selectedEmployee && (
        <DetailDrawer
          employee={selectedEmployee}
          record={selectedRecord}
          month={month}
          onClose={() => setSelectedId(null)}
          onRecalc={() => recalcOne(selectedEmployee._id)}
          recalcPending={recalcingId === selectedEmployee._id}
          onPayout={(amount, notes) => {
            if (!selectedRecord) return
            payoutMutation.mutate({ recordId: selectedRecord._id, paid: amount, notes })
          }}
        />
      )}
    </div>
  )
}
