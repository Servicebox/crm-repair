# SaaS Billing Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить B2B SaaS биллинговый слой — тарифы, подписки, платежи через YooKassa, авто-списания и суперадмин-панель.

**Architecture:** Все биллинговые данные хранятся в главной MongoDB БД (`crm_repair`), тенантные БД не затрагиваются. Подписка проверяется в трёх слоях: Edge middleware (JWT-кэш), `requireTenantAuth()` (свежий DB-запрос), session callback (для Server Components). YooKassa webhook верифицируется обратным GET-запросом к их API.

**Tech Stack:** Next.js 14 App Router, MongoDB/Mongoose (главная БД), node-cron, nodemailer, YooKassa REST API v3.

## Global Constraints

- Все суммы хранятся в **копейках** (целое число). Никаких float для денег.
- Скидки и итоговые суммы считаются **только на сервере** через `Math.round(base * (100 - pct) / 100)`.
- `UserRole` в `src/models/User.ts` — единственный источник истины для ролей.
- `requireTenantAuth()` в `src/lib/api-helpers.ts` — единственная точка входа для защищённых API.
- super_admin email: `koznovatomka@gmail.com`, companyId пустой.
- Webhook URL в YooKassa: `https://<domain>/api/webhooks/yookassa`.
- Cron запускается **только в `NODE_ENV === 'production'`**, только на pm2 instance `0`.
- `node-cron` должен быть добавлен в `package.json` перед Task 4.

---

### Task 1: Database Models

**Files:**
- Modify: `src/models/Company.ts` — добавить 5 полей подписки
- Create: `src/models/PlanConfig.ts`
- Create: `src/models/Subscription.ts`
- Create: `src/models/Payment.ts`
- Create: `src/models/LicenseKey.ts`

**Interfaces:**
- Produces: `ICompany.subscriptionStatus`, `ICompany.subscriptionPlan`, `ICompany.subscriptionEndDate`, `ICompany.trialEndDate`, `ICompany.pastDueUntil`, `ICompany.discountPercentage`
- Produces: `IPlanConfig`, `ISubscription`, `IPayment`, `ILicenseKey` — используются в Tasks 4, 6, 7, 8, 9

- [ ] **Step 1: Расширить интерфейс `ICompany` в `src/models/Company.ts`**

Добавить в `ICompany` после поля `isActive`:

```typescript
subscriptionStatus: 'trial' | 'active' | 'past_due' | 'blocked' | 'free'
subscriptionPlan?: string
subscriptionEndDate?: Date
trialEndDate?: Date
pastDueUntil?: Date
discountPercentage: number
```

- [ ] **Step 2: Добавить поля в `CompanySchema`**

После `isActive: { type: Boolean, default: true },` добавить:

```typescript
subscriptionStatus: {
  type: String,
  enum: ['trial', 'active', 'past_due', 'blocked', 'free'],
  default: 'trial',
},
subscriptionPlan: { type: String },
subscriptionEndDate: { type: Date },
trialEndDate: { type: Date },
pastDueUntil: { type: Date },
discountPercentage: { type: Number, default: 0 },
```

- [ ] **Step 3: Создать `src/models/PlanConfig.ts`**

```typescript
import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IPlanConfig extends Document {
  slug: string
  name: string
  priceMonthly: number   // копейки
  priceYearly: number    // копейки
  maxUsers: number
  maxLocations: number
  features: string[]
  isActive: boolean
  sortOrder: number
}

const PlanConfigSchema = new Schema<IPlanConfig>(
  {
    slug:          { type: String, required: true, unique: true },
    name:          { type: String, required: true },
    priceMonthly:  { type: Number, required: true },
    priceYearly:   { type: Number, required: true },
    maxUsers:      { type: Number, required: true },
    maxLocations:  { type: Number, required: true },
    features:      { type: [String], default: [] },
    isActive:      { type: Boolean, default: true },
    sortOrder:     { type: Number, default: 0 },
  },
  { timestamps: true }
)

const PlanConfig: Model<IPlanConfig> =
  mongoose.models.PlanConfig ?? mongoose.model<IPlanConfig>('PlanConfig', PlanConfigSchema)
export default PlanConfig
```

- [ ] **Step 4: Создать `src/models/Subscription.ts`**

```typescript
import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface ISubscription extends Document {
  companyId: Types.ObjectId
  planSlug: string
  billingPeriod: 'monthly' | 'yearly'
  status: 'pending' | 'active' | 'expired' | 'cancelled'
  baseAmount: number        // копейки
  discountPercentage: number
  finalAmount: number       // копейки
  startDate: Date
  endDate: Date
  autoRenew: boolean
  savedPaymentMethodId?: string
  createdBy?: Types.ObjectId
  notes?: string
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    companyId:            { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    planSlug:             { type: String, required: true },
    billingPeriod:        { type: String, enum: ['monthly', 'yearly'], required: true },
    status:               { type: String, enum: ['pending', 'active', 'expired', 'cancelled'], default: 'pending' },
    baseAmount:           { type: Number, required: true },
    discountPercentage:   { type: Number, default: 0 },
    finalAmount:          { type: Number, required: true },
    startDate:            { type: Date, required: true },
    endDate:              { type: Date, required: true },
    autoRenew:            { type: Boolean, default: true },
    savedPaymentMethodId: { type: String },
    createdBy:            { type: Schema.Types.ObjectId, ref: 'User' },
    notes:                { type: String },
  },
  { timestamps: true }
)

SubscriptionSchema.index({ companyId: 1, status: 1 })
SubscriptionSchema.index({ endDate: 1, status: 1, autoRenew: 1 })

const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ?? mongoose.model<ISubscription>('Subscription', SubscriptionSchema)
export default Subscription
```

