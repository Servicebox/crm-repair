'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Plus, User, Mail, Phone, Shield, Loader2, X, Edit2, DollarSign, CheckCircle, Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

const ROLES = [
  { value: 'owner', label: 'Владелец', color: 'bg-purple-100 text-purple-700' },
  { value: 'admin', label: 'Администратор', color: 'bg-blue-100 text-blue-700' },
  { value: 'manager', label: 'Менеджер', color: 'bg-green-100 text-green-700' },
  { value: 'master', label: 'Мастер', color: 'bg-orange-100 text-orange-700' },
]

const SALARY_TYPES = [
  { value: 'percent_revenue', label: 'Процент от выручки' },
  { value: 'percent_profit', label: 'Процент от прибыли' },
  { value: 'fixed', label: 'Фиксированный оклад' },
  { value: 'rate_per_order', label: 'Ставка за заказ' },
  { value: 'hourly', label: 'Почасовая ставка' },
]

interface Employee {
  _id: string
  name: string
  email: string
  role: string
  phone?: string
  isActive: boolean
  isEmailVerified: boolean
  salary?: { type: string; value: number; hourlyRate?: number; overtimeMultiplier?: number; guaranteed: number }
}

interface PayrollRecord {
  _id: string
  userId: string
  month: string
  ordersCount: number
  revenue: number
  hoursWorked: number
  shiftsCount: number
  accrued: number
  paid: number
  status: 'pending' | 'paid'
  paidAt?: string
  notes?: string
  bonuses: { _id: string; amount: number; reason: string }[]
  deductions: { _id: string; amount: number; reason: string }[]
}

const EMPTY_FORM = {
  name: '', email: '', role: 'master', phone: '',
  salary: { type: 'percent_revenue', value: 20, hourlyRate: 0, overtimeMultiplier: 1, guaranteed: 0 },
}

function currentMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

type Tab = 'employees' | 'payroll'

