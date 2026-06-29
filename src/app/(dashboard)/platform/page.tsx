'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Users, Globe, RefreshCw, Loader2, Terminal,
  CheckCircle, XCircle, Calendar, Mail, ShieldOff, ShieldCheck,
  CreditCard, Star, AlertTriangle, Zap, Percent,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrgRecord {
  _id: string
  name: string
  slug: string
  dbName: string
  isActive: boolean
  email?: string
  phone?: string
  userCount: number
  createdAt: string
}

interface BillingRecord {
  _id: string
  name: string
  email?: string
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'blocked' | 'free'
  subscriptionPlan?: string
  subscriptionEndDate?: string
  trialEndDate?: string
  discountPercentage: number
  isActive: boolean
  createdAt: string
}

function billingBadge(status: BillingRecord['subscriptionStatus']) {
  switch (status) {
    case 'active':   return { label: 'Активна', cls: 'text-green-700 bg-green-50 border-green-200', icon: CheckCircle }
    case 'trial':    return { label: 'Пробный', cls: 'text-blue-700 bg-blue-50 border-blue-200', icon: Star }
    case 'free':     return { label: 'Бесплатный', cls: 'text-slate-600 bg-slate-50 border-slate-200', icon: Zap }
    case 'past_due': return { label: 'Просрочена', cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertTriangle }
    case 'blocked':  return { label: 'Заблокирована', cls: 'text-red-700 bg-red-50 border-red-200', icon: XCircle }
  }
}

function daysLeft(iso?: string) {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}

