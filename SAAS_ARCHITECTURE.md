# Service Box — SaaS Billing Architecture

**Статус**: Утверждена  
**Дата**: 2026-06-28  
**Автор**: Toma + Claude

---

## Раздел 1 — Схема базы данных

Все биллинговые коллекции живут в **главной БД** (`crm_repair`). Тенантные БД не затрагиваются.

### Принципы хранения денег

Все суммы хранятся в **копейках** как целые числа (`Number`). Дробные рубли в MongoDB недопустимы из-за IEEE 754.

```
2990 ₽ → 299000 (копейки)
```

```typescript
function applyDiscount(baseKopecks: number, discountPct: number): number {
  return Math.round(baseKopecks * (100 - discountPct) / 100)
}
// applyDiscount(299000, 15) → 254150 ✓

// Для YooKassa API:
(kopecks / 100).toFixed(2) // "2541.50"

// Для отображения:
(kopecks / 100).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })
```

---

### Расширение модели `Company`

К существующим полям добавляем:

```
subscriptionStatus:  'trial' | 'active' | 'past_due' | 'blocked' | 'free'
subscriptionPlan:    String          — slug тарифа ('start' | 'pro' | 'business')
subscriptionEndDate: Date            — конец оплаченного периода
trialEndDate:        Date            — конец пробного периода
pastDueUntil:        Date            — конец grace period (только при past_due)
discountPercentage:  Number (0–100)  — персональная скидка, считается на сервере
```

`isActive` (существующее поле) остаётся для ручной блокировки. Cron трогает только `subscriptionStatus`.

**Жизненный цикл статуса:**
```
trial → active → past_due (3 дня grace) → blocked
                 ↑                         |
         (платёж прошёл)           (grace истёк)
```

- `past_due` — система доступна, UI показывает баннер с кнопкой оплаты
- `blocked` — middleware редиректит на `/blocked`

---

### Модель `PlanConfig` (редактируемые тарифы, главная БД)

```
slug:          String unique   — 'start' | 'pro' | 'business'
name:          String          — 'Старт', 'Про', 'Бизнес'
priceMonthly:  Number          — в копейках
priceYearly:   Number          — в копейках (обычно priceMonthly × 10)
maxUsers:      Number
maxLocations:  Number
features:      [String]        — ключи фич ('warehouse', 'chat', ...)
isActive:      Boolean
sortOrder:     Number
```

super_admin редактирует через `/platform/plans` — деплой не нужен.

---

### Модель `Subscription` (главная БД)

Лёгкий документ — без массивов платежей.

```
companyId:               ObjectId → Company
planSlug:                String
billingPeriod:           'monthly' | 'yearly'
status:                  'pending' | 'active' | 'expired' | 'cancelled'
baseAmount:              Number (kopecks)
discountPercentage:      Number
finalAmount:             Number (kopecks)  — считается на сервере
startDate:               Date
endDate:                 Date
autoRenew:               Boolean
savedPaymentMethodId:    String | null     — токен карты для автосписаний
createdBy:               ObjectId | null   — null = автоплатёж
notes:                   String
```

---

### Модель `Payment` (отдельная коллекция, главная БД)

Вынесена отдельно — unbounded array внутри `Subscription` является антипаттерном MongoDB.

```
companyId:          ObjectId → Company      — для аудита по компании
subscriptionId:     ObjectId → Subscription
yookassaPaymentId:  String unique           — идемпотентность webhook
amount:             Number (kopecks)
status:             'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded'
paidAt:             Date
rawWebhook:         Mixed                   — сырой payload YooKassa для отладки
createdAt:          Date
```

**Индексы:**
```
{ yookassaPaymentId: 1 } unique
{ subscriptionId: 1 }
{ companyId: 1, createdAt: -1 }
```

---

### Модель `LicenseKey` (главная БД)

```
key:          String unique   — сгенерированный токен
companyId:    ObjectId | null — null = не активирован
planSlug:     String
durationDays: Number
isUsed:       Boolean
activatedAt:  Date
keyExpiresAt: Date            — срок действия самого ключа
createdBy:    ObjectId        — super_admin
```