- [ ] **Step 5: Создать `src/models/Payment.ts`**

```typescript
import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded'

export interface IPayment extends Document {
  companyId: Types.ObjectId
  subscriptionId: Types.ObjectId
  yookassaPaymentId?: string
  amount: number           // копейки
  status: PaymentStatus
  paidAt?: Date
  rawWebhook?: unknown
  createdAt: Date
}

const PaymentSchema = new Schema<IPayment>(
  {
    companyId:          { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    subscriptionId:     { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    yookassaPaymentId:  { type: String, sparse: true, unique: true },
    amount:             { type: Number, required: true },
    status:             { type: String, enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'], default: 'pending' },
    paidAt:             { type: Date },
    rawWebhook:         { type: Schema.Types.Mixed },
  },
  { timestamps: true }
)

PaymentSchema.index({ subscriptionId: 1 })
PaymentSchema.index({ companyId: 1, createdAt: -1 })

const Payment: Model<IPayment> =
  mongoose.models.Payment ?? mongoose.model<IPayment>('Payment', PaymentSchema)
export default Payment
```

- [ ] **Step 6: Создать `src/models/LicenseKey.ts`**

```typescript
import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface ILicenseKey extends Document {
  key: string
  companyId?: Types.ObjectId
  planSlug: string
  durationDays: number
  isUsed: boolean
  activatedAt?: Date
  keyExpiresAt: Date
  createdBy: Types.ObjectId
}

const LicenseKeySchema = new Schema<ILicenseKey>(
  {
    key:          { type: String, required: true, unique: true },
    companyId:    { type: Schema.Types.ObjectId, ref: 'Company', sparse: true },
    planSlug:     { type: String, required: true },
    durationDays: { type: Number, required: true },
    isUsed:       { type: Boolean, default: false },
    activatedAt:  { type: Date },
    keyExpiresAt: { type: Date, required: true },
    createdBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

const LicenseKey: Model<ILicenseKey> =
  mongoose.models.LicenseKey ?? mongoose.model<ILicenseKey>('LicenseKey', LicenseKeySchema)
export default LicenseKey
```

- [ ] **Step 7: Коммит**

```bash
git add src/models/Company.ts src/models/PlanConfig.ts src/models/Subscription.ts src/models/Payment.ts src/models/LicenseKey.ts
git commit -m "feat(billing): add subscription fields to Company and create billing models"
```

---

### Task 2: Auth & Roles

**Files:**
- Modify: `src/models/User.ts:4` — добавить `'super_admin'` в `UserRole`
- Modify: `src/auth.config.ts` — JWT callback кэширует `subscriptionStatus`
- Modify: `src/auth.ts` — session callback читает `subscriptionStatus` из Company

**Interfaces:**
- Consumes: `ICompany.subscriptionStatus`, `ICompany.pastDueUntil` из Task 1
- Produces: `session.user.subscriptionStatus`, `session.user.pastDueUntil` — используются в Tasks 3, 8

- [ ] **Step 1: Добавить `super_admin` в `UserRole` (`src/models/User.ts:4`)**

```typescript
export type UserRole = 'owner' | 'admin' | 'manager' | 'master' | 'super_admin'
```

В `UserSchema` на строке с `enum` также добавить `'super_admin'`:

```typescript
enum: ['owner', 'admin', 'manager', 'master', 'super_admin'],
```

- [ ] **Step 2: Расширить JWT callback в `src/auth.config.ts`**

В `jwt` callback после `token.dbName = user.dbName ?? ''` добавить:

```typescript
token.subscriptionStatus = (user as { subscriptionStatus?: string }).subscriptionStatus ?? 'trial'
```

В `session` callback после `session.user.id = token.id as string` добавить:

```typescript
if (token.subscriptionStatus) {
  session.user.subscriptionStatus = token.subscriptionStatus as string
}
```

- [ ] **Step 3: Расширить session callback в `src/auth.ts`**

В `auth.ts` найти место где читается `company` для `dbName`. Расширить запрос:

```typescript
const company = await Company.findById(rawCompanyId)
  .select('dbName subscriptionStatus pastDueUntil')
  .lean() as { dbName?: string; subscriptionStatus?: string; pastDueUntil?: Date } | null

session.user.dbName = company?.dbName ?? getDefaultDbName()
session.user.subscriptionStatus = company?.subscriptionStatus ?? 'trial'
if (company?.pastDueUntil) {
  session.user.pastDueUntil = company.pastDueUntil
}
```

- [ ] **Step 4: Добавить поля в `next-auth.d.ts`**

Найти файл с расширением типов NextAuth (обычно `src/types/next-auth.d.ts`). Добавить в `interface User`:

```typescript
subscriptionStatus?: string
pastDueUntil?: Date
```

- [ ] **Step 5: Проверить сборку**

```bash
npx tsc --noEmit
```

Ожидаем: 0 ошибок в изменённых файлах.

- [ ] **Step 6: Коммит**

```bash
git add src/models/User.ts src/auth.config.ts src/auth.ts src/types/next-auth.d.ts
git commit -m "feat(billing): add super_admin role and subscriptionStatus to JWT/session"
```

---

### Task 3: Access Control

**Files:**
- Modify: `src/auth.config.ts` — `authorized` callback для блокировки подписки
- Modify: `src/lib/api-helpers.ts` — расширить `requireTenantAuth()`, добавить `requireSuperAdmin()`

**Interfaces:**
- Consumes: `session.user.subscriptionStatus` из Task 2
- Produces: `requireSuperAdmin()` — используется в Task 9

- [ ] **Step 1: Расширить `authorized` callback в `src/auth.config.ts`**

В `authorized` callback после `if (isLoggedIn) return true` заменить на:

```typescript
if (isLoggedIn) {
  const ALLOWED_BLOCKED = ['/blocked', '/billing', '/api/auth', '/api/webhooks']
  const status = (auth?.user as { subscriptionStatus?: string })?.subscriptionStatus
  if (
    status === 'blocked' &&
    !ALLOWED_BLOCKED.some(p => nextUrl.pathname.startsWith(p))
  ) {
    return Response.redirect(new URL('/blocked', nextUrl))
  }
  return true
}
```

- [ ] **Step 2: Расширить `requireTenantAuth()` в `src/lib/api-helpers.ts`**

Добавить импорты в начало файла:

```typescript
import Company from '@/models/Company'
import mongoose from 'mongoose'
```

В `requireTenantAuth()` после получения `session`, перед `getTenantConnection`, добавить:

```typescript
// Свежая проверка статуса подписки из БД (не JWT-кэш)
if (session.user.companyId) {
  const company = await Company.findById(session.user.companyId)
    .select('subscriptionStatus pastDueUntil')
    .lean() as { subscriptionStatus?: string; pastDueUntil?: Date } | null

  const status = company?.subscriptionStatus
  if (status === 'blocked') {
    return { error: NextResponse.json({ error: 'SUBSCRIPTION_BLOCKED' }, { status: 402 }) }
  }
}
```

- [ ] **Step 3: Добавить `requireSuperAdmin()` в `src/lib/api-helpers.ts`**

```typescript
export async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (session.user.role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session }
}
```

- [ ] **Step 4: Проверить сборку**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Коммит**

```bash
git add src/auth.config.ts src/lib/api-helpers.ts
git commit -m "feat(billing): block expired subscriptions in middleware and requireTenantAuth"
```

---

### Task 4: Cron Infrastructure

**Files:**
- Create: `src/instrumentation.ts`
- Create: `src/lib/cron/index.ts`
- Create: `src/lib/cron/checkSubscriptions.ts`

**Interfaces:**
- Consumes: `Company`, `Subscription` из Task 1; `sendSubscriptionEmail` из Task 5 (импорт условный — Task 5 пишется позже, добавить заглушку)
- Produces: `checkSubscriptions()` — используется в Task 9 (ручной запуск)

**Предварительно установить `node-cron`:**
```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

- [ ] **Step 1: Создать `src/instrumentation.ts`**

```typescript
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

- [ ] **Step 2: Создать `src/lib/cron/index.ts`**

```typescript
import cron from 'node-cron'
import { checkSubscriptions } from './checkSubscriptions'

declare global {
  // eslint-disable-next-line no-var
  var __cronRegistered: boolean | undefined
}

export function startCronJobs(): void {
  // Защита от pm2 cluster: только instance 0
  const instance = process.env.NODE_APP_INSTANCE
  if (instance !== undefined && instance !== '0') {
    console.log(`[cron] skip — pm2 instance ${instance}`)
    return
  }

  // Защита от двойной регистрации
  if (global.__cronRegistered) {
    console.log('[cron] already registered')
    return
  }
  global.__cronRegistered = true

  // Каждую ночь в 02:00 по Москве
  cron.schedule(
    '0 2 * * *',
    async () => {
      console.log('[cron] checkSubscriptions start', new Date().toISOString())
      try {
        const result = await checkSubscriptions()
        console.log('[cron] done', result)
      } catch (err) {
        console.error('[cron] error', err)
      }
    },
    { timezone: 'Europe/Moscow' }
  )

  console.log('[cron] scheduler registered')
}
```

- [ ] **Step 3: Создать `src/lib/cron/checkSubscriptions.ts`**

```typescript
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'
import Subscription from '@/models/Subscription'

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000
const RENEWAL_TRIGGER_MS = 24 * 60 * 60 * 1000

export interface CronResult {
  trialBlocked: number
  pastDueBlocked: number
  renewalInitiated: number
  activeExpired: number
}

export async function checkSubscriptions(): Promise<CronResult> {
  await connectToDatabase()
  const now = new Date()
  const gracePeriodEnd = new Date(now.getTime() + GRACE_PERIOD_MS)
  const renewalTrigger = new Date(now.getTime() + RENEWAL_TRIGGER_MS)

  // Импортируем здесь — циклической зависимости нет, email.ts не зависит от cron
  const { sendSubscriptionEmail } = await import('@/lib/email')

  // 1. Пробный период истёк → blocked
  const trialExpired = await Company.find(
    { subscriptionStatus: 'trial', trialEndDate: { $lt: now } },
    { _id: 1, email: 1, name: 1 }
  ).lean<Array<{ _id: unknown; email?: string; name: string }>>()

  if (trialExpired.length > 0) {
    await Company.updateMany(
      { _id: { $in: trialExpired.map(c => c._id) } },
      { $set: { subscriptionStatus: 'blocked' } }
    )
    await Promise.allSettled(
      trialExpired
        .filter(c => c.email)
        .map(c => sendSubscriptionEmail(c.email!, 'trial_blocked', { name: c.name }))
    )
  }

  // 2. Grace period истёк → blocked
  const pastDueExpired = await Company.find(
    { subscriptionStatus: 'past_due', pastDueUntil: { $lt: now } },
    { _id: 1, email: 1, name: 1 }
  ).lean<Array<{ _id: unknown; email?: string; name: string }>>()

  if (pastDueExpired.length > 0) {
    await Company.updateMany(
      { _id: { $in: pastDueExpired.map(c => c._id) } },
      { $set: { subscriptionStatus: 'blocked' } }
    )
    await Promise.allSettled(
      pastDueExpired
        .filter(c => c.email)
        .map(c => sendSubscriptionEmail(c.email!, 'subscription_blocked', { name: c.name }))
    )
  }

  // 3. autoRenew: true — инициируем списание за 24ч (endDate ещё в будущем)
  const renewalDue = await Subscription.find({
    status: 'active',
    autoRenew: true,
    endDate: { $gt: now, $lte: renewalTrigger },
    savedPaymentMethodId: { $exists: true, $ne: null },
  }).lean()

  let renewalInitiated = 0
  for (const sub of renewalDue) {
    try {
      // Динамический импорт чтобы не загружать YooKassa в dev-режиме
      const { initiateRenewalPayment } = await import('@/lib/payments/yookassa')
      await initiateRenewalPayment(sub)
      renewalInitiated++
    } catch (err) {
      console.error('[cron] renewal failed for subscription', sub._id, err)
      await Company.updateOne(
        { _id: sub.companyId },
        { $set: { subscriptionStatus: 'past_due', pastDueUntil: gracePeriodEnd } }
      )
    }
  }

  // 4. Оплата не прошла / autoRenew откл. → past_due
  const activeExpired = await Company.find(
    { subscriptionStatus: 'active', subscriptionEndDate: { $lt: now } },
    { _id: 1, email: 1, name: 1 }
  ).lean<Array<{ _id: unknown; email?: string; name: string }>>()

  if (activeExpired.length > 0) {
    await Company.updateMany(
      { _id: { $in: activeExpired.map(c => c._id) } },
      { $set: { subscriptionStatus: 'past_due', pastDueUntil: gracePeriodEnd } }
    )
    await Promise.allSettled(
      activeExpired
        .filter(c => c.email)
        .map(c => sendSubscriptionEmail(c.email!, 'payment_past_due', { name: c.name }))
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
    renewalInitiated,
    activeExpired: activeExpired.length,
  }
}
```

