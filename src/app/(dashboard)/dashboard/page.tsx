'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'
import {
  ClipboardList, Users, DollarSign, TrendingUp, Clock, CheckCircle,
  AlertCircle, Wrench, Play, Square, ShoppingCart, BarChart3,
  Target, Timer, ArrowUpRight,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'

const PERIODS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
]

function StatCard({ icon: Icon, label, value, sub, color, href }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  color: string
  href?: string
}) {
  const inner = (
    <div className="bg-card border rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {href && <ArrowUpRight className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-green-600 mt-1 font-medium">{sub}</div>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function formatDuration(openedAt: string): string {
  const diff = Math.floor((Date.now() - new Date(openedAt).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function ShiftWidget() {
  const queryClient = useQueryClient()
  const [elapsed, setElapsed] = useState('')

  const { data: shift, isLoading } = useQuery({
    queryKey: ['my-shift'],
    queryFn: async () => {
      const res = await fetch('/api/shifts/my')
      const json = await res.json()
      return json.data as { _id: string; openedAt: string; status: string } | null
    },
  })

  const startMutation = useMutation({
    mutationFn: () => fetch('/api/shifts/my', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-shift'] }),
  })

  const endMutation = useMutation({
    mutationFn: () => fetch('/api/shifts/my', { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-shift'] }),
  })

  useEffect(() => {
    if (!shift?.openedAt) return
    setElapsed(formatDuration(shift.openedAt))
    const id = setInterval(() => setElapsed(formatDuration(shift.openedAt)), 1000)
    return () => clearInterval(id)
  }, [shift?.openedAt])

  if (isLoading) return null

  if (!shift) {
    return (
      <div className="bg-card border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Timer className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <div className="font-medium text-sm">Рабочий день не начат</div>
            <div className="text-xs text-muted-foreground">Нажмите, чтобы начать смену</div>
          </div>
        </div>
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
        >
          <Play className="w-4 h-4" />
          Начать день
        </button>
      </div>
    )
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        </div>
        <div>
          <div className="font-medium text-sm text-green-800">Смена активна</div>
          <div className="text-xs text-green-700 font-mono font-semibold">{elapsed}</div>
        </div>
      </div>
      <button
        onClick={() => endMutation.mutate()}
        disabled={endMutation.isPending}
        className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
      >
        <Square className="w-3.5 h-3.5" />
        Завершить
      </button>
    </div>
  )
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  in_repair: 'В работе',
  waiting_parts: 'Ожидает',
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

export default function DashboardPage() {
  const [period, setPeriod] = useState('month')

  const { data, isLoading } = useQuery({
    queryKey: ['stats', period],
    queryFn: async () => {
      const res = await fetch(`/api/stats?period=${period}`)
      const json = await res.json()
      return json.data
    },
  })

  const { data: recentOrders } = useQuery({
    queryKey: ['orders-recent'],
    queryFn: async () => {
      const res = await fetch('/api/orders?limit=5')
      const json = await res.json()
      return json.data?.orders ?? []
    },
  })

  const { data: recentSales } = useQuery({
    queryKey: ['finance-recent-sales'],
    queryFn: async () => {
      const res = await fetch('/api/finance?limit=5')
      const json = await res.json()
      const txs = json.data?.transactions ?? []
      return txs.filter((t: { category: string }) => t.category === 'sale').slice(0, 5)
    },
  })

  const stats = data ?? {}

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Welcome + shift widget */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">ServiceBox CRM</h1>
        <p className="text-muted-foreground text-sm mb-4">Актуальные показатели сервисного центра</p>
        <ShiftWidget />
      </div>

      {/* Period filter */}
      <div className="flex gap-1 mb-6 border rounded-lg p-1 w-fit">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition ${
              period === p.value ? 'bg-blue-600 text-white' : 'hover:bg-accent'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={ClipboardList}
          label="Заказов за период"
          value={isLoading ? '...' : stats.orders?.total ?? 0}
          color="bg-blue-600"
          href="/orders"
        />
        <StatCard
          icon={DollarSign}
          label="Выручка"
          value={isLoading ? '...' : formatCurrency(stats.orderRevenue ?? 0)}
          sub={stats.posRevenue > 0 ? `+${formatCurrency(stats.posRevenue)} продажи` : undefined}
          color="bg-green-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Валовая прибыль"
          value={isLoading ? '...' : formatCurrency(stats.grossProfit ?? 0)}
          sub={stats.grossMargin != null ? `Маржа ${stats.grossMargin}%` : undefined}
          color={stats.grossProfit >= 0 ? 'bg-emerald-600' : 'bg-red-500'}
        />
        <StatCard
          icon={BarChart3}
          label="Средний чек"
          value={isLoading ? '...' : (stats.avgCheck ? formatCurrency(stats.avgCheck) : '—')}
          color="bg-indigo-600"
        />
        <StatCard
          icon={Clock}
          label="В ремонте"
          value={isLoading ? '...' : stats.orders?.inRepair ?? 0}
          color="bg-orange-500"
          href="/orders?status=in_repair"
        />
        <StatCard
          icon={CheckCircle}
          label="Выдано"
          value={isLoading ? '...' : stats.orders?.issued ?? 0}
          sub={stats.conversionRate != null ? `Конверсия ${stats.conversionRate}%` : undefined}
          color="bg-teal-600"
        />
        <StatCard
          icon={AlertCircle}
          label="Готово к выдаче"
          value={isLoading ? '...' : stats.orders?.ready ?? 0}
          color="bg-amber-500"
          href="/orders?status=ready"
        />
        <StatCard
          icon={Users}
          label="Новых клиентов"
          value={isLoading ? '...' : stats.newClients ?? 0}
          color="bg-purple-600"
          href="/clients"
        />
      </div>

      {/* Profit breakdown banner */}
      {!isLoading && stats.orderCogs > 0 && (
        <div className="bg-card border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Финансовая структура периода</h3>
            <Link href="/finance" className="text-xs text-blue-600 hover:underline">Все транзакции →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs mb-1">Выручка (заказы)</div>
              <div className="font-bold text-green-600">{formatCurrency(stats.orderRevenue)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Себестоимость</div>
              <div className="font-bold text-red-500">{formatCurrency(stats.orderCogs)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Валовая прибыль</div>
              <div className={`font-bold ${stats.grossProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(stats.grossProfit)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Прочие расходы</div>
              <div className="font-bold text-orange-600">{formatCurrency(stats.manualExpenses)}</div>
            </div>
          </div>
          {stats.avgRepairHours && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              Среднее время ремонта: {stats.avgRepairHours} ч
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Выручка по дням</h3>
          {stats.revenueByDay && stats.revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="_id" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}к`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} name="Выручка" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Нет выданных заказов за период
            </div>
          )}
        </div>

        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Лучшие мастера</h3>
          {stats.topMasters && stats.topMasters.length > 0 ? (
            <div className="space-y-3">
              {stats.topMasters.map((m: { _id: string; masterName: string; count: number; revenue: number; margin: number }) => (
                <div key={String(m._id)} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                    {m.masterName?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.masterName ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{m.count} заказов · маржа {m.margin}%</div>
                  </div>
                  <div className="text-sm font-semibold text-green-600">{formatCurrency(m.revenue)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Нет данных
            </div>
          )}
        </div>
      </div>

      {/* Recent orders + sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Последние заказы</h3>
            <Link href="/orders" className="text-sm text-blue-600 hover:underline">Все →</Link>
          </div>
          {recentOrders && recentOrders.length > 0 ? (
            <div className="space-y-1">
              {recentOrders.map((order: {
                _id: string; number: string; clientName: string;
                deviceType: string; deviceModel?: string; status: string; finalCost: number
              }) => (
                <Link key={order._id} href={`/orders/${order._id}`} className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg transition">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-600">{order.number}</span>
                      <span className="text-sm font-medium truncate">{order.clientName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{order.deviceType} {order.deviceModel}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    {order.finalCost > 0 && (
                      <span className="text-xs font-medium">{formatCurrency(order.finalCost)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Заказов пока нет. <Link href="/orders/new" className="text-blue-600 hover:underline">Создать →</Link>
            </div>
          )}
        </div>

        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-orange-500" />
              Продажи
            </h3>
            <div className="flex items-center gap-3">
              {stats.posRevenue > 0 && (
                <span className="text-xs font-medium text-orange-600">{formatCurrency(stats.posRevenue)} за период</span>
              )}
              <Link href="/sales" className="text-sm text-blue-600 hover:underline">Касса →</Link>
            </div>
          </div>
          {recentSales && recentSales.length > 0 ? (
            <div className="space-y-1">
              {recentSales.map((tx: { _id: string; description?: string; amount: number; paymentMethod: string; date: string }) => (
                <div key={tx._id} className="flex items-center gap-3 p-2 rounded-lg">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{tx.description ?? 'Продажа'}</div>
                    <div className="text-xs text-muted-foreground">{tx.paymentMethod}</div>
                  </div>
                  <div className="text-sm font-semibold text-green-600">+{formatCurrency(tx.amount)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Продаж за период нет. <Link href="/sales" className="text-blue-600 hover:underline">Открыть кассу →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