---

## Раздел 2 — Контроль доступа

Защита работает в трёх независимых слоях.

### Слой 1 — Middleware (Edge, JWT-кэш)

`auth.config.ts` расширяется:

```typescript
// jwt callback: при логине сохраняем статус в токен
jwt({ token, user }) {
  if (user) {
    token.subscriptionStatus = user.subscriptionStatus ?? 'trial'
  }
  return token
}

// session callback: пробрасываем в сессию
session({ session, token }) {
  session.user.id = token.id as string
  session.user.subscriptionStatus = token.subscriptionStatus as string
  return session
}

// authorized callback: редиректим blocked
authorized({ auth, request: { nextUrl } }) {
  const isLoggedIn = !!auth?.user
  if (!isLoggedIn) return false

  const ALLOWED_BLOCKED = ['/blocked', '/billing', '/api/auth', '/api/webhooks']
  const status = auth?.user?.subscriptionStatus
  if (status === 'blocked' && !ALLOWED_BLOCKED.some(p => nextUrl.pathname.startsWith(p))) {
    return Response.redirect(new URL('/blocked', nextUrl))
  }
  return true
}
```

**Допустимое устаревание**: до 8 часов (TTL JWT). Это приемлемо — все API-вызовы проверяются Слоем 2.

### Слой 2 — `requireTenantAuth()` (API, всегда свежие данные из БД)

```typescript
// src/lib/api-helpers.ts — расширение существующей функции
const company = await Company.findById(companyId)
  .select('dbName subscriptionStatus pastDueUntil isActive')
  .lean()

if (company.subscriptionStatus === 'blocked') {
  return Response.json({ error: 'SUBSCRIPTION_BLOCKED' }, { status: 402 })
}
if (company.subscriptionStatus === 'past_due') {
  // Продолжаем, но добавляем предупреждение для UI
  headers.set('X-Subscription-Warning', 'past_due')
}
```

Существующие Route Handlers автоматически получают 402 при блокировке — без изменений в каждом файле.

### Слой 3 — Session callback (Server Components, свежие данные)

`auth.ts` session callback уже делает DB-запрос. Добавляем:

```typescript
const company = await Company.findById(rawCompanyId)
  .select('dbName subscriptionStatus pastDueUntil')
  .lean()

session.user.subscriptionStatus = company?.subscriptionStatus ?? 'trial'
session.user.pastDueUntil = company?.pastDueUntil ?? null
```

### IDOR-защита (Multi-tenancy)

Тенантная изоляция уже обеспечена физически — разные MongoDB-соединения через `getTenantConnection(dbName)`. Риск только в главной БД:

```typescript
// ВСЕГДА из сессии:
Subscription.find({ companyId: session.user.companyId })

// НИКОГДА из тела запроса:
Subscription.find({ companyId: req.body.companyId }) // ← IDOR-уязвимость
```

### Роль `super_admin`

```typescript
type UserRole = 'owner' | 'admin' | 'manager' | 'master' | 'super_admin'
```

- Email: koznovatomka@gmail.com
- Нет `companyId` → работает с главной БД
- Доступ к `/platform/*` (управление тарифами, компаниями, ключами)
- Блокировка подписки на super_admin не распространяется

---

## Раздел 3 — Cron-задачи (Ubuntu + pm2 + node-cron)

### Архитектура

`node-cron` + `instrumentation.ts` — стандарт индустрии для pm2/VPS.

```
src/
  instrumentation.ts       ← Next.js хук
  lib/
    cron/
      index.ts             ← регистрация расписания
      checkSubscriptions.ts ← логика
```

```typescript
// src/instrumentation.ts
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NODE_ENV === 'production'
  ) {
    const { startCronJobs } = await import('@/lib/cron/index')
    startCronJobs()
  }
}
```

