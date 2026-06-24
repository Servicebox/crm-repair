'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, CheckCircle, Users, DollarSign, Activity, ClipboardList, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

const PERIODS = [
  { key: '7d', label: '7 дней', apiPeriod: 'week' },
  { key: '30d', label: '30 дней', apiPeriod: 'month' },
  { key: '90d', label: '3 месяца', apiPeriod: 'year' },
] as const

type PeriodKey = typeof PERIODS[number]['key']

const STATUS_LABEL: Record<string, string> = {
  new: 'Новые',
  in_repair: 'В работе',
  waiting_parts: 'Ожидает запчасти',
  ready: 'Готовы',
  issued: 'Выданы',
  cancelled: 'Отказы',
}

const STATUS_COLOR: Record<string, 'blue' | 'amber' | 'purple' | 'green' | 'slate' | 'red'> = {
  new: 'blue',
  in_repair: 'amber',
  waiting_parts: 'purple',
  ready: 'green',
  issued: 'slate',
  cancelled: 'red',
}

type StatusColor = 'blue' | 'amber' | 'purple' | 'green' | 'slate' | 'red'

interface StatsData {
  period: string
  orders: {
    total: number
    new: number
    inRepair: number
    ready: number
    issued: number
  }
  revenue: number
  newClients: number
  ordersByStatus: Array<{ _id: string; count: number }>
  revenueByDay: Array<{ _id: string; revenue: number }>
  topMasters: Array<{ _id: string; masterName: string; count: number; revenue: number }>
}

function StatCard({ icon: Icon, label, value, sub, trend, color = 'blue' }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  trend?: number
  color?: string
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
    purple: 'text-purple-600 bg-purple-50',
  }
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
            {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold mb-0.5">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

function MiniBar({ value, max, color = 'blue' }: { value: number; max: number; color?: StatusColor | 'blue' }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    slate: 'bg-slate-500',
  }
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full', colors[color])} style={{ width: `${pct}%` }} />
    </div>
  )
}

async function fetchStats(apiPeriod: string): Promise<StatsData> {
  const res = await fetch(`/api/stats?period=${apiPeriod}`)
  if (!res.ok) throw new Error('Ошибка загрузки данных')
  const json = await res.json()
  return json.data as StatsData
}

export default function TelemetryPage() {
  const [period, setPeriod] = useState<PeriodKey>('30d')

  const apiPeriod = PERIODS.find(p => p.key === period)?.apiPeriod ?? 'month'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stats', apiPeriod],
    queryFn: () => fetchStats(apiPeriod),
  })

  const totalOrders = data?.orders.total ?? 0

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Телеметрия
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Аналитика и показатели сервисного центра</p>
        </div>
        <div className="flex border rounded-lg overflow-hidden">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition',
                period === p.key ? 'bg-blue-600 text-white' : 'hover:bg-accent'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="text-center py-24 text-muted-foreground">
          Не удалось загрузить данные. Попробуйте обновить страницу.
        </div>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={ClipboardList} label="Всего заказов" value={data.orders.total} color="blue" />
            <StatCard
              icon={CheckCircle}
              label="Выдано"
              value={data.orders.issued}
              sub={data.orders.total > 0 ? `${Math.round((data.orders.issued / data.orders.total) * 100)}% конверсия` : undefined}
              color="green"
            />
            <StatCard icon={DollarSign} label="Выручка" value={formatCurrency(data.revenue)} color="purple" />
            <StatCard icon={Users} label="Новых клиентов" value={data.newClients} color="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Статусы */}
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold mb-4">Распределение по статусам</h3>
              {data.ordersByStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет данных</p>
              ) : (
                <div className="space-y-3">
                  {data.ordersByStatus.map(s => {
                    const label = STATUS_LABEL[s._id] ?? s._id
                    const color = STATUS_COLOR[s._id] ?? 'blue'
                    return (
                      <div key={s._id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{label}</span>
                          <span className="font-medium">{s.count}</span>
                        </div>
                        <MiniBar value={s.count} max={totalOrders} color={color} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Мастера — краткая версия */}
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold">Показатели мастеров</h3>
              </div>
              {data.topMasters.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Нет данных</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Мастер</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Заказов</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Выручка</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.topMasters.map(m => (
                        <tr key={m._id} className="hover:bg-muted/20 transition">
                          <td className="px-4 py-3 font-medium">{m.masterName}</td>
                          <td className="px-4 py-3 text-right">{m.count}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(m.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
