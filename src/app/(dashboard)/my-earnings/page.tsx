'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, RefreshCw, AlertTriangle, Loader2, TrendingUp, ClipboardList, Banknote } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface PayrollRecord {
  _id: string
  userId: string
  month: string
  ordersCount: number
  worksCount: number
  revenue: number
  profit: number
  accrued: number
  paid: number
  status: 'pending' | 'paid'
  paidAt?: string
  notes?: string
}

interface SalaryConfig {
  type: 'percent_revenue' | 'percent_profit' | 'fixed' | 'rate_per_order'
  value: number
  guaranteed?: number
}

interface UserWithSalary {
  salary?: SalaryConfig
}

const SALARY_LABELS: Record<string, string> = {
  percent_revenue: '% от выручки',
  percent_profit: '% от прибыли',
  fixed: 'Фиксированный оклад',
  rate_per_order: 'Ставка за заказ',
}

function currentMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
}

function salarySchemeLabel(salary: SalaryConfig): string {
  const typeLabel = SALARY_LABELS[salary.type] ?? salary.type
  if (salary.type === 'percent_revenue' || salary.type === 'percent_profit') {
    return `${salary.value}% ${salary.type === 'percent_revenue' ? 'от выручки' : 'от прибыли'}`
  }
  if (salary.type === 'rate_per_order') {
    return `${formatCurrency(salary.value)} за заказ`
  }
  return `${typeLabel}: ${formatCurrency(salary.value)}`
}

const DEMO_RECORD: PayrollRecord = {
  _id: 'demo',
  userId: 'demo',
  month: currentMonth(),
  ordersCount: 18,
  worksCount: 24,
  revenue: 122500,
  profit: 84000,
  accrued: 24500,
  paid: 0,
  status: 'pending',
}

export default function MyEarningsPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState<string>(currentMonth)

  const { data: profileData } = useQuery<UserWithSalary>({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      const json = await res.json()
      const employees = (json.data ?? []) as Array<UserWithSalary & { _id: string }>
      return employees.find(e => e._id === session?.user?.id) ?? {}
    },
    enabled: !!session?.user?.id,
  })

  const salary = profileData?.salary

  const { data: record, isLoading } = useQuery<PayrollRecord | null>({
    queryKey: ['my-earnings', month],
    queryFn: async () => {
      const res = await fetch(`/api/payroll?month=${month}`)
      const json = await res.json()
      const records = (json.data ?? []) as PayrollRecord[]
      return records[0] ?? null
    },
    enabled: !!session?.user?.id,
  })

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка пересчёта')
      return json.data as PayrollRecord
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-earnings', month] })
    },
  })

  const display = record ?? (recalcMutation.isSuccess ? null : DEMO_RECORD)

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-100 text-green-700 rounded-xl flex items-center justify-center shrink-0">
          <DollarSign className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Мой заработок</h1>
          <p className="text-sm text-muted-foreground">
            {display ? formatMonth(month) : 'Нет данных'}
          </p>
        </div>
      </div>

      {/* No salary scheme warning */}
      {!salary && (
        <div className="mb-5 flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3.5 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Схема мотивации не задана — обратитесь к владельцу для настройки зарплаты.</span>
        </div>
      )}

      {/* Salary scheme display */}
      {salary && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-700 flex items-center gap-2">
          <Banknote className="w-4 h-4 shrink-0" />
          <span>Ваша схема: <strong>{salarySchemeLabel(salary)}</strong>
            {salary.guaranteed ? ` · Гарантированный минимум: ${formatCurrency(salary.guaranteed)}` : ''}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
        />
        <button
          onClick={() => recalcMutation.mutate()}
          disabled={recalcMutation.isPending}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
        >
          {recalcMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          Пересчитать
        </button>
        {recalcMutation.isError && (
          <span className="text-red-600 text-sm">{(recalcMutation.error as Error).message}</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : display ? (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Начислено
              </div>
              <div className={cn(
                'text-2xl font-bold',
                display.accrued > 0 ? 'text-green-600' : 'text-foreground',
              )}>
                {formatCurrency(display.accrued)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {display.status === 'paid' ? '✓ Выплачено' : 'Ожидает выплаты'}
              </div>
            </div>

            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                <ClipboardList className="w-3.5 h-3.5" />
                Заказов
              </div>
              <div className="text-2xl font-bold">{display.ordersCount}</div>
              <div className="text-xs text-muted-foreground mt-1">{display.worksCount} работ</div>
            </div>

            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Выручка
              </div>
              <div className="text-2xl font-bold">{formatCurrency(display.revenue)}</div>
              <div className="text-xs text-muted-foreground mt-1">по оценочной стоимости</div>
            </div>

            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                <Banknote className="w-3.5 h-3.5" />
                Прибыль (база)
              </div>
              <div className="text-2xl font-bold">{formatCurrency(display.profit)}</div>
              <div className="text-xs text-muted-foreground mt-1">за вычетом з/ч</div>
            </div>
          </div>

          {/* Payment status */}
          {display.status === 'paid' && (
            <div className="mb-5 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 shrink-0" />
              <span>
                Выплачено {formatCurrency(display.paid)}
                {display.paidAt ? ` · ${new Date(display.paidAt).toLocaleDateString('ru-RU')}` : ''}
                {display.notes ? ` · ${display.notes}` : ''}
              </span>
            </div>
          )}

          {/* Demo notice */}
          {!record && (
            <div className="mt-2 text-xs text-muted-foreground text-center">
              Демо-данные. Нажмите «Пересчитать» для загрузки реальных данных за выбранный месяц.
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          Нет данных за выбранный период. Нажмите «Пересчитать».
        </div>
      )}
    </div>
  )
}
