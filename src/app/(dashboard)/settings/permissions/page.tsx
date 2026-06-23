'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, Users, DollarSign, Package,
  UserCog, BarChart2, ShoppingBag, Settings,
  Loader2, Save, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_PERMISSIONS, getEffectivePermissions } from '@/lib/permissions'
import type { PermissionKey } from '@/lib/permissions'

// ── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  _id: string
  name: string
  email: string
  role: string
  isActive: boolean
  permissions?: Partial<Record<PermissionKey, boolean>>
}

// ── Permission metadata ───────────────────────────────────────────────────────

const PERMISSION_META: Record<PermissionKey, { label: string; description: string }> = {
  canViewAllOrders:    { label: 'Все заказы',            description: 'Видит заказы всех мастеров' },
  canCreateOrders:     { label: 'Создание заказов',      description: 'Может создавать новые заказы' },
  canEditOrders:       { label: 'Редактирование',        description: 'Может редактировать любой заказ' },
  canDeleteOrders:     { label: 'Удаление заказов',      description: 'Может удалять заказы' },
  canChangeStatus:     { label: 'Смена статуса',         description: 'Может менять статус заказов' },
  canViewClients:      { label: 'Список клиентов',       description: 'Доступ к базе клиентов' },
  canEditClients:      { label: 'Редактирование клиентов', description: 'Может изменять данные клиентов' },
  canViewFinance:      { label: 'Финансы',               description: 'Видит финансовые показатели' },
  canManageCashRegister: { label: 'Касса',               description: 'Открывает/закрывает кассовые смены' },
  canViewWarehouse:    { label: 'Просмотр склада',       description: 'Видит остатки запчастей' },
  canManageWarehouse:  { label: 'Управление складом',    description: 'Может добавлять/списывать товары' },
  canViewEmployees:    { label: 'Список сотрудников',    description: 'Видит список коллег' },
  canManageEmployees:  { label: 'Управление сотрудниками', description: 'Может добавлять/увольнять' },
  canViewReports:      { label: 'Отчёты',                description: 'Доступ к финансовым отчётам' },
  canViewTelemetry:    { label: 'Телеметрия',            description: 'Видит аналитику и показатели' },
  canManageSettings:   { label: 'Настройки',             description: 'Может изменять настройки системы' },
  canAccessSales:      { label: 'Продажи и касса',       description: 'Доступ к кассовому модулю' },
}

interface PermissionCategory {
  label: string
  icon: React.ComponentType<{ className?: string }>
  keys: PermissionKey[]
}

const CATEGORIES: PermissionCategory[] = [
  {
    label: 'Заказы',
    icon: ClipboardList,
    keys: ['canViewAllOrders', 'canCreateOrders', 'canEditOrders', 'canDeleteOrders', 'canChangeStatus'],
  },
  {
    label: 'Клиенты',
    icon: Users,
    keys: ['canViewClients', 'canEditClients'],
  },
  {
    label: 'Финансы',
    icon: DollarSign,
    keys: ['canViewFinance', 'canManageCashRegister'],
  },
  {
    label: 'Склад',
    icon: Package,
    keys: ['canViewWarehouse', 'canManageWarehouse'],
  },
  {
    label: 'Сотрудники',
    icon: UserCog,
    keys: ['canViewEmployees', 'canManageEmployees'],
  },
  {
    label: 'Отчёты и аналитика',
    icon: BarChart2,
    keys: ['canViewReports', 'canViewTelemetry'],
  },
  {
    label: 'Продажи',
    icon: ShoppingBag,
    keys: ['canAccessSales'],
  },
  {
    label: 'Настройки',
    icon: Settings,
    keys: ['canManageSettings'],
  },
]