export default function PlatformPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'orgs' | 'billing' | 'logs'>('orgs')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logs, setLogs] = useState<string | null>(null)
  const [logsError, setLogsError] = useState('')

  const { data: orgs = [], isLoading, refetch, isFetching } = useQuery<OrgRecord[]>({
    queryKey: ['platform-orgs'],
    queryFn: async () => {
      const res = await fetch('/api/platform/orgs')
      if (!res.ok) throw new Error('Forbidden')
      const json = await res.json()
      return json.data ?? []
    },
    retry: false,
    refetchInterval: 30000,
  })

  const { data: billingData = [], refetch: refetchBilling, isFetching: isFetchingBilling } = useQuery<BillingRecord[]>({
    queryKey: ['platform-billing'],
    queryFn: async () => {
      const res = await fetch('/api/platform/billing/companies')
      if (!res.ok) throw new Error('Forbidden')
      const json = await res.json()
      return json.data ?? []
    },
    retry: false,
    enabled: tab === 'billing',
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch('/api/platform/orgs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      })
      if (!res.ok) throw new Error('Ошибка')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-orgs'] }),
  })

  async function fetchLogs() {
    setLogsLoading(true)
    setLogsError('')
    try {
      const res = await fetch('/api/platform/logs')
      const json = await res.json()
      if (!res.ok) { setLogsError(json.error ?? 'Ошибка'); return }
      setLogs(json.data)
    } catch {
      setLogsError('Ошибка сети')
    } finally {
      setLogsLoading(false)
    }
  }

  const activeCount = orgs.filter(o => o.isActive).length
  const totalUsers = orgs.reduce((s, o) => s + o.userCount, 0)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-500" />
            Панель управления платформой
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Список всех организаций · виден только владельцу платформы
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 border hover:bg-accent px-3 py-2 rounded-lg text-sm transition"
        >
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          Обновить
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <Building2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{orgs.length}</div>
            <div className="text-xs text-muted-foreground">Всего организаций</div>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <div className="text-xs text-muted-foreground">Пользователей</div>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Активных</div>
          </div>
        </div>
      </div>

      {/* Isolation notice */}
      <div className="mb-5 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Каждая организация работает в <strong>изолированной базе данных</strong>.
          Данные одной организации полностью недоступны для другой.
          Вы единственный, кто видит этот список.
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-5 w-fit flex-wrap">
        {(['orgs', 'billing', 'logs'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === 'logs' && !logs) fetchLogs() }}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition',
              tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'orgs' ? `Организации (${orgs.length})` : t === 'billing' ? 'Подписки' : 'Логи сервера'}
          </button>
        ))}
      </div>

      {/* Orgs tab */}
      {tab === 'orgs' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Организации не найдены</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orgs.map(org => (
                <div key={org._id} className={cn(
                  'bg-card border rounded-xl p-4 transition',
                  !org.isActive && 'opacity-60 border-dashed'
                )}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0',
                        org.isActive ? 'bg-purple-600' : 'bg-gray-400'
                      )}>
                        {org.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{org.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{org.slug}</span>
                          {org.email && (
                            <span className="flex items-center gap-1 text-xs">
                              <Mail className="w-3 h-3" />{org.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {org.isActive ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />Активна
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full">
                          <XCircle className="w-3 h-3" />Заблокирована
                        </span>
                      )}

                      <button
                        onClick={() => toggleMutation.mutate({ id: org._id, isActive: !org.isActive })}
                        disabled={toggleMutation.isPending}
                        className={cn(
                          'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition',
                          org.isActive
                            ? 'hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/30'
                            : 'hover:bg-green-50 hover:border-green-300 hover:text-green-600 dark:hover:bg-green-900/30'
                        )}
                        title={org.isActive ? 'Заблокировать организацию' : 'Разблокировать организацию'}
                      >
                        {toggleMutation.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : org.isActive
                            ? <ShieldOff className="w-3 h-3" />
                            : <ShieldCheck className="w-3 h-3" />
                        }
                        {org.isActive ? 'Заблокировать' : 'Разблокировать'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3 h-3" />{org.userCount} польз.
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(org.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                    <span className="font-mono opacity-60">БД: {org.dbName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Billing tab */}
      {tab === 'billing' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Статус подписок всех организаций</span>
            </div>
            <button
              onClick={() => refetchBilling()}
              disabled={isFetchingBilling}
              className="flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg hover:bg-accent transition"
            >
              <RefreshCw className={cn('w-3 h-3', isFetchingBilling && 'animate-spin')} />
              Обновить
            </button>
          </div>
          {isFetchingBilling ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : billingData.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Нет данных</div>
          ) : (
            <div className="space-y-3">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                {(['trial', 'active', 'free', 'past_due', 'blocked'] as const).map(s => {
                  const count = billingData.filter(b => b.subscriptionStatus === s).length
                  const cfg = billingBadge(s)
                  const Icon = cfg.icon
                  return (
                    <div key={s} className={cn('border rounded-xl p-3 text-center', cfg.cls)}>
                      <Icon className="w-4 h-4 mx-auto mb-1" />
                      <div className="text-xl font-bold">{count}</div>
                      <div className="text-xs">{cfg.label}</div>
                    </div>
                  )
                })}
              </div>

              {/* Per-org billing cards */}
              {billingData.map(org => {
                const cfg = billingBadge(org.subscriptionStatus)
                const Icon = cfg.icon
                const days = org.subscriptionStatus === 'trial'
                  ? daysLeft(org.trialEndDate)
                  : daysLeft(org.subscriptionEndDate)
                return (
                  <div key={org._id} className="bg-card border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold">{org.name}</div>
                        {org.email && <div className="text-xs text-muted-foreground mt-0.5">{org.email}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {org.discountPercentage > 0 && (
                          <span className="flex items-center gap-1 text-xs border px-2 py-1 rounded-full text-amber-600 bg-amber-50 border-amber-200">
                            <Percent className="w-3 h-3" />{org.discountPercentage}% скидка
                          </span>
                        )}
                        <span className={cn('flex items-center gap-1.5 text-xs border px-2.5 py-1 rounded-full', cfg.cls)}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {org.subscriptionPlan && (
                        <span>Тариф: <span className="font-medium">{org.subscriptionPlan}</span></span>
                      )}
                      {org.subscriptionStatus === 'trial' && org.trialEndDate && (
                        <span className={cn('flex items-center gap-1', days !== null && days <= 3 ? 'text-amber-600 font-semibold' : '')}>
                          <Calendar className="w-3 h-3" />
                          Пробный до {new Date(org.trialEndDate).toLocaleDateString('ru-RU')}
                          {days !== null && ` (${days} дн.)`}
                        </span>
                      )}
                      {org.subscriptionEndDate && org.subscriptionStatus === 'active' && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          До {new Date(org.subscriptionEndDate).toLocaleDateString('ru-RU')}
                          {days !== null && ` (${days} дн.)`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Создана {new Date(org.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">PM2 / системные логи</span>
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              className="ml-auto flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg hover:bg-accent transition"
            >
              <RefreshCw className={cn('w-3 h-3', logsLoading && 'animate-spin')} />
              Обновить
            </button>
          </div>
          {logsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logsError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{logsError}</div>
          ) : logs ? (
            <pre className="bg-gray-950 text-green-400 p-4 rounded-xl text-xs font-mono overflow-auto max-h-[60vh] leading-relaxed whitespace-pre-wrap">
              {logs}
            </pre>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Нажмите «Обновить» для загрузки логов
            </div>
          )}
        </div>
      )}
    </div>
  )
}