```typescript
// src/lib/cron/index.ts
declare global { var __cronRegistered: boolean | undefined }

export function startCronJobs() {
  // Защита от pm2 cluster-режима
  const instance = process.env.NODE_APP_INSTANCE
  if (instance !== undefined && instance !== '0') return

  // Защита от дублей (hot-reload в dev)
  if (global.__cronRegistered) return
  global.__cronRegistered = true

  cron.schedule('0 2 * * *', async () => {
    try {
      const result = await checkSubscriptions()
      console.log('[cron] done:', result)
    } catch (err) {
      console.error('[cron] error:', err)
    }
  }, { timezone: 'Europe/Moscow' })
}
```

### Логика `checkSubscriptions.ts`

**Критически важно**: `find()` перед `updateMany()` — иначе email-адреса компаний недоступны.

```typescript
export async function checkSubscriptions() {
  await connectToDatabase()
  const now = new Date()
  const gracePeriodEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const renewalTrigger = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // 1. Пробный период истёк → blocked
  const trialExpired = await Company.find(
    { subscriptionStatus: 'trial', trialEndDate: { $lt: now } },
    { _id: 1, email: 1, name: 1 }
  ).lean()

  if (trialExpired.length > 0) {
    await Company.updateMany(
      { _id: { $in: trialExpired.map(c => c._id) } },
      { $set: { subscriptionStatus: 'blocked' } }
    )
    await Promise.allSettled(
      trialExpired.map(c => sendSubscriptionEmail(c.email!, 'trial_blocked', { name: c.name }))
    )
  }

  // 2. Grace period истёк → blocked
  const pastDueExpired = await Company.find(
    { subscriptionStatus: 'past_due', pastDueUntil: { $lt: now } },
    { _id: 1, email: 1, name: 1 }
  ).lean()

  if (pastDueExpired.length > 0) {
    await Company.updateMany(
      { _id: { $in: pastDueExpired.map(c => c._id) } },
      { $set: { subscriptionStatus: 'blocked' } }
    )
    await Promise.allSettled(
      pastDueExpired.map(c => sendSubscriptionEmail(c.email!, 'subscription_blocked', { name: c.name }))
    )
  }

  // 3. autoRenew: true — инициируем списание за 24ч до окончания
  // endDate > now (ещё не истёк) — НЕ пересекается с шагом 4
  const renewalDue = await Subscription.find({
    status: 'active',
    autoRenew: true,
    endDate: { $gt: now, $lte: renewalTrigger },
    savedPaymentMethodId: { $exists: true, $ne: null },
  }).lean()

  for (const sub of renewalDue) {
    try {
      await initiateRenewalPayment(sub)
    } catch (err) {
      console.error('[cron] renewal failed:', sub._id, err)
      await Company.updateOne(
        { _id: sub.companyId },
        { $set: { subscriptionStatus: 'past_due', pastDueUntil: gracePeriodEnd } }
      )
    }
  }

  // 4. Оплата не прошла или autoRenew отключён → past_due
  // endDate < now (уже истёк) — не пересекается с шагом 3
  const activeExpired = await Company.find(
    { subscriptionStatus: 'active', subscriptionEndDate: { $lt: now } },
    { _id: 1, email: 1, name: 1 }
  ).lean()

  if (activeExpired.length > 0) {
    await Company.updateMany(
      { _id: { $in: activeExpired.map(c => c._id) } },
      { $set: { subscriptionStatus: 'past_due', pastDueUntil: gracePeriodEnd } }
    )
    await Promise.allSettled(
      activeExpired.map(c => sendSubscriptionEmail(c.email!, 'payment_past_due', { name: c.name }))
    )
  }

  // 5. Синхронизируем Subscription-документы
  await Subscription.updateMany(
    { status: 'active', endDate: { $lt: now } },
    { $set: { status: 'expired' } }
  )

  return {
    trialBlocked: trialExpired.length,
    pastDueBlocked: pastDueExpired.length,
    renewalInitiated: renewalDue.length,
    activeExpired: activeExpired.length,
  }
}
```

### Паттерн автосписаний (рекуррентные платежи)

YooKassa не управляет расписанием. Мы инициируем каждое списание сами через сохранённый токен карты:

