'use client'
import { useState } from 'react'
import { BarChart2, TrendingUp, TrendingDown, Clock, Wrench, CheckCircle, AlertTriangle, Users, DollarSign, Activity, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

const PERIODS = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: '90d', label: '3 месяца' },
]

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

function MiniBar({ value, max, color = 'blue' }: { value: number; max: number; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full', colors[color])} style={{ width: `${Math.round((value / max) * 100)}%` }} />
    </div>
  )
}

const MASTERS = [
  { name: 'Иван Петров', orders: 47, done: 43, avgDays: 1.8, revenue: 184200 },
  { name: 'Мария Иванова', orders: 31, done: 30, avgDays: 2.1, revenue: 128500 },
  { name: 'Алексей Сидоров', orders: 22, done: 19, avgDays: 3.4, revenue: 76800 },
]

const DEVICE_STATS = [
  { type: 'Смартфон', count: 68, pct: 56 },
  { type: 'Ноутбук', count: 29, pct: 24 },
  { type: 'Планшет', count: 15, pct: 12 },
  { type: 'Телевизор', count: 9, pct: 8 },
]

const DEFECT_STATS = [
  { defect: 'Разбит экран', count: 34, pct: 28 },
  { defect: 'Не включается', count: 22, pct: 18 },
  { defect: 'Не заряжается', count: 19, pct: 16 },
  { defect: 'Батарея', count: 16, pct: 13 },
  { defect: 'Попала влага', count: 14, pct: 12 },
  { defect: 'Прочее', count: 16, pct: 13 },
]

const STATUS_COUNTS = [
  { status: 'Новые', count: 12, color: 'blue' },
  { status: 'В работе', count: 28, color: 'amber' },
  { status: 'Ожидают запчасти', count: 9, color: 'purple' },
  { status: 'Готовы', count: 14, color: 'green' },
  { status: 'Выданы', count: 43, color: 'slate' },
  { status: 'Отказы', count: 5, color: 'red' },
]

export default function TelemetryPage() {
  const [period, setPeriod] = useState('30d')

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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={ClipboardList} label="Всего заказов" value={111} trend={12} color="blue" />
        <StatCard icon={CheckCircle} label="Выполнено" value={95} sub="85.6% конверсия" trend={4} color="green" />
        <StatCard icon={Clock} label="Средний срок, дн." value="2.3" trend={-8} color="amber" />
        <StatCard icon={DollarSign} label="Выручка" value="389 500 ₽" trend={18} color="purple" />
        <StatCard icon={AlertTriangle} label="Просрочено" value={7} sub="6.3% от общего" trend={-15} color="red" />
        <StatCard icon={Users} label="Новых клиентов" value={38} trend={22} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Статусы */}
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Распределение по статусам</h3>
          <div className="space-y-3">
            {STATUS_COUNTS.map(s => (
              <div key={s.status}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{s.status}</span>
                  <span className="font-medium">{s.count}</span>
                </div>
                <MiniBar value={s.count} max={111} color={s.color as 'blue' | 'green' | 'amber' | 'red'} />
              </div>
            ))}
          </div>
        </div>

        {/* Типы устройств */}
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Типы устройств</h3>
          <div className="space-y-3">
            {DEVICE_STATS.map(d => (
              <div key={d.type}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{d.type}</span>
                  <span className="font-medium">{d.count} ({d.pct}%)</span>
                </div>
                <MiniBar value={d.pct} max={100} color="blue" />
              </div>
            ))}
          </div>
        </div>

        {/* Топ неисправностей */}
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Топ неисправностей</h3>
          <div className="space-y-3">
            {DEFECT_STATS.map(d => (
              <div key={d.defect}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate mr-2">{d.defect}</span>
                  <span className="font-medium shrink-0">{d.count} ({d.pct}%)</span>
                </div>
                <MiniBar value={d.pct} max={100} color="amber" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Мастера */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold">Показатели мастеров</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Мастер</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Заказов</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Выполнено</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Выполнение</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ср. срок</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Выручка</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {MASTERS.map(m => (
                <tr key={m.name} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-right">{m.orders}</td>
                  <td className="px-4 py-3 text-right">{m.done}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('font-medium', m.done / m.orders >= 0.9 ? 'text-green-600' : 'text-amber-600')}>
                      {Math.round((m.done / m.orders) * 100)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{m.avgDays} дн.</td>
                  <td className="px-4 py-3 text-right font-medium">{m.revenue.toLocaleString('ru')} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Данные для демонстрации. Интеграция с реальными заказами подключается автоматически.
      </p>
    </div>
  )
}

