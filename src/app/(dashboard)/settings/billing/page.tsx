'use client'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard, CheckCircle, XCircle, Clock, AlertTriangle,
  Star, Zap, Crown, RefreshCw, Loader2, Calendar, Percent,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'blocked' | 'free'

interface CompanyBilling {
  subscriptionStatus: SubscriptionStatus
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

function statusConfig(status: SubscriptionStatus) {
  switch (status) {
    case 'active':
      return { label: 'Активна', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle }
    case 'trial':
      return { label: 'Пробный период', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Star }
    case 'free':
      return { label: 'Бесплатный', color: 'text-slate-600 bg-slate-50 border-slate-200', icon: Zap }
    case 'past_due':
      return { label: 'Просрочена оплата', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertTriangle }
    case 'blocked':
      return { label: 'Заблокирована', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle }
  }
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysLeft(iso?: string): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}

export default function BillingPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    company: CompanyBilling
    subscription: ActiveSubscription | null
  }>({
    queryKey: ['billing-subscription'],
    queryFn: async () => {
      const res = await fetch('/api/billing/subscription')
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    staleTime: 60_000,
  })

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const res = await fetch('/api/billing/plans')
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 300_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const company = data?.company
  const subscription = data?.subscription
  const status = company?.subscriptionStatus ?? 'trial'
  const cfg = statusConfig(status)
  const StatusIcon = cfg.icon

  const trialDays = daysLeft(company?.trialEndDate)
  const endDays = daysLeft(company?.subscriptionEndDate)
  const urgentDays = status === 'trial' ? trialDays : endDays

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
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
      <div className={cn('border rounded-2xl p-5', cfg.color)}>
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
              Скидка {company.discountPercentage}%
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {status === 'trial' && company?.trialEndDate && (
            <div className="bg-white/50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                <Clock className="w-3 h-3" />
                Пробный период до
              </div>
              <div className="font-semibold">{formatDate(company.trialEndDate)}</div>
              {trialDays !== null && (
                <div className={cn('text-sm mt-0.5', trialDays <= 3 ? 'font-bold' : 'opacity-70')}>
                  {trialDays === 0 ? 'Сегодня последний день' : `Осталось ${trialDays} дн.`}
                </div>
              )}
            </div>
          )}
          {subscription?.endDate && (
            <div className="bg-white/50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                <Calendar className="w-3 h-3" />
                Подписка действует до
              </div>
              <div className="font-semibold">{formatDate(subscription.endDate)}</div>
              {endDays !== null && (
                <div className="text-sm mt-0.5 opacity-70">
                  {endDays === 0 ? 'Сегодня последний день' : `Осталось ${endDays} дн.`}
                </div>
              )}
            </div>
          )}
          {subscription?.startDate && (
            <div className="bg-white/50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                <Calendar className="w-3 h-3" />
                Дата активации
              </div>
              <div className="font-semibold">{formatDate(subscription.startDate)}</div>
            </div>
          )}
          {subscription?.finalAmount !== undefined && (
            <div className="bg-white/50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                <CreditCard className="w-3 h-3" />
                Стоимость
              </div>
              <div className="font-semibold">
                {subscription.finalAmount.toLocaleString('ru-RU')} ₽
                <span className="font-normal opacity-70 text-sm">
                  /{subscription.billingPeriod === 'yearly' ? 'год' : 'мес'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Warning for expiring soon */}
        {urgentDays !== null && urgentDays <= 5 && urgentDays > 0 && (
          <div className="mt-4 bg-white/60 border border-current/20 rounded-xl p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {status === 'trial'
                ? `Пробный период заканчивается через ${urgentDays} дн. После окончания доступ будет ограничен.`
                : `Подписка истекает через ${urgentDays} дн. Продлите её, чтобы не прерывать работу.`}
            </span>
          </div>
        )}
        {status === 'blocked' && (
          <div className="mt-4 bg-white/60 border border-current/20 rounded-xl p-3 text-sm">
            Доступ к системе ограничен. Для восстановления обратитесь в поддержку.
          </div>
        )}
        {status === 'past_due' && company?.pastDueUntil && (
          <div className="mt-4 bg-white/60 border border-current/20 rounded-xl p-3 text-sm">
            Оплата просрочена. Доступ будет заблокирован {formatDate(company.pastDueUntil)}.
          </div>
        )}
      </div>

      {/* Free plan note or available plans */}
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

      {/* Available plans */}
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
                    {plan.priceMonthly.toLocaleString('ru-RU')} ₽
                    <span className="text-sm font-normal text-muted-foreground">/мес</span>
                  </div>
                  {plan.priceYearly > 0 && (
                    <div className="text-xs text-muted-foreground">
                      или {plan.priceYearly.toLocaleString('ru-RU')} ₽/год
                    </div>
                  )}
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground flex-1">
                  <li>До {plan.maxUsers} пользователей</li>
                  <li>До {plan.maxLocations} локаций</li>
                  {(plan.features ?? []).slice(0, 3).map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={`mailto:koznovatoma@gmail.com?subject=Оформление тарифа ${plan.name}&body=Здравствуйте! Хочу подключить тариф ${plan.name} для моей организации.`}
                  className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg transition"
                >
                  Подключить
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact support */}
      <div className="bg-muted/40 rounded-2xl p-4 text-sm text-muted-foreground">
        По вопросам оплаты и тарифов обращайтесь:{' '}
        <a href="mailto:koznovatoma@gmail.com" className="text-blue-600 hover:underline font-medium">
          koznovatoma@gmail.com
        </a>
      </div>
    </div>
  )
}
