'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

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
            <LineChart data={stats?.revenueByDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}к`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
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
          <h3 className="font-semibold mb-4">Сводка</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Всего заказов</span>
              <span className="font-semibold">{stats?.orders?.total ?? 0}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Выдано</span>
              <span className="font-semibold">{stats?.orders?.issued ?? 0}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Выручка</span>
              <span className="font-semibold text-green-600">{formatCurrency(stats?.revenue ?? 0)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Новых клиентов</span>
              <span className="font-semibold">{stats?.newClients ?? 0}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Средний чек</span>
              <span className="font-semibold">
                {stats?.orders?.issued ? formatCurrency(Math.round((stats?.revenue ?? 0) / stats.orders.issued)) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