```
1. Первая оплата (пользователь → браузер):
   POST /v3/payments { save_payment_method: true, ... }
   ← YooKassa возвращает payment_method.id
   → Сохраняем в Subscription.savedPaymentMethodId

2. Renewal (cron за 24ч, без участия пользователя):
   POST /v3/payments { payment_method_id: "pm_xxx", capture: true }
   ← Нет confirmation/redirect
   → Payment { status: 'pending' }

3. YooKassa шлёт webhook → мы обновляем статус
```

---

## Раздел 4 — YooKassa Webhook (исправленная версия)

### Важное исправление

YooKassa **не использует HMAC-SHA256** для подписи вебхуков (это механизм Stripe). Верификация подлинности вебхука производится **обратным GET-запросом** к YooKassa API: получаем статус платежа напрямую и сверяем с payload вебхука.

### Переменные окружения

```
YOOKASSA_SHOP_ID=12345
YOOKASSA_SECRET_KEY=live_abc...
```

`YOOKASSA_WEBHOOK_SECRET` не нужен.

### Первичный платёж (ОБЯЗАТЕЛЬНО `save_payment_method: true`)

При создании первого платежа от компании **обязательно** передаём этот параметр — без него YooKassa не вернёт `payment_method.id` и автосписания будут невозможны:

```typescript
// src/lib/payments/yookassa.ts — createInitialPayment()
body: JSON.stringify({
  amount: { value: (finalAmount / 100).toFixed(2), currency: 'RUB' },
  save_payment_method: true,   // ОБЯЗАТЕЛЬНО для автосписаний
  capture: true,
  confirmation: {
    type: 'redirect',
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
  },
  description: `Подписка ${plan.name}`,
  metadata: {
    companyId: String(companyId),
    subscriptionId: String(subscriptionId),
    internalPaymentId: String(internalPayment._id),
    planSlug,
    billingPeriod,
  },
})
```

### Route Handler (`src/app/api/webhooks/yookassa/route.ts`)

```typescript
import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import {
  verifyPaymentWithYookassa,
  handlePaymentSucceeded,
  handlePaymentCanceled,
  type YookassaWebhookPayload,
} from '@/lib/payments/webhook'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  // 1. Парсим тело
  let payload: YookassaWebhookPayload
  try {
    payload = JSON.parse(await request.text())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const paymentId = payload.object?.id
  if (!paymentId) {
    return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 })
  }

  // 2. Верификация: GET-запрос к YooKassa API
  // Сравниваем статус в payload со статусом от API — защита от подделки
  const isVerified = await verifyPaymentWithYookassa(paymentId, payload.object.status)
  if (!isVerified) {
    // 200 — не даём YooKassa повторять; не раскрываем причину
    console.warn('[webhook] status mismatch or API error for payment:', paymentId)
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // 3. Обрабатываем событие
  try {
    await connectToDatabase()

    switch (payload.event) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(payload.object)
        break
      case 'payment.canceled':
        await handlePaymentCanceled(payload.object)
        break
      default:
        console.log('[webhook] unhandled event:', payload.event)
    }
  } catch (err) {
    console.error('[webhook] processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
```

### Верификация и обработчики (`src/lib/payments/webhook.ts`)

```typescript
// ── Типы ─────────────────────────────────────────────────────────────────────

export interface YookassaPaymentObject {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  amount: { value: string; currency: 'RUB' }
  payment_method?: { id: string; type: string; saved: boolean }
  metadata?: {
    companyId?: string
    subscriptionId?: string
    planSlug?: string
    billingPeriod?: 'monthly' | 'yearly'
    internalPaymentId?: string
  }
}

export interface YookassaWebhookPayload {
  type: 'notification'
  event: string
  object: YookassaPaymentObject
}

// ── Верификация через обратный запрос к API YooKassa ──────────────────────────

export async function verifyPaymentWithYookassa(
  paymentId: string,
  claimedStatus: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.yookassa.ru/v3/payments/${paymentId}`,
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(
            `${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`
          ).toString('base64'),
        },
      }
    )

    if (!response.ok) {
      console.error('[webhook] YooKassa API error:', response.status)
      return false
    }

    const data = await response.json() as { id: string; status: string }
    // Оба условия: ID совпадает И статус совпадает
    return data.id === paymentId && data.status === claimedStatus
  } catch (err) {
    console.error('[webhook] verifyPayment error:', err)
    return false
  }
}

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000