- [ ] **Step 4: Проверить сборку**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Коммит**

```bash
git add src/instrumentation.ts src/lib/cron/index.ts src/lib/cron/checkSubscriptions.ts package.json package-lock.json
git commit -m "feat(billing): add node-cron subscription expiry job via instrumentation.ts"
```

---

### Task 5: Billing Email Notifications

**Files:**
- Modify: `src/lib/email.ts` — добавить `sendSubscriptionEmail()`

**Interfaces:**
- Produces: `sendSubscriptionEmail(email, type, data)` — используется в Task 4 (уже есть импорт)

- [ ] **Step 1: Добавить типы событий и функцию в `src/lib/email.ts`**

В конец файла добавить:

```typescript
export type BillingEmailType =
  | 'trial_blocked'
  | 'subscription_blocked'
  | 'payment_past_due'
  | 'payment_succeeded'
  | 'payment_failed'

const BILLING_EMAIL_TEMPLATES: Record<
  BillingEmailType,
  { subject: string; heading: string; body: string; cta?: { text: string; path: string } }
> = {
  trial_blocked: {
    subject: 'Пробный период завершён — ServiceBox',
    heading: 'Пробный период завершён',
    body: 'Ваш бесплатный пробный период подошёл к концу. Оформите подписку, чтобы продолжить работу.',
    cta: { text: 'Выбрать тариф', path: '/billing' },
  },
  subscription_blocked: {
    subject: 'Доступ приостановлен — ServiceBox',
    heading: 'Доступ приостановлен',
    body: 'Платёж не поступил в течение grace period. Оплатите подписку для восстановления доступа.',
    cta: { text: 'Оплатить', path: '/billing' },
  },
  payment_past_due: {
    subject: 'Требуется оплата — ServiceBox',
    heading: 'Подписка истекла',
    body: 'Срок действия вашей подписки истёк. У вас есть 3 дня для оплаты до блокировки доступа.',
    cta: { text: 'Продлить подписку', path: '/billing' },
  },
  payment_succeeded: {
    subject: 'Оплата прошла — ServiceBox',
    heading: 'Оплата прошла успешно',
    body: 'Ваша подписка продлена. Спасибо за доверие!',
  },
  payment_failed: {
    subject: 'Ошибка оплаты — ServiceBox',
    heading: 'Не удалось списать оплату',
    body: 'При автоматическом списании возникла ошибка. Проверьте данные карты и оплатите вручную.',
    cta: { text: 'Оплатить', path: '/billing' },
  },
}

export async function sendSubscriptionEmail(
  email: string,
  type: BillingEmailType,
  data: { name: string }
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'

  const tmpl = BILLING_EMAIL_TEMPLATES[type]
  const ctaHtml = tmpl.cta
    ? `<a href="${baseUrl}${tmpl.cta.path}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-top:16px">${tmpl.cta.text}</a>`
    : ''

  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: tmpl.subject,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <h1 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 8px">${tmpl.heading}</h1>
        <p style="color:#64748b;margin:0 0 4px">Здравствуйте, ${escapeHtml(data.name)}!</p>
        <p style="color:#475569;margin:0 0 8px">${tmpl.body}</p>
        ${ctaHtml}
        <p style="color:#94a3b8;font-size:12px;margin:24px 0 0">ServiceBox CRM</p>
      </div>
    `,
  })
}
```

- [ ] **Step 2: Проверить сборку**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Коммит**

```bash
git add src/lib/email.ts
git commit -m "feat(billing): add billing email notifications (trial_blocked, past_due, etc.)"
```

---

### Task 6: YooKassa API Client

**Files:**
- Create: `src/lib/payments/yookassa.ts`

**Interfaces:**
- Consumes: `ISubscription`, `IPlanConfig`, `IPayment` из Task 1
- Produces: `createInitialPayment(params)`, `initiateRenewalPayment(subscription)` — используются в Tasks 7, 8

- [ ] **Step 1: Создать `src/lib/payments/yookassa.ts`**

```typescript
import { Types } from 'mongoose'
import { connectToDatabase } from '@/lib/mongodb'
import PlanConfig from '@/models/PlanConfig'
import Subscription from '@/models/Subscription'
import Payment from '@/models/Payment'

