'use client'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'

const FUNNEL_STAGES = [
  { key: 'new', label: 'Новый', color: 'bg-slate-400' },
  { key: 'diagnostics', label: 'Диагностика', color: 'bg-purple-500' },
  { key: 'waiting_approval', label: 'Согласование', color: 'bg-yellow-500' },
  { key: 'in_repair', label: 'В ремонте', color: 'bg-blue-500' },
  { key: 'ready', label: 'Готов', color: 'bg-green-500' },
  { key: 'issued', label: 'Выдан', color: 'bg-emerald-600' },
]

export default function FunnelPage() {
  const { data: stats } = useQuery({
    queryKey: ['stats', 'month'],
    queryFn: async () => {
      const res = await fetch('/api/stats?period=month')
      const json = await res.json()
      return json.data
    },
  })

  const byStatus = Object.fromEntries((stats?.ordersByStatus ?? []).map((s: { _id: string; count: number }) => [s._id, s.count]))
  const max = Math.max(1, ...FUNNEL_STAGES.map(s => byStatus[s.key] ?? 0))

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold">Воронка продаж</h1>
      </div>
      <div className="max-w-2xl">
        <div className="space-y-3">
          {FUNNEL_STAGES.map((stage, i) => {
            const count = byStatus[stage.key] ?? 0
            const width = Math.max(10, (count / max) * 100)
            return (
              <div key={stage.key} className="flex items-center gap-4">
                <div className="w-32 text-sm text-right text-muted-foreground">{stage.label}</div>
                <div className="flex-1 relative h-10 flex items-center">
                  <div
                    className={`h-10 rounded-lg ${stage.color} flex items-center px-3 text-white text-sm font-semibold transition-all`}
                    style={{ width: `${width}%`, minWidth: 60 }}
                  >
                    {count}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground w-16 text-right">
                  {max > 0 ? Math.round((count / max) * 100) : 0}%
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground mt-6">
          Показаны данные за текущий месяц. Воронка отображает количество заказов на каждом этапе.
        </p>
      </div>
    </div>
  )
}
