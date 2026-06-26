'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, CheckCircle, Users, DollarSign,
  Activity, ClipboardList, Loader2, Target, Clock, BarChart3,
  Smartphone, ShoppingCart,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

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

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-500',
  in_repair: 'bg-amber-500',
  waiting_parts: 'bg-purple-500',
  ready: 'bg-green-500',
  issued: 'bg-slate-500',
  cancelled: 'bg-red-500',
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

interface StatsData {
  orders: { total: number; new: number; inRepair: number; ready: number; issued: number; cancelled: number }
  orderRevenue: number
  orderCogs: number
  grossProfit: number
  grossMargin: number
  posRevenue: number
  posCount: number
  netProfit: number
  avgCheck: number
  newClients: number
  conversionRate: number
  avgRepairHours: number | null
  ordersByStatus: Array<{ _id: string; count: number }>
  revenueByDay: Array<{ _id: string; revenue: number; count: number }>
  deviceTypesAgg: Array<{ _id: string; count: number }>
  sourcesAgg: Array<{ _id: string; count: number }>
  topMasters: Array<{ _id: string; masterName: string; count: number; revenue: number; grossProfit: number; margin: number }>
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
    orange: 'text-orange-600 bg-orange-50',
    emerald: 'text-emerald-600 bg-emerald-50',
  }
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg', colors[color] ?? colors.blue)}>
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

function MiniBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${pct}%` }} />
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
              className={cn('px-4 py-2 text-sm font-medium transition', period === p.key ? 'bg-blue-600 text-white' : 'hover:bg-accent')}
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
          {/* Операционные KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard icon={ClipboardList} label="Всего заказов" value={data.orders.total} color="blue" />
            <StatCard
              icon={CheckCircle}
              label="Выдано"
              value={data.orders.issued}
              sub={`Конверсия ${data.conversionRate}%`}
              color="green"
            />
            <StatCard
              icon={Activity}
              label="Отказы"
              value={data.orders.cancelled}
              sub={data.orders.total > 0 ? `${Math.round((data.orders.cancelled / data.orders.total) * 100)}% от всех` : undefined}
              color="red"
            />
            <StatCard
              icon={Clock}
              label="Среднее время"
              value={data.avgRepairHours !== null ? `${data.avgRepairHours} ч` : '—'}
              sub="Приёмка → выдача"
              color="amber"
            />
          </div>

          {/* Финансовые KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={DollarSign}
              label="Выручка"
              value={formatCurrency(data.orderRevenue)}
              sub={data.posRevenue > 0 ? `+${formatCurrency(data.posRevenue)} касса` : undefined}
              color="green"
            />
            <StatCard
              icon={TrendingDown}
              label="Себестоимость"
              value={formatCurrency(data.orderCogs)}
              sub="Услуги + запчасти"
              color="red"
            />
            <StatCard
              icon={TrendingUp}
              label="Валовая прибыль"
              value={formatCurrency(data.grossProfit)}
              sub={`Маржа ${data.grossMargin}%`}
              color="emerald"
            />
            <StatCard
              icon={BarChart3}
              label="Средний чек"
              value={data.avgCheck ? formatCurrency(data.avgCheck) : '—'}
              color="purple"
            />
          </div>

          {/* Графики */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold mb-4 text-sm">Выручка по дням</h3>
              {data.revenueByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="_id" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}к`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} name="Выручка" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Нет данных</div>
              )}
            </div>

            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold mb-4 text-sm">Статусы заказов</h3>
              {data.ordersByStatus.length > 0 ? (
                <div className="space-y-3">
                  {data.ordersByStatus.sort((a, b) => b.count - a.count).map(s => (
                    <div key={s._id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{STATUS_LABEL[s._id] ?? s._id}</span>
                        <span className="font-medium">{s.count}</span>
                      </div>
                      <MiniBar value={s.count} max={totalOrders} colorClass={STATUS_COLOR[s._id] ?? 'bg-slate-500'} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">Нет данных</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Device types pie */}
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-500" />
                Типы устройств
              </h3>
              {data.deviceTypesAgg.filter(d => d._id).length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={data.deviceTypesAgg.filter(d => d._id)} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={60}>
                        {data.deviceTypesAgg.filter(d => d._id).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {data.deviceTypesAgg.filter(d => d._id).slice(0, 5).map((d, i) => (
                      <div key={d._id} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="flex-1 truncate">{d._id}</span>
                        <span className="font-medium">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">Нет данных</div>
              )}
            </div>

            {/* Sources */}
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                Источники клиентов
              </h3>
              {data.sourcesAgg.length > 0 ? (
                <div className="space-y-3">
                  {data.sourcesAgg.map((s, i) => (
                    <div key={s._id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="truncate pr-2">{s._id}</span>
                        <span className="font-medium">{s.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${Math.round((s.count / (data.sourcesAgg[0]?.count ?? 1)) * 100)}%`,
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">
                  <div className="text-center">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Источники не указаны</p>
                  </div>
                </div>
              )}
            </div>

            {/* Clients & sales summary */}
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-green-500" />
                Клиенты и продажи
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Новых клиентов</div>
                  <div className="text-2xl font-bold text-green-600">{data.newClients}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Конверсия заказов</div>
                  <div className="text-2xl font-bold text-blue-600">{data.conversionRate}%</div>
                </div>
                {data.posCount > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Продаж (касса)
                    </div>
                    <div className="text-xl font-bold text-orange-600">{data.posCount}</div>
                  </div>
                )}
                {data.posRevenue > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Выручка касса</div>
                    <div className="text-base font-bold text-orange-500">{formatCurrency(data.posRevenue)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Masters table */}
          <div className="bg-card border rounded-xl overflow-hidden mb-4">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">Показатели мастеров</h3>
              <span className="text-xs text-muted-foreground">по выданным заказам</span>
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
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Себест.</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Прибыль</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Маржа</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.topMasters.map(m => (
                      <tr key={String(m._id)} className="hover:bg-muted/20 transition">
                        <td className="px-4 py-3 font-medium">{m.masterName ?? '—'}</td>
                        <td className="px-4 py-3 text-right">{m.count}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(m.revenue)}</td>
                        <td className="px-4 py-3 text-right text-red-500">{formatCurrency(m.revenue - m.grossProfit)}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(m.grossProfit)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            m.margin >= 50 ? 'bg-green-100 text-green-700' :
                            m.margin >= 30 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          )}>
                            {m.margin}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Заказов в день */}
          {data.revenueByDay.length > 0 && (
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold mb-4 text-sm">Заказов выдано по дням</h3>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={data.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Заказов" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