export default function EmployeesPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('employees')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Employee | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [payrollMonth, setPayrollMonth] = useState<string>(currentMonth)
  const [payoutForm, setPayoutForm] = useState<{ userId: string; recordId: string; amount: number; notes: string } | null>(null)

  const isPrivileged = session?.user?.role === 'owner' || session?.user?.role === 'admin'

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      const json = await res.json()
      return json.data as Employee[]
    },
  })

  const { data: payrollRecords, isLoading: payrollLoading } = useQuery({
    queryKey: ['payroll', payrollMonth],
    queryFn: async () => {
      const res = await fetch(`/api/payroll?month=${payrollMonth}`)
      const json = await res.json()
      return json.data as PayrollRecord[]
    },
    enabled: tab === 'payroll',
  })

  const payoutMutation = useMutation({
    mutationFn: async ({ recordId, paid, notes }: { recordId: string; paid: number; notes: string }) => {
      const res = await fetch(`/api/payroll/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid, notes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      return json.data as PayrollRecord
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', payrollMonth] })
      setPayoutForm(null)
    },
  })

  function openCreate() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function openEdit(e: Employee) {
    setEditItem(e)
    setForm({ name: e.name, email: e.email, role: e.role, phone: e.phone ?? '', salary: { type: e.salary?.type ?? 'percent_revenue', value: e.salary?.value ?? 20, hourlyRate: e.salary?.hourlyRate ?? 0, overtimeMultiplier: e.salary?.overtimeMultiplier ?? 1, guaranteed: e.salary?.guaranteed ?? 0 } })
    setError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const url = editItem ? `/api/employees/${editItem._id}` : '/api/employees'
    const method = editItem ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Ошибка')
    } else {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setShowForm(false)
      if (!editItem && json.data?.emailSent === false) {
        setTimeout(() => {
          alert('Сотрудник создан, но письмо-приглашение не отправлено. Проверьте настройки SMTP в логах сервера.')
        }, 150)
      }
    }
    setSaving(false)
  }

  async function handleToggleActive(emp: Employee) {
    await fetch(`/api/employees/${emp._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !emp.isActive }),
    })
    queryClient.invalidateQueries({ queryKey: ['employees'] })
  }

  const list = employees ?? []
  const activeEmployees = list.filter(e => e.isActive)

  function RoleBadge({ role }: { role: string }) {
    const cfg = ROLES.find(r => r.value === role)
    return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg?.color ?? 'bg-slate-100 text-slate-600')}>{cfg?.label ?? role}</span>
  }

  function salaryLabel(salary?: Employee['salary']) {
    if (!salary) return '—'
    const type = SALARY_TYPES.find(t => t.value === salary.type)?.label ?? salary.type
    if (salary.type === 'hourly') return `${type}: ${salary.hourlyRate ?? salary.value} ₽/ч`
    const suffix = salary.type.includes('percent') ? '%' : ' ₽'
    return `${type}: ${salary.value}${suffix}`
  }

  // Merge employees with their payroll records
  const payrollByUserId = new Map((payrollRecords ?? []).map(r => [r.userId, r]))

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Сотрудники</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{list.length} сотрудников</p>
        </div>
        {tab === 'employees' && (
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" />
            Добавить сотрудника
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setTab('employees')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            tab === 'employees' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Сотрудники
        </button>
        <button
          onClick={() => setTab('payroll')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            tab === 'payroll' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <DollarSign className="w-3.5 h-3.5" />
          Начисления
        </button>
      </div>

      {/* === Employees tab === */}
      {tab === 'employees' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map(emp => (
                <div key={emp._id} className={cn('bg-card border rounded-xl p-4', !emp.isActive && 'opacity-60')}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-600">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{emp.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="w-3 h-3" />
                        {emp.email}
                      </div>
                      {emp.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {emp.phone}
                        </div>
                      )}
                    </div>
                    <RoleBadge role={emp.role} />
                  </div>

                  {emp.salary && (
                    <div className="bg-muted/50 rounded-lg p-2.5 text-xs mb-3">
                      <div className="font-medium text-muted-foreground mb-0.5">Зарплата</div>
                      <div>{SALARY_TYPES.find(t => t.value === emp.salary?.type)?.label}: {emp.salary.value}{emp.salary.type.includes('percent') ? '%' : ' ₽'}</div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs">
                    {emp.isEmailVerified ? (
                      <span className="text-green-600 flex items-center gap-1"><Shield className="w-3 h-3" />Email подтверждён</span>
                    ) : (
                      <span className="text-orange-600">Email не подтверждён</span>
                    )}
                    <div className="flex-1" />
                    <button onClick={() => openEdit(emp)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition"><Edit2 className="w-3.5 h-3.5" /></button>
                    {isPrivileged && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Удалить сотрудника ${emp.name}? Это действие необратимо.`)) return
                          try {
                            const res = await fetch(`/api/employees/${emp._id}`, { method: 'DELETE' })
                            if (!res.ok) {
                              const json = await res.json().catch(() => ({}))
                              alert(json.error ?? 'Ошибка удаления сотрудника')
                              return
                            }
                            queryClient.invalidateQueries({ queryKey: ['employees'] })
                          } catch {
                            alert('Ошибка сети при удалении сотрудника')
                          }
                        }}
                        className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleToggleActive(emp)} className={cn('px-2 py-1 rounded-lg text-xs font-medium transition', emp.isActive ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200')}>
                      {emp.isActive ? 'Деактивировать' : 'Активировать'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* === Payroll tab === */}
      {tab === 'payroll' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="month"
              value={payrollMonth}
              onChange={e => setPayrollMonth(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            />
          </div>

          {payrollLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Сотрудник</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Роль</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Схема</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Часы</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Начислено</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Статус</th>
                    {isPrivileged && <th className="px-4 py-3 font-medium text-muted-foreground" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeEmployees.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Нет активных сотрудников</td>
                    </tr>
                  )}
                  {activeEmployees.map(emp => {
                    const pr = payrollByUserId.get(emp._id)
                    return (
                      <tr key={emp._id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold shrink-0">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{emp.name}</div>
                              <div className="text-xs text-muted-foreground">{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><RoleBadge role={emp.role} /></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{salaryLabel(emp.salary)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-sm">
                          {pr ? `${pr.hoursWorked ?? 0} ч` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {pr ? formatCurrency(pr.accrued) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {pr ? (
                            pr.status === 'paid' ? (
                              <span className="flex items-center gap-1 text-green-600 text-xs">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Оплачено
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-600 text-xs">
                                <Clock className="w-3.5 h-3.5" />
                                Ожидает
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">Нет данных</span>
                          )}
                        </td>
                        {isPrivileged && (
                          <td className="px-4 py-3">
                            {pr && pr.status === 'pending' && (
                              <button
                                onClick={() => setPayoutForm({ userId: emp._id, recordId: pr._id, amount: pr.accrued, notes: '' })}
                                className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2.5 py-1 rounded-lg font-medium transition"
                              >
                                Выплатить
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payout modal */}
      {payoutForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Выплата зарплаты</h2>
              <button onClick={() => setPayoutForm(null)} className="p-1.5 hover:bg-accent rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              {payoutMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {(payoutMutation.error as Error).message}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Сумма выплаты</label>
                <input
                  type="number"
                  value={payoutForm.amount}
                  onChange={e => setPayoutForm(p => p ? { ...p, amount: +e.target.value } : p)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Примечание</label>
                <input
                  type="text"
                  value={payoutForm.notes}
                  onChange={e => setPayoutForm(p => p ? { ...p, notes: e.target.value } : p)}
                  placeholder="Необязательно"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPayoutForm(null)}
                  className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={payoutMutation.isPending}
                  onClick={() => payoutMutation.mutate({ recordId: payoutForm.recordId, paid: payoutForm.amount, notes: payoutForm.notes })}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  {payoutMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">{editItem ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-accent rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Имя <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required
                  disabled={!!editItem} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Телефон</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Роль</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background">
                  {ROLES.filter(r => r.value !== 'owner').map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-sm font-medium mb-2">Зарплата и мотивация</div>
                <div className="space-y-2">
                  <select value={form.salary.type} onChange={e => setForm(p => ({ ...p, salary: { ...p.salary, type: e.target.value } }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background">
                    {SALARY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-muted-foreground mb-0.5">
                        {form.salary.type === 'hourly' ? 'Ставка (₽/ч)' : form.salary.type.includes('percent') ? 'Процент' : 'Сумма'}
                      </label>
                      <input type="number" value={form.salary.type === 'hourly' ? (form.salary.hourlyRate ?? 0) : form.salary.value}
                        onChange={e => setForm(p => ({
                          ...p,
                          salary: p.salary.type === 'hourly'
                            ? { ...p.salary, hourlyRate: +e.target.value }
                            : { ...p.salary, value: +e.target.value }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-muted-foreground mb-0.5">Гарантированный мин.</label>
                      <input type="number" value={form.salary.guaranteed ?? 0} onChange={e => setForm(p => ({ ...p, salary: { ...p.salary, guaranteed: +e.target.value } }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                    </div>
                  </div>
                  {form.salary.type === 'hourly' && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-0.5">Коэффициент сверхурочных (напр. 1.5)</label>
                      <input type="number" value={form.salary.overtimeMultiplier ?? 1}
                        onChange={e => setForm(p => ({ ...p, salary: { ...p.salary, overtimeMultiplier: +e.target.value } }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        min={1} step={0.1} />
                    </div>
                  )}
                </div>
              </div>
              {!editItem && (
                <p className="text-xs text-muted-foreground">Сотруднику будет отправлено письмо для подтверждения email и установки пароля.</p>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition">Отмена</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editItem ? 'Сохранить' : 'Пригласить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
