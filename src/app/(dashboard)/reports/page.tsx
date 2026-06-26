'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts'

export default function ReportsPage() {
  const [period, setPeriod] = useState('month')

  const { data: stats } = useQuery({
    queryKey: ['stats', period],
    queryFn: async () => {
      const res = await fetch(`/api/stats?period=${period}`)
      const json = await res.json()
      return json.data
    },
  })

  const grossMarginColor = (stats?.grossMargin ?? 0) >= 50 ? 'text-green-600' :
    (stats?.grossMargin ?? 0) >= 30 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold mb-6">Отчёты</h1>

      <div className="flex gap-2 mb-6">
        {[{ v: 'week', l: 'Неделя' }, { v: 'month', l: 'Месяц' }, { v: 'year', l: 'Год' }].map(p => (
          <button key={p.v} onClick={() => setPeriod(p.v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${period === p.v ? 'bg-blue-600 text-white' : 'bg-muted hover:bg-accent'}`}>
            {p.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Выручка по дням</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={stats?.revenueByDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}к`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} name="Выручка" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">ТОП мастеров</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.topMasters ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="masterName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="revenue" name="Выручка" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Заказы по статусам</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.ordersByStatus ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Заказов" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Финансовая сводка</h3>
          <div className="space-y-0">
            {[
              { label: 'Всего заказов', value: stats?.orders?.total ?? 0, format: 'num' },
              { label: 'Выдано', value: stats?.orders?.issued ?? 0, format: 'num' },
              { label: 'Выручка (заказы)', value: stats?.orderRevenue ?? 0, format: 'currency', color: 'text-green-600' },
              { label: 'Себестоимость', value: stats?.orderCogs ?? 0, format: 'currency', color: 'text-red-500' },
              { label: 'Валовая прибыль', value: stats?.grossProfit ?? 0, format: 'currency', color: 'text-blue-600' },
              { label: 'Маржа', value: stats?.grossMargin ?? 0, format: 'pct', color: grossMarginColor },
              { label: 'Средний чек', value: stats?.avgCheck ?? 0, format: 'currency' },
              { label: 'Конверсия', value: stats?.conversionRate ?? 0, format: 'pct' },
              { label: 'Новых клиентов', value: stats?.newClients ?? 0, format: 'num' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2.5 border-b last:border-0 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={`font-semibold ${row.color ?? ''}`}>
                  {row.format === 'currency' ? formatCurrency(row.value as number) :
                    row.format === 'pct' ? `${row.value}%` :
                    row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Avg repair time note */}
      {stats?.avgRepairHours && (
        <div className="mt-4 bg-card border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">
            Среднее время ремонта (приёмка → выдача):
            <span className="ml-2 font-semibold text-foreground">{stats.avgRepairHours} ч</span>
          </div>
        </div>
      )}
    </div>
  )
}