function getBasicAuth(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  if (!shopId || !secretKey) throw new Error('YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY not set')
  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
}

function applyDiscount(baseKopecks: number, discountPct: number): number {
  return Math.round(baseKopecks * (100 - discountPct) / 100)
}

// ── Первичный платёж (пользователь платит впервые) ────────────────────────────

export interface CreateInitialPaymentParams {
  companyId: string
  planSlug: string
  billingPeriod: 'monthly' | 'yearly'
  discountPercentage?: number
  returnUrl: string
}

export interface CreateInitialPaymentResult {
  confirmationUrl: string
  yookassaPaymentId: string
  internalPaymentId: string
}

export async function createInitialPayment(
  params: CreateInitialPaymentParams
): Promise<CreateInitialPaymentResult> {
  await connectToDatabase()
  const { companyId, planSlug, billingPeriod, discountPercentage = 0, returnUrl } = params

  const plan = await PlanConfig.findOne({ slug: planSlug, isActive: true }).lean()
  if (!plan) throw new Error(`Plan not found: ${planSlug}`)

  const baseAmount = billingPeriod === 'yearly' ? plan.priceYearly : plan.priceMonthly
  const finalAmount = applyDiscount(baseAmount, discountPercentage)
  const startDate = new Date()
  const durationMs = billingPeriod === 'yearly'
    ? 365 * 24 * 60 * 60 * 1000
    :  30 * 24 * 60 * 60 * 1000
  const endDate = new Date(startDate.getTime() + durationMs)

  // Создаём Subscription и Payment до вызова YooKassa
  const subscription = await Subscription.create({
    companyId: new Types.ObjectId(companyId),
    planSlug,
    billingPeriod,
    status: 'pending',
    baseAmount,
    discountPercentage,
    finalAmount,
    startDate,
    endDate,
    autoRenew: true,
  })

  const internalPayment = await Payment.create({
    companyId: new Types.ObjectId(companyId),
    subscriptionId: subscription._id,
    amount: finalAmount,
    status: 'pending',
  })

  // Вызываем YooKassa API
  const idempotenceKey = `initial-${String(internalPayment._id)}`
  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
      Authorization: getBasicAuth(),
    },
    body: JSON.stringify({
      amount: { value: (finalAmount / 100).toFixed(2), currency: 'RUB' },
      save_payment_method: true,   // ОБЯЗАТЕЛЬНО для автосписаний
      capture: true,
      confirmation: { type: 'redirect', return_url: returnUrl },
      description: `Подписка ${plan.name} — ${billingPeriod === 'yearly' ? 'год' : 'месяц'}`,
      metadata: {
        companyId,
        subscriptionId: String(subscription._id),
        internalPaymentId: String(internalPayment._id),
        planSlug,
        billingPeriod,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    await Payment.updateOne({ _id: internalPayment._id }, { $set: { status: 'failed' } })
    throw new Error(`YooKassa ${response.status}: ${errText}`)
  }

  const data = await response.json() as {
    id: string
    confirmation: { confirmation_url: string }
  }

  await Payment.updateOne(
    { _id: internalPayment._id },
    { $set: { yookassaPaymentId: data.id } }
  )

  return {
    confirmationUrl: data.confirmation.confirmation_url,
    yookassaPaymentId: data.id,
    internalPaymentId: String(internalPayment._id),
  }
}

// ── Авторенью (cron, без участия пользователя) ───────────────────────────────

export async function initiateRenewalPayment(
  subscription: { _id: unknown; companyId: unknown; planSlug: string; billingPeriod: 'monthly' | 'yearly'; discountPercentage?: number; savedPaymentMethodId?: string }
): Promise<void> {
  await connectToDatabase()

  // Идемпотентность: не создаём второй pending Payment за последние 24ч
  const existing = await Payment.findOne({
    subscriptionId: subscription._id,
    status: 'pending',
    createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  })
  if (existing) {
    console.log('[yookassa] renewal already pending for subscription', subscription._id)
    return
  }

  const plan = await PlanConfig.findOne({ slug: subscription.planSlug }).lean()
  if (!plan) throw new Error(`Plan not found: ${subscription.planSlug}`)

  const baseAmount = subscription.billingPeriod === 'yearly' ? plan.priceYearly : plan.priceMonthly
  const finalAmount = applyDiscount(baseAmount, subscription.discountPercentage ?? 0)

  const internalPayment = await Payment.create({
    companyId: subscription.companyId,
    subscriptionId: subscription._id,
    amount: finalAmount,
    status: 'pending',
  })

  const idempotenceKey = `renewal-${String(subscription._id)}-${String(internalPayment._id)}`
  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
      Authorization: getBasicAuth(),
    },
    body: JSON.stringify({
      amount: { value: (finalAmount / 100).toFixed(2), currency: 'RUB' },
      payment_method_id: subscription.savedPaymentMethodId,
      capture: true,
      description: `Продление ${plan.name}`,
      metadata: {
        companyId: String(subscription.companyId),
        subscriptionId: String(subscription._id),
        internalPaymentId: String(internalPayment._id),
        planSlug: subscription.planSlug,
        billingPeriod: subscription.billingPeriod,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    await Payment.updateOne({ _id: internalPayment._id }, { $set: { status: 'failed' } })
    throw new Error(`YooKassa ${response.status}: ${errText}`)
  }

  const data = await response.json() as { id: string }
  await Payment.updateOne(
    { _id: internalPayment._id },
    { $set: { yookassaPaymentId: data.id } }
  )
}
```

- [ ] **Step 2: Проверить сборку**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Коммит**

```bash
git add src/lib/payments/yookassa.ts
git commit -m "feat(billing): YooKassa API client with createInitialPayment and initiateRenewalPayment"
```

---

### Task 7: YooKassa Webhook

**Files:**
- Create: `src/lib/payments/webhook.ts`
- Create: `src/app/api/webhooks/yookassa/route.ts`

**Interfaces:**
- Consumes: `IPayment`, `ISubscription`, `ICompany` из Task 1
- Consumes: `initiateRenewalPayment` — не нужен в webhook, только в cron

- [ ] **Step 1: Создать `src/lib/payments/webhook.ts`**

```typescript
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'
import Subscription from '@/models/Subscription'
import Payment from '@/models/Payment'

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000

// ── Типы ─────────────────────────────────────────────────────────────────────

export interface YookassaPaymentObject {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  amount: { value: string; currency: 'RUB' }
  payment_method?: { id: string; type: string; saved: boolean }
  metadata?: {
    companyId?: string
    subscriptionId?: string
    internalPaymentId?: string
    planSlug?: string
    billingPeriod?: 'monthly' | 'yearly'
  }
}

export interface YookassaWebhookPayload {
  type: 'notification'
  event: string
  object: YookassaPaymentObject
}

// ── Верификация через обратный GET-запрос к YooKassa API ──────────────────────

export async function verifyPaymentWithYookassa(
  paymentId: string,
  claimedStatus: string
): Promise<boolean> {
  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  if (!shopId || !secretKey) {
    console.error('[webhook] YOOKASSA credentials not set')
    return false
  }

  try {
    const response = await fetch(
      `https://api.yookassa.ru/v3/payments/${paymentId}`,
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
        },
      }
    )
    if (!response.ok) {
      console.error('[webhook] YooKassa API error:', response.status)
      return false
    }
    const data = await response.json() as { id: string; status: string }
    return data.id === paymentId && data.status === claimedStatus
  } catch (err) {
    console.error('[webhook] verifyPayment fetch error:', err)
    return false
  }
}

