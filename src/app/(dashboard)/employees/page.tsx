'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Plus, Mail, Phone, Shield, Loader2, X, Edit2, DollarSign, CheckCircle, Clock, Trash2, Camera, Eye, EyeOff, Copy, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import {
  makeRule,
  ruleLabel,
  SOURCE_LABELS,
  METHOD_LABELS,
  PERCENT_SOURCES,
  FIXED_ONLY_SOURCES,
  type SalaryRule,
  type SalarySource,
  type SalaryMethod,
} from '@/lib/salary'

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
  avatar?: string
  isActive: boolean
  isEmailVerified: boolean
  salary?: {
    type?: string
    value?: number
    hourlyRate?: number
    overtimeMultiplier?: number
    guaranteed?: number
    rules?: SalaryRule[]
  }
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

function FlexRuleRow({
  rule,
  onChange,
  onRemove,
  canRemove,
}: {
  rule: SalaryRule
  onChange: (r: SalaryRule) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const isFixedOnly = FIXED_ONLY_SOURCES.includes(rule.source)
  const effectiveMethod: SalaryMethod = isFixedOnly ? 'fixed' : rule.method

  function setSource(src: SalarySource) {
    const newMethod: SalaryMethod = FIXED_ONLY_SOURCES.includes(src) ? 'fixed' : rule.method
    onChange({ ...rule, source: src, method: newMethod, categories: src === 'services_category' ? (rule.categories ?? []) : undefined })
  }

  return (
    <div className="border rounded-lg p-2.5 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2">
        {/* Source */}
        <select
          value={rule.source}
          onChange={e => setSource(e.target.value as SalarySource)}
          className="flex-1 px-2 py-1.5 border rounded-md text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-background"
        >
          {(Object.keys(SOURCE_LABELS) as SalarySource[]).map(s => (
            <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
          ))}
        </select>

        {/* Method (shown only for percent sources) */}
        {!isFixedOnly && (
          <select
            value={effectiveMethod}
            onChange={e => onChange({ ...rule, method: e.target.value as SalaryMethod })}
            className="flex-1 px-2 py-1.5 border rounded-md text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-background"
          >
            {(Object.keys(METHOD_LABELS) as SalaryMethod[]).map(m => (
              <option key={m} value={m}>{METHOD_LABELS[m]}</option>
            ))}
          </select>
        )}

        {/* Value */}
        <div className="relative w-24 shrink-0">
          <input
            type="number"
            value={rule.value}
            onChange={e => onChange({ ...rule, value: +e.target.value })}
            className="w-full px-2 py-1.5 pr-6 border rounded-md text-xs outline-none focus:ring-2 focus:ring-blue-500"
            min={0}
            step={isFixedOnly || effectiveMethod === 'fixed' ? 100 : 0.5}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {isFixedOnly || effectiveMethod === 'fixed' ? '₽' : '%'}
          </span>
        </div>

        {/* Enabled toggle */}
        <button
          type="button"
          onClick={() => onChange({ ...rule, enabled: !rule.enabled })}
          className={cn('text-xs px-2 py-1.5 rounded-md border font-medium transition-colors shrink-0', rule.enabled ? 'bg-green-50 border-green-300 text-green-700' : 'bg-muted border-border text-muted-foreground')}
          title={rule.enabled ? 'Отключить' : 'Включить'}
        >
          {rule.enabled ? 'Вкл' : 'Выкл'}
        </button>

        {/* Remove */}
        {canRemove && (
          <button type="button" onClick={onRemove} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Categories (for services_category) */}
      {rule.source === 'services_category' && (
        <div>
          <input
            type="text"
            value={(rule.categories ?? []).join(', ')}
            onChange={e => onChange({
              ...rule,
              categories: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
            })}
            placeholder="Категории через запятую: Пайка, Замена стекла"
            className="w-full px-2 py-1.5 border rounded-md text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Human-readable label */}
      <div className="text-xs text-muted-foreground">{ruleLabel(rule)}</div>
    </div>
  )
}

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

  // Flex salary state
  const [salaryMode, setSalaryMode] = useState<'legacy' | 'flex'>('legacy')
  const [flexGuaranteed, setFlexGuaranteed] = useState(0)
  const [flexRules, setFlexRules] = useState<SalaryRule[]>([makeRule()])

  // Password setup state
  const [accessMode, setAccessMode] = useState<'email' | 'manual'>('email')
  const [manualPw, setManualPw] = useState('')
  const [manualPwConfirm, setManualPwConfirm] = useState('')
  const [showManualPw, setShowManualPw] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; password: string } | null>(null)

  function generatePassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#'
    const digits = '23456789'
    let pw = ''
    // ensure at least 2 digits and 2 uppercase
    pw += digits[Math.floor(Math.random() * digits.length)]
    pw += digits[Math.floor(Math.random() * digits.length)]
    pw += 'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random() * 22)]
    for (let i = pw.length; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)]
    // shuffle
    const arr = pw.split('').sort(() => Math.random() - 0.5)
    setManualPw(arr.join(''))
    setManualPwConfirm(arr.join(''))
    setShowManualPw(true)
  }

  function pwStrength(pw: string): { score: number; label: string; color: string } {
    let s = 0
    if (pw.length >= 8) s++
    if (pw.length >= 12) s++
    if (/[A-Z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    if (s <= 1) return { score: s, label: 'Слабый', color: 'bg-red-500' }
    if (s <= 2) return { score: s, label: 'Средний', color: 'bg-amber-500' }
    if (s <= 3) return { score: s, label: 'Хороший', color: 'bg-yellow-400' }
    return { score: s, label: 'Надёжный', color: 'bg-green-500' }
  }

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
    setSalaryMode('legacy')
    setFlexGuaranteed(0)
    setFlexRules([makeRule()])
    setAccessMode('email')
    setManualPw('')
    setManualPwConfirm('')
    setShowManualPw(false)
    setShowForm(true)
  }

  function openEdit(e: Employee) {
    setEditItem(e)
    const hasFlex = Array.isArray(e.salary?.rules) && e.salary!.rules!.length > 0
    if (hasFlex) {
      setSalaryMode('flex')
      setFlexGuaranteed(e.salary?.guaranteed ?? 0)
      setFlexRules(e.salary!.rules!)
    } else {
      setSalaryMode('legacy')
      setFlexGuaranteed(0)
      setFlexRules([makeRule()])
    }
    setForm({
      name: e.name, email: e.email, role: e.role, phone: e.phone ?? '',
      salary: {
        type: e.salary?.type ?? 'percent_revenue',
        value: e.salary?.value ?? 20,
        hourlyRate: e.salary?.hourlyRate ?? 0,
        overtimeMultiplier: e.salary?.overtimeMultiplier ?? 1,
        guaranteed: e.salary?.guaranteed ?? 0,
      },
    })
    setError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!editItem && accessMode === 'manual') {
      if (manualPw.length < 8) { setError('Минимум 8 символов'); return }
      if (!/[A-Za-z]/.test(manualPw) || !/[0-9]/.test(manualPw)) { setError('Пароль должен содержать буквы и цифры'); return }
      if (manualPw !== manualPwConfirm) { setError('Пароли не совпадают'); return }
    }

    setSaving(true)
    setError('')
    const url = editItem ? `/api/employees/${editItem._id}` : '/api/employees'
    const method = editItem ? 'PATCH' : 'POST'

    const salaryPayload = salaryMode === 'flex'
      ? { guaranteed: flexGuaranteed, rules: flexRules }
      : form.salary

    const basePayload = { ...form, salary: salaryPayload }
    const payload = editItem
      ? basePayload
      : accessMode === 'manual'
        ? { ...basePayload, password: manualPw }
        : basePayload

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Ошибка')
    } else {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setShowForm(false)
      if (!editItem && json.data?.manualPassword) {
        setCreatedCredentials({ name: form.name, email: form.email, password: manualPw })
      } else if (!editItem && json.data?.emailSent === false) {
        setTimeout(() => {
          alert('Сотрудник создан, но письмо-приглашение не отправлено. Проверьте настройки SMTP.')
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

  async function handleAvatarUpload(emp: Employee, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload?type=avatar', { method: 'POST', body: formData })
    const json = await res.json()
    if (!res.ok || !json.success) { alert(json.error ?? 'Ошибка загрузки'); return }
    await fetch(`/api/employees/${emp._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: json.data.url }),
    })
    queryClient.invalidateQueries({ queryKey: ['employees'] })
  }

  function AvatarCell({ emp }: { emp: Employee }) {
    const fileRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    return (
      <div className="relative w-10 h-10 shrink-0 group">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async e => {
            const file = e.target.files?.[0]
            if (!file) return
            setUploading(true)
            await handleAvatarUpload(emp, file)
            setUploading(false)
            e.target.value = ''
          }}
        />
        {emp.avatar ? (
          <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-full object-cover border" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-600">
            {emp.name.charAt(0).toUpperCase()}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        </button>
      </div>
    )
  }

  const list = employees ?? []
  const activeEmployees = list.filter(e => e.isActive)

  function RoleBadge({ role }: { role: string }) {
    const cfg = ROLES.find(r => r.value === role)
    return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg?.color ?? 'bg-slate-100 text-slate-600')}>{cfg?.label ?? role}</span>
  }

  function salaryLabel(salary?: Employee['salary']) {
    if (!salary) return '—'
    if (Array.isArray(salary.rules) && salary.rules.length > 0) {
      return `Гибкая (${salary.rules.length} правил${salary.rules.length === 1 ? 'о' : salary.rules.length < 5 ? 'а' : ''})`
    }
    if (!salary.type) return '—'
    const type = SALARY_TYPES.find(t => t.value === salary.type)?.label ?? salary.type
    if (salary.type === 'hourly') return `${type}: ${salary.hourlyRate ?? salary.value} ₽/ч`
    const suffix = salary.type?.includes('percent') ? '%' : ' ₽'
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
                    <AvatarCell emp={emp} />
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
                      <div>{salaryLabel(emp.salary)}</div>
                    </div>
                  )}

                  {/* Email status row */}
                  <div className="text-xs mb-2">
                    {emp.isEmailVerified ? (
                      <span className="text-green-600 flex items-center gap-1"><Shield className="w-3 h-3" />Email подтверждён</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 text-orange-600">
                        <span>Email не подтверждён</span>
                        <button
                          title="Отправить приглашение повторно"
                          className="text-blue-600 hover:text-blue-800 underline text-xs"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const res = await fetch(`/api/employees/${emp._id}/resend-invite`, { method: 'POST' })
                              if (res.ok) alert(`Приглашение повторно отправлено на ${emp.email}`)
                              else { const j = await res.json(); alert(j.error ?? 'Ошибка') }
                            } catch { alert('Ошибка сети') }
                          }}
                        >
                          Отправить повторно
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Action buttons row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => openEdit(emp)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition" title="Редактировать"><Edit2 className="w-3.5 h-3.5" /></button>
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
                    <div className="flex-1" />
                    <button onClick={() => handleToggleActive(emp)} className={cn('px-2 py-1 rounded-lg text-xs font-medium transition shrink-0', emp.isActive ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200')}>
                      {emp.isActive ? 'Деактив.' : 'Активир.'}
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

      {/* Credentials modal (manual password) */}
      {createdCredentials && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5 text-center border-b">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="font-bold text-lg">Сотрудник создан!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Передайте данные для входа сотруднику лично. Пароль показывается только один раз.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Сотрудник:</span>
                  <span className="font-medium">{createdCredentials.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Логин (email):</span>
                  <span className="font-mono text-xs">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Пароль:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600">{createdCredentials.password}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(createdCredentials.password)}
                      className="text-muted-foreground hover:text-foreground transition"
                      title="Скопировать"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                ⚠️ Сохраните пароль — после закрытия этого окна он не будет показан снова.
              </div>
            </div>
            <div className="p-5 pt-0">
              <button
                onClick={() => setCreatedCredentials(null)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
              >
                Понятно, закрыть
              </button>
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
              {/* Salary section */}
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Зарплата и мотивация</div>
                  <div className="flex bg-muted rounded-lg p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSalaryMode('legacy')}
                      className={cn('px-2.5 py-1 rounded-md font-medium transition-colors', salaryMode === 'legacy' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                      Простая
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalaryMode('flex')}
                      className={cn('px-2.5 py-1 rounded-md font-medium transition-colors', salaryMode === 'flex' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                      Гибкая
                    </button>
                  </div>
                </div>

                {/* Legacy mode */}
                {salaryMode === 'legacy' && (
                  <div className="space-y-2">
                    <select value={form.salary.type} onChange={e => setForm(p => ({ ...p, salary: { ...p.salary, type: e.target.value } }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background">
                      {SALARY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground mb-0.5">
                          {form.salary.type === 'hourly' ? 'Ставка (₽/ч)' : form.salary.type?.includes('percent') ? 'Процент' : 'Сумма'}
                        </label>
                        <input
                          type="number"
                          value={form.salary.type === 'hourly' ? (form.salary.hourlyRate ?? 0) : form.salary.value}
                          onChange={e => setForm(p => ({
                            ...p,
                            salary: p.salary.type === 'hourly'
                              ? { ...p.salary, hourlyRate: +e.target.value }
                              : { ...p.salary, value: +e.target.value },
                          }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          min={0}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground mb-0.5">Гарантированный мин.</label>
                        <input
                          type="number"
                          value={form.salary.guaranteed ?? 0}
                          onChange={e => setForm(p => ({ ...p, salary: { ...p.salary, guaranteed: +e.target.value } }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          min={0}
                        />
                      </div>
                    </div>
                    {form.salary.type === 'hourly' && (
                      <div>
                        <label className="block text-xs text-muted-foreground mb-0.5">Коэффициент сверхурочных (напр. 1.5)</label>
                        <input
                          type="number"
                          value={form.salary.overtimeMultiplier ?? 1}
                          onChange={e => setForm(p => ({ ...p, salary: { ...p.salary, overtimeMultiplier: +e.target.value } }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          min={1} step={0.1}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Flex mode */}
                {salaryMode === 'flex' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-0.5">Гарантированный минимум ₽</label>
                      <input
                        type="number"
                        value={flexGuaranteed}
                        onChange={e => setFlexGuaranteed(+e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        min={0}
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Правила начисления</div>
                      {flexRules.map((rule, idx) => (
                        <FlexRuleRow
                          key={rule.id}
                          rule={rule}
                          onChange={updated => setFlexRules(prev => prev.map((r, i) => i === idx ? updated : r))}
                          onRemove={() => setFlexRules(prev => prev.filter((_, i) => i !== idx))}
                          canRemove={flexRules.length > 1}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setFlexRules(prev => [...prev, makeRule()])}
                      className="w-full py-1.5 border border-dashed border-blue-300 text-blue-600 text-xs rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Добавить правило
                    </button>

                    {flexRules.length > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                        Итог = сумма всех правил. Если меньше гарантированного — выплачивается гарантированный минимум.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!editItem && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="text-sm font-medium px-3 pt-3 pb-2">Способ доступа</div>
                  <div className="flex border-b">
                    {[
                      { value: 'email', label: '📧 Письмо-приглашение' },
                      { value: 'manual', label: '🔑 Задать пароль вручную' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAccessMode(opt.value as 'email' | 'manual')}
                        className={`flex-1 py-2 text-xs font-medium transition ${accessMode === opt.value ? 'bg-blue-600 text-white' : 'hover:bg-accent text-muted-foreground'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="p-3">
                    {accessMode === 'email' ? (
                      <p className="text-xs text-muted-foreground">
                        Сотруднику придёт письмо со ссылкой. Он сам установит пароль при первом входе.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          Вы задаёте пароль и передаёте его сотруднику лично. Письмо-приглашение не отправляется.
                        </p>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium">Пароль</label>
                            <button type="button" onClick={generatePassword} className="text-xs text-blue-600 hover:underline">
                              Сгенерировать
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type={showManualPw ? 'text' : 'password'}
                              value={manualPw}
                              onChange={e => setManualPw(e.target.value)}
                              className="w-full px-3 py-2 pr-9 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                              placeholder="Минимум 8 символов"
                              autoComplete="new-password"
                              required={accessMode === 'manual'}
                            />
                            <button type="button" onClick={() => setShowManualPw(v => !v)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showManualPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {manualPw && (() => {
                            const s = pwStrength(manualPw)
                            return (
                              <div className="mt-1.5">
                                <div className="flex gap-1">
                                  {[1,2,3,4].map(i => (
                                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${s.score >= i ? s.color : 'bg-slate-200'}`} />
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                              </div>
                            )
                          })()}
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Подтвердите пароль</label>
                          <input
                            type={showManualPw ? 'text' : 'password'}
                            value={manualPwConfirm}
                            onChange={e => setManualPwConfirm(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono ${manualPwConfirm && manualPw !== manualPwConfirm ? 'border-red-300' : ''}`}
                            placeholder="Повторите пароль"
                            autoComplete="new-password"
                          />
                          {manualPwConfirm && manualPw !== manualPwConfirm && (
                            <p className="text-xs text-red-500 mt-0.5">Пароли не совпадают</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition">Отмена</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editItem ? 'Сохранить' : accessMode === 'email' ? 'Пригласить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
