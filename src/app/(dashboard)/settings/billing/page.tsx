'use client'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, CheckCircle, XCircle, Clock, AlertTriangle,
  Star, Zap, Crown, RefreshCw, Loader2, Calendar, Percent,
  Building2, Edit2, Save, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

// ─── types ───────────────────────────────────────────────────────────────────

type SubStatus = 'trial' | 'active' | 'past_due' | 'blocked' | 'free'

interface CompanyBilling {
  subscriptionStatus: SubStatus
  subscriptionPlan?: string
  subscriptionEndDate?: string
  trialEndDate?: string
  pastDueUntil?: string
  discountPercentage: number
}

interface ActiveSubscription {
  planSlug: string
  billingPeriod: 'monthly' | 'yearly'
  startDate: string
  endDate: string
  autoRenew: boolean
  finalAmount: number
}

interface Plan {
  slug: string
  name: string
  priceMonthly: number
  priceYearly: number
  maxUsers: number
  maxLocations: number
  features: string[]
}

interface ManagedOrg {
  _id: string
  name: string
  email?: string
  subscriptionStatus: SubStatus
  subscriptionPlan?: string
  subscriptionEndDate?: string
  trialEndDate?: string
  discountPercentage: number
  isActive: boolean
  createdAt: string
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_OWNER_EMAIL = process.env.NEXT_PUBLIC_PLATFORM_OWNER_EMAIL

function statusCfg(s: SubStatus | string | undefined) {
  switch (s) {
    case 'active':   return { label: 'Активна',          cls: 'text-green-700 bg-green-50 border-green-200',   icon: CheckCircle  }
    case 'trial':    return { label: 'Пробный период',   cls: 'text-blue-700 bg-blue-50 border-blue-200',      icon: Star         }
    case 'free':     return { label: 'Бесплатный',       cls: 'text-slate-600 bg-slate-50 border-slate-200',   icon: Zap          }
    case 'past_due': return { label: 'Просрочена',       cls: 'text-amber-700 bg-amber-50 border-amber-200',   icon: AlertTriangle}
    case 'blocked':  return { label: 'Заблокирована',    cls: 'text-red-700 bg-red-50 border-red-200',         icon: XCircle      }
    default:         return { label: 'Пробный период',   cls: 'text-blue-700 bg-blue-50 border-blue-200',      icon: Star         }
  }
}

function fmt(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysLeft(iso?: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}

// ─── Platform owner view ─────────────────────────────────────────────────────

function OrgEditRow({ org, onSaved }: { org: ManagedOrg; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<SubStatus>(org.subscriptionStatus)
  const [discount, setDiscount] = useState(String(org.discountPercentage ?? 0))
  const [trialEnd, setTrialEnd] = useState(org.trialEndDate ? org.trialEndDate.slice(0, 10) : '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const cfg = statusCfg(org.subscriptionStatus)
  const Icon = cfg.icon
  const days = org.subscriptionStatus === 'trial' ? daysLeft(org.trialEndDate) : daysLeft(org.subscriptionEndDate)

  async function save() {
    setSaving(true)
    setErr('')
    try {
      const discountNum = Number(discount)
      if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
        setErr('Скидка должна быть числом от 0 до 100')
        setSaving(false)
        return
      }
      const body: Record<string, unknown> = { subscriptionStatus: status, discountPercentage: discountNum }
      if (trialEnd) body.trialEndDate = new Date(trialEnd).toISOString()
      const res = await fetch(`/api/platform/billing/companies/${org._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json(); setErr(j.error ?? 'Ошибка'); return }
      setEditing(false)
      onSaved()
    } catch { setErr('Ошибка сети') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center font-bold text-purple-700 shrink-0">
            {org.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{org.name}</div>
            {org.email && <div className="text-xs text-muted-foreground truncate">{org.email}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!editing && (
            <span className={cn('flex items-center gap-1.5 text-xs border px-2.5 py-1 rounded-full', cfg.cls)}>
              <Icon className="w-3 h-3" />{cfg.label}
            </span>
          )}
          {!editing && org.discountPercentage > 0 && (
            <span className="flex items-center gap-1 text-xs border px-2 py-1 rounded-full text-amber-700 bg-amber-50 border-amber-200">
              <Percent className="w-3 h-3" />{org.discountPercentage}%
            </span>
          )}
          <button
            onClick={() => { setEditing(e => !e); setErr('') }}
            className="p-1.5 rounded-lg border hover:bg-accent transition text-xs"
            title={editing ? 'Отмена' : 'Редактировать'}
          >
            {editing ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!editing && (
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {org.subscriptionStatus === 'trial' && org.trialEndDate && (
            <span className={cn('flex items-center gap-1', days !== null && days <= 3 ? 'text-amber-600 font-semibold' : '')}>
              <Clock className="w-3 h-3" />Пробный до {new Date(org.trialEndDate).toLocaleDateString('ru-RU')}
              {days !== null && ` (${days} дн.)`}
            </span>
          )}
          {org.subscriptionStatus === 'active' && org.subscriptionEndDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />До {new Date(org.subscriptionEndDate).toLocaleDateString('ru-RU')}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />Создана {new Date(org.createdAt).toLocaleDateString('ru-RU')}
          </span>
        </div>
      )}

      {editing && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Статус подписки</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as SubStatus)}
                className="w-full text-sm px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              >
                <option value="trial">Пробный период</option>
                <option value="active">Активна (оплачена)</option>
                <option value="free">Бесплатный</option>
                <option value="past_due">Просрочена</option>
                <option value="blocked">Заблокирована</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Скидка (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-full text-sm px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">100% = полностью бесплатно</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Конец пробного / триала</label>
              <input
                type="date"
                value={trialEnd}
                onChange={e => setTrialEnd(e.target.value)}
                className="w-full text-sm px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              />
            </div>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border rounded-lg hover:bg-accent transition"
            >
              <X className="w-3.5 h-3.5" />Отмена
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PlatformBillingView() {
  const queryClient = useQueryClient()

  const { data: orgs = [], isLoading, refetch, isFetching } = useQuery<ManagedOrg[]>({
    queryKey: ['platform-billing-orgs'],
    queryFn: async () => {
      const res = await fetch('/api/platform/billing/companies')
      const j = await res.json()
      if (!j.success) throw new Error(j.error)
      return j.data ?? []
    },
  })

  const counts = {
    trial: orgs.filter(o => o.subscriptionStatus === 'trial').length,
    active: orgs.filter(o => o.subscriptionStatus === 'active').length,
    free: orgs.filter(o => o.subscriptionStatus === 'free').length,
    past_due: orgs.filter(o => o.subscriptionStatus === 'past_due').length,
    blocked: orgs.filter(o => o.subscriptionStatus === 'blocked').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Управление подписками
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Все организации платформы · настройка статуса, скидок, бесплатного доступа
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

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(['trial', 'active', 'free', 'past_due', 'blocked'] as SubStatus[]).map(s => {
          const cfg = statusCfg(s)
          const Ic = cfg.icon
          return (
            <div key={s} className={cn('border rounded-xl p-3 text-center', cfg.cls)}>
              <Ic className="w-4 h-4 mx-auto mb-1" />
              <div className="text-xl font-bold">{counts[s as keyof typeof counts]}</div>
              <div className="text-xs">{cfg.label}</div>
            </div>
          )
        })}
      </div>

      {/* Org list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Организации не найдены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orgs.map(org => (
            <OrgEditRow
              key={org._id}
              org={org}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['platform-billing-orgs'] })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tenant billing view ──────────────────────────────────────────────────────

function TenantBillingView() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    company: CompanyBilling
    subscription: ActiveSubscription | null
  }>({
    queryKey: ['billing-subscription'],
    queryFn: async () => {
      const res = await fetch('/api/billing/subscription')
      const j = await res.json()
      if (!j.success) throw new Error(j.error)
      return j.data
    },
    staleTime: 60_000,
  })

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const res = await fetch('/api/billing/plans')
      const j = await res.json()
      return j.data ?? []
    },
    staleTime: 300_000,
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  }

  const company = data?.company
  const subscription = data?.subscription
  const status = company?.subscriptionStatus ?? 'trial'
  const cfg = statusCfg(status)
  const StatusIcon = cfg.icon
  const trialDays = daysLeft(company?.trialEndDate)
  const endDays = daysLeft(company?.subscriptionEndDate)
  const urgentDays = status === 'trial' ? trialDays : endDays

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-500" />
            Подписка и оплата
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Управление тарифом и статусом подписки</p>
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

      {/* Status card */}
      <div className={cn('border rounded-2xl p-5', cfg.cls)}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <StatusIcon className="w-7 h-7 shrink-0" />
            <div>
              <div className="font-semibold text-lg">{cfg.label}</div>
              {subscription?.planSlug && (
                <div className="text-sm opacity-80 mt-0.5">
                  Тариф: <span className="font-medium">{subscription.planSlug}</span>
                  {subscription.billingPeriod === 'yearly' && ' · годовая оплата'}
                </div>
              )}
            </div>
          </div>
          {(company?.discountPercentage ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 bg-white/60 border border-current/20 px-3 py-1.5 rounded-full text-sm font-semibold">
              <Percent className="w-3.5 h-3.5" />
              Скидка {company?.discountPercentage}%
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {status === 'trial' && company?.trialEndDate && (
            <div className="bg-white/50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs opacity-70 mb-1"><Clock className="w-3 h-3" />Пробный период до</div>
              <div className="font-semibold">{fmt(company?.trialEndDate)}</div>
              {trialDays !== null && (
                <div className={cn('text-sm mt-0.5', trialDays <= 3 ? 'font-bold' : 'opacity-70')}>
                  {trialDays === 0 ? 'Сегодня последний день' : `Осталось ${trialDays} дн.`}
                </div>
              )}
            </div>
          )}
          {subscription?.endDate && (
            <div className="bg-white/50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs opacity-70 mb-1"><Calendar className="w-3 h-3" />Подписка до</div>
              <div className="font-semibold">{fmt(subscription.endDate)}</div>
              {endDays !== null && <div className="text-sm mt-0.5 opacity-70">{endDays === 0 ? 'Сегодня последний день' : `Осталось ${endDays} дн.`}</div>}
            </div>
          )}
          {subscription?.finalAmount !== undefined && (
            <div className="bg-white/50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs opacity-70 mb-1"><CreditCard className="w-3 h-3" />Стоимость</div>
              <div className="font-semibold">
                {subscription.finalAmount.toLocaleString('ru-RU')} ₽
                <span className="font-normal opacity-70 text-sm">/{subscription.billingPeriod === 'yearly' ? 'год' : 'мес'}</span>
              </div>
            </div>
          )}
        </div>

        {urgentDays !== null && urgentDays <= 5 && urgentDays > 0 && (
          <div className="mt-4 bg-white/60 border border-current/20 rounded-xl p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {status === 'trial'
              ? `Пробный период заканчивается через ${urgentDays} дн.`
              : `Подписка истекает через ${urgentDays} дн. Продлите её, чтобы не прерывать работу.`}
          </div>
        )}
        {status === 'blocked' && (
          <div className="mt-4 bg-white/60 border border-current/20 rounded-xl p-3 text-sm">
            Доступ к системе ограничен. Для восстановления обратитесь в поддержку.
          </div>
        )}
        {status === 'past_due' && company?.pastDueUntil && (
          <div className="mt-4 bg-white/60 border border-current/20 rounded-xl p-3 text-sm">
            Оплата просрочена. Доступ будет заблокирован {fmt(company?.pastDueUntil)}.
          </div>
        )}
      </div>

      {status === 'free' && (
        <div className="bg-card border rounded-2xl p-5 flex items-start gap-3">
          <Zap className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Бесплатный доступ</div>
            <p className="text-sm text-muted-foreground mt-1">
              Ваша организация пользуется ServiceBox CRM бесплатно.
              {(company?.discountPercentage ?? 0) === 100 && ' Скидка 100% применена администратором платформы.'}
            </p>
          </div>
        </div>
      )}

      {plans.length > 0 && status !== 'active' && (
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            Доступные тарифы
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.map(plan => (
              <div key={plan.slug} className="bg-card border rounded-2xl p-4 flex flex-col gap-3">
                <div>
                  <div className="font-semibold">{plan.name}</div>
                  <div className="text-2xl font-bold mt-1">
                    {plan.priceMonthly.toLocaleString('ru-RU')} ₽<span className="text-sm font-normal text-muted-foreground">/мес</span>
                  </div>
                  {plan.priceYearly > 0 && <div className="text-xs text-muted-foreground">или {plan.priceYearly.toLocaleString('ru-RU')} ₽/год</div>}
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground flex-1">
                  <li>До {plan.maxUsers} пользователей</li>
                  <li>До {plan.maxLocations} локаций</li>
                  {(plan.features ?? []).slice(0, 3).map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500 shrink-0" />{f}</li>
                  ))}
                </ul>
                <a
                  href={`mailto:${PLATFORM_OWNER_EMAIL}?subject=Оформление тарифа ${plan.name}&body=Здравствуйте! Хочу подключить тариф ${plan.name} для моей организации.`}
                  className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg transition"
                >
                  Подключить
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-muted/40 rounded-2xl p-4 text-sm text-muted-foreground">
        По вопросам оплаты и тарифов обращайтесь:{' '}
        <a href={`mailto:${PLATFORM_OWNER_EMAIL}`} className="text-blue-600 hover:underline font-medium">
          {PLATFORM_OWNER_EMAIL}
        </a>
      </div>
    </div>
  )
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {session?.user?.isPlatformOwner ? <PlatformBillingView /> : <TenantBillingView />}
    </div>
  )
}