// ── payment.succeeded ─────────────────────────────────────────────────────────

export async function handlePaymentSucceeded(obj: YookassaPaymentObject): Promise<void> {
  await connectToDatabase()

  const payment = await Payment.findOne({ yookassaPaymentId: obj.id })
  if (!payment) {
    console.warn('[webhook] unknown payment:', obj.id)
    return
  }
  if (payment.status === 'succeeded') {
    console.log('[webhook] already processed:', obj.id)
    return
  }

  payment.status = 'succeeded'
  payment.amount = Math.round(parseFloat(obj.amount.value) * 100)
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
  await connectToDatabase()

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

  // Если компания была active — переходим в past_due с grace period
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

- [ ] **Step 2: Создать `src/app/api/webhooks/yookassa/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
  verifyPaymentWithYookassa,
  handlePaymentSucceeded,
  handlePaymentCanceled,
  type YookassaWebhookPayload,
} from '@/lib/payments/webhook'

// Edge Runtime не поддерживает MongoDB
export const runtime = 'nodejs'

export async function POST(request: Request) {
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

  // Верификация: сверяем статус с YooKassa API
  const isVerified = await verifyPaymentWithYookassa(paymentId, payload.object.status)
  if (!isVerified) {
    // 200 — не раскрываем факт обнаружения, не просим retry
    console.warn('[webhook] status mismatch for payment:', paymentId)
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  try {
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
    // 500 → YooKassa повторит попытку
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 3: Проверить сборку**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Коммит**

```bash
git add src/lib/payments/webhook.ts src/app/api/webhooks/yookassa/route.ts
git commit -m "feat(billing): YooKassa webhook with API verification and idempotent handlers"
```

---

### Task 8: Billing API Routes (tenant-facing)

**Files:**
- Create: `src/app/api/billing/plans/route.ts`
- Create: `src/app/api/billing/subscription/route.ts`
- Create: `src/app/api/billing/checkout/route.ts`

**Interfaces:**
- Consumes: `requireTenantAuth()` из Task 3; `createInitialPayment()` из Task 6

- [ ] **Step 1: Создать `src/app/api/billing/plans/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireTenantAuth } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import PlanConfig from '@/models/PlanConfig'

export async function GET() {
  const { error } = await requireTenantAuth()
  if (error) return error

  await connectToDatabase()
  const plans = await PlanConfig.find({ isActive: true })
    .sort({ sortOrder: 1 })
    .select('slug name priceMonthly priceYearly maxUsers maxLocations features')
    .lean()

  return NextResponse.json({ success: true, data: plans })
}
```

- [ ] **Step 2: Создать `src/app/api/billing/subscription/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireTenantAuth } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import Subscription from '@/models/Subscription'
import Company from '@/models/Company'
import { Types } from 'mongoose'

export async function GET() {
  const { session, error } = await requireTenantAuth()
  if (error) return error

  await connectToDatabase()
  const companyId = new Types.ObjectId(session!.user.companyId)

  const [company, subscription] = await Promise.all([
    Company.findById(companyId)
      .select('subscriptionStatus subscriptionPlan subscriptionEndDate trialEndDate pastDueUntil discountPercentage')
      .lean(),
    Subscription.findOne({ companyId, status: 'active' })
      .select('planSlug billingPeriod startDate endDate autoRenew finalAmount')
      .lean(),
  ])

  return NextResponse.json({ success: true, data: { company, subscription } })
}
```

- [ ] **Step 3: Создать `src/app/api/billing/checkout/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireTenantAuth } from '@/lib/api-helpers'
import { createInitialPayment } from '@/lib/payments/yookassa'
import { z } from 'zod'

