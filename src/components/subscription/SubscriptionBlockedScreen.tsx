'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { XCircle, CheckCircle, Crown, CreditCard, LogOut, Loader2, Mail } from 'lucide-react'

interface Plan {
  slug: string
  name: string
  priceMonthly: number
  priceYearly: number
  maxUsers: number
  maxLocations: number
  features: string[]
}

const OWNER_EMAIL = process.env.NEXT_PUBLIC_PLATFORM_OWNER_EMAIL ?? 'support@servicebox.ru'

export function SubscriptionBlockedScreen({ companyName }: { companyName?: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/billing/plans')
      .then(r => r.json())
      .then(j => { if (j.success) setPlans(j.data ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white/70 dark:bg-slate-900/70 backdrop-blur">
        <div className="flex items-center gap-2 font-bold text-lg">
          <CreditCard className="w-5 h-5 text-blue-500" />
          ServiceBox CRM
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-10 max-w-4xl mx-auto w-full">
        {/* Blocked banner */}
        <div className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-8 flex items-start gap-4">
          <XCircle className="w-8 h-8 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold text-red-800 dark:text-red-300">
              Доступ заблокирован
            </h1>
            {companyName && (
              <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
                Организация: <span className="font-semibold">{companyName}</span>
              </p>
            )}
            <p className="text-sm text-red-700 dark:text-red-400 mt-2">
              Пробный период завершён. Выберите тариф ниже или свяжитесь с нами для продолжения работы.
            </p>
          </div>
        </div>

        {/* Plans */}
        <div className="w-full mb-6">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-amber-500" />
            Выберите тариф
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">Тарифы временно недоступны. Напишите нам напрямую.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan, idx) => (
                <div
                  key={plan.slug}
                  className={`bg-white dark:bg-slate-800 border rounded-2xl p-5 flex flex-col gap-3 shadow-sm ${
                    idx === 1 ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {idx === 1 && (
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      Популярный
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-base">{plan.name}</div>
                    <div className="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100">
                      {plan.priceMonthly.toLocaleString('ru-RU')} ₽
                      <span className="text-base font-normal text-slate-400">/мес</span>
                    </div>
                    {plan.priceYearly > 0 && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        или {plan.priceYearly.toLocaleString('ru-RU')} ₽/год
                      </div>
                    )}
                  </div>

                  <ul className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400 flex-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      До {plan.maxUsers} пользователей
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      До {plan.maxLocations} филиалов
                    </li>
                    {(plan.features ?? []).slice(0, 4).map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={`mailto:${OWNER_EMAIL}?subject=Оформление тарифа «${plan.name}»&body=Здравствуйте!%0A%0AХочу подключить тариф «${plan.name}» для моей организации${companyName ? ' ' + companyName : ''}.%0A%0AПрошу связаться.`}
                    className={`w-full text-center text-sm font-semibold py-2.5 rounded-xl transition ${
                      idx === 1
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Подключить
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex items-center gap-4">
          <Mail className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-slate-700 dark:text-slate-200">Нужна помощь?</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Напишите нам:{' '}
              <a href={`mailto:${OWNER_EMAIL}`} className="text-blue-600 hover:underline font-medium">
                {OWNER_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