const ROLES: Record<string, { label: string; color: string }> = {
  owner:   { label: 'Владелец',        color: 'bg-purple-100 text-purple-700' },
  admin:   { label: 'Администратор',   color: 'bg-blue-100 text-blue-700' },
  manager: { label: 'Менеджер',        color: 'bg-green-100 text-green-700' },
  master:  { label: 'Мастер',          color: 'bg-orange-100 text-orange-700' },
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0',
        checked ? 'bg-blue-600' : 'bg-slate-200',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Partial<Record<PermissionKey, boolean>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedOk, setSavedOk] = useState(false)

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      const json = await res.json()
      return json.data as Employee[]
    },
  })

  const selected = employees?.find(e => e._id === selectedId) ?? null
  const isReadOnly = selected?.role === 'owner' || selected?.role === 'admin'

  // Compute effective permissions for the selected employee
  const effective = selected
    ? getEffectivePermissions({ role: selected.role, permissions: overrides })
    : null

  function handleSelect(emp: Employee) {
    setSelectedId(emp._id)
    setOverrides(emp.permissions ?? {})
    setSaveError('')
    setSavedOk(false)
  }

  function handleToggle(key: PermissionKey, value: boolean) {
    const defaults = DEFAULT_PERMISSIONS[selected!.role] ?? DEFAULT_PERMISSIONS.master
    // Only store overrides that differ from the role default
    setOverrides(prev => {
      const next = { ...prev, [key]: value }
      // Clean up entries that match the default to keep the stored object minimal
      if (next[key] === defaults[key]) {
        const cleaned = { ...next }
        delete cleaned[key]
        return cleaned
      }
      return next
    })
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setSaveError('')
    setSavedOk(false)
    try {
      const res = await fetch(`/api/employees/${selected._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: overrides }),
      })
      if (!res.ok) {
        const json = await res.json()
        setSaveError(json.error ?? 'Ошибка сохранения')
      } else {
        queryClient.invalidateQueries({ queryKey: ['employees'] })
        setSavedOk(true)
        setTimeout(() => setSavedOk(false), 2500)
      }
    } catch {
      setSaveError('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Права доступа сотрудников</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Настройте индивидуальные права для каждого сотрудника
        </p>
      </div>

      <div className="flex gap-4 items-start">
        {/* Employee list */}
        <div className="w-56 shrink-0 bg-card border rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Сотрудники
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {(employees ?? []).map(emp => {
                const roleCfg = ROLES[emp.role]
                return (
                  <button
                    key={emp._id}
                    onClick={() => handleSelect(emp)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg transition-colors',
                      selectedId === emp._id
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-accent',
                      !emp.isActive && 'opacity-50'
                    )}
                  >
                    <div className={cn(
                      'font-medium text-sm truncate',
                      selectedId === emp._id ? 'text-white' : ''
                    )}>
                      {emp.name}
                    </div>
                    <div className="mt-0.5">
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full font-medium',
                        selectedId === emp._id
                          ? 'bg-white/20 text-white'
                          : (roleCfg?.color ?? 'bg-slate-100 text-slate-600')
                      )}>
                        {roleCfg?.label ?? emp.role}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="bg-card border rounded-xl flex items-center justify-center py-24 text-muted-foreground text-sm">
              Выберите сотрудника слева
            </div>
          ) : (
            <div className="bg-card border rounded-xl">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div>
                  <div className="font-semibold">{selected.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{selected.email}</div>
                </div>
                {!isReadOnly && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    {saving
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />
                    }
                    {savedOk ? 'Сохранено!' : 'Сохранить'}
                  </button>
                )}
              </div>

              {/* Read-only notice for owner/admin */}
              {isReadOnly && (
                <div className="flex items-center gap-2.5 mx-5 mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Права доступа для роли «{ROLES[selected.role]?.label}» управляются системой и не редактируются вручную.
                  </span>
                </div>
              )}

              {saveError && (
                <div className="mx-5 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {saveError}
                </div>
              )}

              {/* Permission categories */}
              <div className="p-5 space-y-5">
                {CATEGORIES.map(category => (
                  <div key={category.label}>
                    <div className="flex items-center gap-2 mb-3">
                      <category.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{category.label}</span>
                    </div>
                    <div className="border rounded-lg divide-y">
                      {category.keys.map(key => {
                        const meta = PERMISSION_META[key]
                        const value = effective ? effective[key] : false
                        return (
                          <div key={key} className="flex items-center justify-between px-4 py-3 gap-4">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{meta.label}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
                            </div>
                            <Toggle
                              checked={value}
                              onChange={v => handleToggle(key, v)}
                              disabled={isReadOnly}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