// ── payment.succeeded ─────────────────────────────────────────────────────────

export async function handlePaymentSucceeded(obj: YookassaPaymentObject): Promise<void> {
  // findOne без .lean() — будем вызывать .save()
  const payment = await Payment.findOne({ yookassaPaymentId: obj.id })
  if (!payment) {
    console.warn('[webhook] unknown payment:', obj.id)
    return
  }

  // Идемпотентность
  if (payment.status === 'succeeded') {
    console.log('[webhook] already processed:', obj.id)
    return
  }

  payment.status = 'succeeded'
  payment.amount = Math.round(parseFloat(obj.amount.value) * 100) // → kopecks
  payment.paidAt = new Date()
  payment.rawWebhook = obj
  await payment.save()

  const subscription = await Subscription.findById(payment.subscriptionId)
  if (!subscription) {
    console.error('[webhook] subscription not found:', String(payment._id))
    return
  }

  const now = new Date()
  const durationMs = subscription.billingPeriod === 'yearly'
    ? 365 * 24 * 60 * 60 * 1000
    :  30 * 24 * 60 * 60 * 1000
  const endDate = new Date(now.getTime() + durationMs)

  subscription.status = 'active'
  subscription.startDate = now
  subscription.endDate = endDate

  // Сохраняем токен карты — придёт только если при создании был save_payment_method: true
  if (obj.payment_method?.saved && obj.payment_method.id) {
    subscription.savedPaymentMethodId = obj.payment_method.id
  }

  await subscription.save()

  await Company.updateOne(
    { _id: payment.companyId },
    {
      $set: {
        subscriptionStatus: 'active',
        subscriptionPlan: subscription.planSlug,
        subscriptionEndDate: endDate,
        pastDueUntil: null,
      },
    }
  )

  console.log('[webhook] payment.succeeded done:', obj.id)
}

// ── payment.canceled ──────────────────────────────────────────────────────────

export async function handlePaymentCanceled(obj: YookassaPaymentObject): Promise<void> {
  const payment = await Payment.findOne({ yookassaPaymentId: obj.id })
  if (!payment) {
    console.warn('[webhook] unknown payment (canceled):', obj.id)
    return
  }

  if (payment.status === 'failed' || payment.status === 'cancelled') {
    console.log('[webhook] already processed (canceled):', obj.id)
    return
  }

  payment.status = 'failed'
  payment.rawWebhook = obj
  await payment.save()

  // Если компания была active — grace period
  await Company.updateOne(
    { _id: payment.companyId, subscriptionStatus: 'active' },
    {
      $set: {
        subscriptionStatus: 'past_due',
        pastDueUntil: new Date(Date.now() + GRACE_PERIOD_MS),
      },
    }
  )

  console.log('[webhook] payment.canceled done:', obj.id)
}
```

### HTTP-коды ответа

| Код | Когда | Поведение YooKassa |
|---|---|---|
| `200` | Успешно / уже обработано / неизвестный платёж | Не повторяет |
| `400` | Невалидный JSON / нет payment ID | Зависит от настроек |
| `500` | Ошибка БД (временная) | Повторяет позже |

Подделанный webhook → `200` (молча игнорируем, не раскрываем факт обнаружения).

---

## Итоговая таблица коллекций

| Модель | БД | Назначение |
|---|---|---|
| `Company` (расширена) | main | +5 полей подписки |
| `PlanConfig` | main | Тарифы с ценами в копейках |
| `Subscription` | main | Период подписки, без массивов |
| `Payment` | main | Отдельная коллекция платежей |
| `LicenseKey` | main | Активация по ключу |
| Тенантные коллекции | tenant DB | Не изменяются |

## Переменные окружения (добавить в `.env`)

```
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
NEXT_PUBLIC_APP_URL=
```
