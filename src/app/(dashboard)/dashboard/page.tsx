'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'
import { ClipboardList, Users, DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle, Wrench } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const PERIODS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
]

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-green-600 mt-1">{sub}</div>}
    </div>
  )
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

  const stats = data ?? {}

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Добро пожаловать в ServiceBox CRM!</h1>
        <p className="text-muted-foreground text-sm mt-1">Вот что происходит в вашем сервисном центре</p>
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

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ClipboardList} label="Заказов за период" value={isLoading ? '...' : stats.orders?.total ?? 0} color="bg-blue-600" />
        <StatCard icon={DollarSign} label="Выручка" value={isLoading ? '...' : formatCurrency(stats.revenue ?? 0)} color="bg-green-600" />
        <StatCard icon={Clock} label="В ремонте" value={isLoading ? '...' : stats.orders?.inRepair ?? 0} color="bg-orange-500" />
        <StatCard icon={CheckCircle} label="Выдано" value={isLoading ? '...' : stats.orders?.issued ?? 0} color="bg-emerald-600" />
        <StatCard icon={AlertCircle} label="Новые" value={isLoading ? '...' : stats.orders?.new ?? 0} color="bg-slate-500" />
        <StatCard icon={Users} label="Новых клиентов" value={isLoading ? '...' : stats.newClients ?? 0} color="bg-purple-600" />
        <StatCard icon={CheckCircle} label="Готово к выдаче" value={isLoading ? '...' : stats.orders?.ready ?? 0} color="bg-teal-600" />
        <StatCard icon={TrendingUp} label="Средний чек" value={isLoading || !stats.orders?.issued ? '—' : formatCurrency(Math.round((stats.revenue ?? 0) / (stats.orders?.issued || 1)))} color="bg-indigo-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Выручка по дням</h3>
          {stats.revenueByDay && stats.revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}к`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Нет данных за период
            </div>
          )}
        </div>

        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Лучшие мастера</h3>
          {stats.topMasters && stats.topMasters.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.topMasters}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="masterName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Заказов" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Нет данных
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Последние заказы</h3>
          <a href="/orders" className="text-sm text-blue-600 hover:underline">Все заказы →</a>
        </div>
        {recentOrders && recentOrders.length > 0 ? (
          <div className="space-y-2">
            {recentOrders.map((order: { _id: string; number: string; clientName: string; deviceType: string; deviceModel?: string; status: string; finalCost: number }) => (
              <a key={order._id} href={`/orders/${order._id}`} className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg transition">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-600">{order.number}</span>
                    <span className="text-sm font-medium truncate">{order.clientName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{order.deviceType} {order.deviceModel}</div>
                </div>
                <div className="text-sm font-medium">{order.finalCost > 0 ? formatCurrency(order.finalCost) : '—'}</div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Заказов пока нет. <a href="/orders/new" className="text-blue-600 hover:underline">Создать первый →</a>
          </div>
        )}
      </div>
    </div>
  )
}