const CheckoutSchema = z.object({
  planSlug: z.enum(['start', 'pro', 'business']),
  billingPeriod: z.enum(['monthly', 'yearly']),
})

export async function POST(request: Request) {
  const { session, error } = await requireTenantAuth()
  if (error) return error

  const body = await request.json()
  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    'http://localhost:3000'

  try {
    const result = await createInitialPayment({
      companyId: session!.user.companyId,
      planSlug: parsed.data.planSlug,
      billingPeriod: parsed.data.billingPeriod,
      returnUrl: `${baseUrl}/billing/success`,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[checkout] error:', err)
    return NextResponse.json({ error: 'Payment creation failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Проверить сборку**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Коммит**

```bash
git add src/app/api/billing/
git commit -m "feat(billing): add tenant billing API routes (plans, subscription, checkout)"
```

---

### Task 9: Super Admin API + PlanConfig Seed

**Files:**
- Create: `src/app/api/platform/billing/companies/route.ts`
- Create: `src/app/api/platform/billing/companies/[id]/route.ts`
- Create: `src/app/api/platform/billing/plans/route.ts`
- Create: `src/app/api/platform/billing/cron/run/route.ts`
- Create: `src/scripts/seedPlans.ts`

**Interfaces:**
- Consumes: `requireSuperAdmin()` из Task 3; `checkSubscriptions()` из Task 4

- [ ] **Step 1: Создать `src/app/api/platform/billing/companies/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  await connectToDatabase()
  const companies = await Company.find()
    .select('name email subscriptionStatus subscriptionPlan subscriptionEndDate trialEndDate discountPercentage isActive')
    .sort({ createdAt: -1 })
    .lean()

  return NextResponse.json({ success: true, data: companies })
}
```

- [ ] **Step 2: Создать `src/app/api/platform/billing/companies/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'
import { z } from 'zod'

const UpdateSchema = z.object({
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'blocked', 'free']).optional(),
  subscriptionPlan: z.string().optional(),
  subscriptionEndDate: z.string().datetime().optional(),
  trialEndDate: z.string().datetime().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  await connectToDatabase()
  const company = await Company.findByIdAndUpdate(
    params.id,
    { $set: parsed.data },
    { new: true }
  ).select('name subscriptionStatus subscriptionPlan subscriptionEndDate discountPercentage')

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: company })
}
```

- [ ] **Step 3: Создать `src/app/api/platform/billing/plans/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import PlanConfig from '@/models/PlanConfig'
import { z } from 'zod'

const PlanSchema = z.object({
  slug: z.string(),
  name: z.string(),
  priceMonthly: z.number().int().positive(),
  priceYearly: z.number().int().positive(),
  maxUsers: z.number().int().positive(),
  maxLocations: z.number().int().positive(),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  await connectToDatabase()
  const plans = await PlanConfig.find().sort({ sortOrder: 1 }).lean()
  return NextResponse.json({ success: true, data: plans })
}

export async function POST(request: Request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const parsed = PlanSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  await connectToDatabase()
  const plan = await PlanConfig.create(parsed.data)
  return NextResponse.json({ success: true, data: plan }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = await request.json()
  const { slug, ...updates } = body as { slug: string; [key: string]: unknown }
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  await connectToDatabase()
  const plan = await PlanConfig.findOneAndUpdate(
    { slug },
    { $set: updates },
    { new: true }
  )
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  return NextResponse.json({ success: true, data: plan })
}
```

- [ ] **Step 4: Создать `src/app/api/platform/billing/cron/run/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/api-helpers'
import { checkSubscriptions } from '@/lib/cron/checkSubscriptions'

export async function POST() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  try {
    const result = await checkSubscriptions()
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[cron/run] error:', err)
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Создать `src/scripts/seedPlans.ts`**

```typescript
// Запуск: npx ts-node -r tsconfig-paths/register src/scripts/seedPlans.ts
import mongoose from 'mongoose'
import PlanConfig from '../models/PlanConfig'

const PLANS = [
  {
    slug: 'start',
    name: 'Старт',
    priceMonthly: 199000,   // 1 990 ₽
    priceYearly: 1990000,   // 19 900 ₽
    maxUsers: 3,
    maxLocations: 1,
    features: ['orders', 'clients', 'basic_reports'],
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: 'pro',
    name: 'Про',
    priceMonthly: 299000,   // 2 990 ₽
    priceYearly: 2990000,   // 29 900 ₽
    maxUsers: 10,
    maxLocations: 3,
    features: ['orders', 'clients', 'reports', 'warehouse', 'payroll'],
    isActive: true,
    sortOrder: 2,
  },
  {
    slug: 'business',
    name: 'Бизнес',
    priceMonthly: 499000,   // 4 990 ₽
    priceYearly: 4990000,   // 49 900 ₽
    maxUsers: 50,
    maxLocations: 10,
    features: ['orders', 'clients', 'reports', 'warehouse', 'payroll', 'chat', 'analytics'],
    isActive: true,
    sortOrder: 3,
  },
]

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI!)
  for (const plan of PLANS) {
    await PlanConfig.findOneAndUpdate({ slug: plan.slug }, plan, { upsert: true })
    console.log(`Upserted plan: ${plan.slug}`)
  }
  await mongoose.disconnect()
  console.log('Seed complete')
}

seed().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 6: Проверить сборку**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Коммит**

```bash
git add src/app/api/platform/billing/ src/scripts/seedPlans.ts
git commit -m "feat(billing): super_admin API routes for companies, plans, and cron trigger"
```

---

### Task 10: Blocked & Billing UI Pages

**Files:**
- Create: `src/app/(dashboard)/blocked/page.tsx`
- Create: `src/app/(dashboard)/billing/page.tsx`
- Create: `src/app/(dashboard)/billing/success/page.tsx`

- [ ] **Step 1: Создать `src/app/(dashboard)/blocked/page.tsx`**

```tsx
import Link from 'next/link'

export default function BlockedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Доступ приостановлен</h1>
        <p className="text-gray-500 mb-6">
          Ваша подписка истекла. Оплатите, чтобы продолжить работу с ServiceBox CRM.
        </p>
        <Link
          href="/billing"
          className="inline-block bg-blue-600 text-white rounded-lg px-6 py-3 font-semibold hover:bg-blue-700 transition-colors"
        >
          Выбрать тариф
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Создать `src/app/(dashboard)/billing/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Plan {
  slug: string
  name: string
  priceMonthly: number
  priceYearly: number
  maxUsers: number
  maxLocations: number
  features: string[]
}

function formatPrice(kopecks: number): string {
  return (kopecks / 100).toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  })
}

export default function BillingPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing/plans')
      .then(r => r.json())
      .then(d => setPlans(d.data ?? []))
  }, [])

  async function handleCheckout(planSlug: string) {
    setSelectedPlan(planSlug)
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug, billingPeriod: period }),
      })
      const data = await res.json()
      if (data.data?.confirmationUrl) {
        window.location.href = data.data.confirmationUrl
      }
    } catch {
      setLoading(false)
      setSelectedPlan(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Тарифы</h1>
      <p className="text-gray-500 mb-8">Выберите подходящий план для вашего сервисного центра</p>

      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setPeriod('monthly')}
          className={`px-4 py-2 rounded-lg font-medium ${period === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Помесячно
        </button>
        <button
          onClick={() => setPeriod('yearly')}
          className={`px-4 py-2 rounded-lg font-medium ${period === 'yearly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Ежегодно <span className="text-xs font-normal">−17%</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.slug} className="border border-gray-200 rounded-2xl p-6 bg-white">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h2>
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {formatPrice(period === 'monthly' ? plan.priceMonthly : plan.priceYearly)}
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {period === 'monthly' ? 'в месяц' : 'в год'}
            </p>
            <ul className="space-y-1 mb-6 text-sm text-gray-600">
              <li>До {plan.maxUsers} сотрудников</li>
              <li>До {plan.maxLocations} {plan.maxLocations === 1 ? 'точки' : 'точек'}</li>
              {plan.features.map(f => <li key={f}>✓ {f}</li>)}
            </ul>
            <button
              onClick={() => handleCheckout(plan.slug)}
              disabled={loading && selectedPlan === plan.slug}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading && selectedPlan === plan.slug ? 'Переход...' : 'Выбрать'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Создать `src/app/(dashboard)/billing/success/page.tsx`**

```tsx
import Link from 'next/link'

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Оплата принята!</h1>
        <p className="text-gray-500 mb-6">
          Ваша подписка активирована. Статус обновится в течение нескольких секунд.
        </p>
        <Link
          href="/orders"
          className="inline-block bg-blue-600 text-white rounded-lg px-6 py-3 font-semibold hover:bg-blue-700 transition-colors"
        >
          Перейти к заказам
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Проверить сборку**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Коммит**

```bash
git add src/app/\(dashboard\)/blocked/ src/app/\(dashboard\)/billing/
git commit -m "feat(billing): add blocked, billing, and payment success pages"
```

---

### Task 11: Seed + Final Push

- [ ] **Step 1: Добавить переменные окружения в `.env.example`**

Найти или создать `.env.example` и добавить:

```
# YooKassa
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

# App URL (needed for email links and YooKassa return_url)
NEXT_PUBLIC_APP_URL=
```

- [ ] **Step 2: Запустить seed для тарифов** (только в production, после деплоя)

```bash
MONGODB_URI=<prod_uri> npx ts-node -r tsconfig-paths/register src/scripts/seedPlans.ts
```

- [ ] **Step 3: Проверить финальную сборку**

```bash
npm run build
```

Ожидаем: `✓ Compiled successfully`

- [ ] **Step 4: Финальный коммит и пуш**

```bash
git add SAAS_ARCHITECTURE.md docs/superpowers/ .env.example
git commit -m "docs: add SaaS billing architecture spec and implementation plan"
git push origin main
```

- [ ] **Step 5: Настроить webhook URL в YooKassa merchant dashboard**

```
https://<ваш_домен>/api/webhooks/yookassa
```

События для подписки: `payment.succeeded`, `payment.canceled`

---

## Self-Review

**Spec Coverage:**
- ✓ DB schema (Task 1) — все 5 коллекций
- ✓ subscriptionStatus с `past_due` (Task 1)
- ✓ Деньги в копейках (Tasks 1, 6)
- ✓ Отдельная коллекция Payment (Task 1)
- ✓ super_admin роль (Tasks 2, 3, 9)
- ✓ JWT + session callback (Task 2)
- ✓ Middleware redirect blocked (Task 3)
- ✓ requireTenantAuth() 402 для blocked (Task 3)
- ✓ requireSuperAdmin() (Task 3)
- ✓ node-cron + instrumentation.ts (Task 4)
- ✓ find() перед updateMany() — email-адреса (Task 4)
- ✓ Promise.allSettled для email (Task 4)
- ✓ Защита от pm2 cluster (Task 4)
- ✓ Защита от dev hot-reload (Task 4)
- ✓ Идемпотентность renewal (Task 6)
- ✓ save_payment_method: true при первичном платеже (Task 6)
- ✓ Верификация webhook через GET /v3/payments/{id} (Task 7)
- ✓ Без HMAC — YooKassa не использует его (Task 7)
- ✓ Billing UI pages (Task 10)
- ✓ Seed script (Task 11)
