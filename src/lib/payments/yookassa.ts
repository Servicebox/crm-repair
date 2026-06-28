import { Types } from 'mongoose'
import { connectToDatabase } from '@/lib/mongodb'
import PlanConfig, { IPlanConfig } from '@/models/PlanConfig'
import Subscription from '@/models/Subscription'
import Payment from '@/models/Payment'

const YOOKASSA_BASE_URL = 'https://api.yookassa.ru/v3'

function getBasicAuth(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  if (!shopId || !secretKey) {
    throw new Error('YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY not set')
  }
  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
}

function applyDiscount(baseKopecks: number, discountPct: number): number {
  return Math.round((baseKopecks * (100 - discountPct)) / 100)
}

// ── Первичный платёж (пользователь платит впервые) ────────────────────────────

export interface CreateCheckoutPaymentParams {
  companyId: string
  planSlug: string
  billingPeriod: 'monthly' | 'yearly'
  discountPercentage?: number
  returnUrl: string
}

export interface CreateCheckoutPaymentResult {
  /** YooKassa payment ID */
  paymentId: string
  confirmationUrl: string
  internalPaymentId: string
}

export async function createCheckoutPayment(
  params: CreateCheckoutPaymentParams
): Promise<CreateCheckoutPaymentResult> {
  await connectToDatabase()
  const { companyId, planSlug, billingPeriod, discountPercentage = 0, returnUrl } = params

  const plan = await PlanConfig.findOne({ slug: planSlug, isActive: true }).lean<IPlanConfig>()
  if (!plan) throw new Error(`Plan not found: ${planSlug}`)

  const baseAmount = billingPeriod === 'yearly' ? plan.priceYearly : plan.priceMonthly
  const finalAmount = applyDiscount(baseAmount, discountPercentage)

  const startDate = new Date()
  const durationMs =
    billingPeriod === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
  const endDate = new Date(startDate.getTime() + durationMs)

  // Create Subscription and Payment records before calling YooKassa
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

  const idempotenceKey = `initial-${String(internalPayment._id)}`

  const response = await fetch(`${YOOKASSA_BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
      Authorization: getBasicAuth(),
    },
    body: JSON.stringify({
      amount: { value: (finalAmount / 100).toFixed(2), currency: 'RUB' },
      save_payment_method: true, // Required to get savedPaymentMethodId for auto-renewal
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

  const data = (await response.json()) as {
    id: string
    confirmation: { confirmation_url: string }
  }

  await Payment.updateOne(
    { _id: internalPayment._id },
    { $set: { yookassaPaymentId: data.id } }
  )

  return {
    paymentId: data.id,
    confirmationUrl: data.confirmation.confirmation_url,
    internalPaymentId: String(internalPayment._id),
  }
}

/**
 * Alias used by Tasks 7 & 8 that import createInitialPayment per the SDD spec.
 * Includes `yookassaPaymentId` for backward-compat in addition to `paymentId`.
 */
export type CreateInitialPaymentParams = CreateCheckoutPaymentParams
export interface CreateInitialPaymentResult extends CreateCheckoutPaymentResult {
  yookassaPaymentId: string
}

export async function createInitialPayment(
  params: CreateInitialPaymentParams
): Promise<CreateInitialPaymentResult> {
  const result = await createCheckoutPayment(params)
  return { ...result, yookassaPaymentId: result.paymentId }
}

// ── Авторенью (cron, без участия пользователя) ───────────────────────────────

export interface RenewalPaymentResult {
  paymentId: string
  status: string
}

export async function initiateRenewalPayment(subscription: {
  _id: unknown
  companyId: unknown
  planSlug: string
  billingPeriod: 'monthly' | 'yearly'
  discountPercentage?: number
  savedPaymentMethodId?: string
}): Promise<RenewalPaymentResult> {
  await connectToDatabase()

  // Idempotency guard: skip if a pending Payment already exists for this subscription in the last 24h
  const existing = await Payment.findOne({
    subscriptionId: subscription._id,
    status: 'pending',
    createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  })
  if (existing) {
    console.log('[yookassa] renewal already pending for subscription', subscription._id)
    return { paymentId: String(existing.yookassaPaymentId ?? ''), status: 'pending' }
  }

  const plan = await PlanConfig.findOne({ slug: subscription.planSlug }).lean<IPlanConfig>()
  if (!plan) throw new Error(`Plan not found: ${subscription.planSlug}`)

  const baseAmount =
    subscription.billingPeriod === 'yearly' ? plan.priceYearly : plan.priceMonthly
  const finalAmount = applyDiscount(baseAmount, subscription.discountPercentage ?? 0)

  const internalPayment = await Payment.create({
    companyId: subscription.companyId,
    subscriptionId: subscription._id,
    amount: finalAmount,
    status: 'pending',
  })

  const idempotenceKey = `renewal-${String(subscription._id)}-${String(internalPayment._id)}`

  try {
    const response = await fetch(`${YOOKASSA_BASE_URL}/payments`, {
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

    const data = (await response.json()) as { id: string; status: string }

    await Payment.updateOne(
      { _id: internalPayment._id },
      { $set: { yookassaPaymentId: data.id } }
    )

    return { paymentId: data.id, status: data.status }
  } catch (error) {
    await Payment.updateOne({ _id: internalPayment._id }, { $set: { status: 'failed' } })
    throw error
  }
}

// ── Верификация платежа через YooKassa ────────────────────────────────────────

export interface YookassaPaymentObject {
  id: string
  status: string
  amount: { value: string; currency: string }
  payment_method?: {
    type: string
    id?: string
    saved?: boolean
  }
  metadata?: Record<string, string>
  created_at: string
  captured_at?: string
  description?: string
}

/**
 * Fetches the current state of a payment from YooKassa.
 * Use this to verify webhook payloads by comparing the returned status with
 * the webhook event status (YooKassa uses GET-based verification, not HMAC).
 */
export async function verifyPaymentWithYookassa(
  paymentId: string
): Promise<YookassaPaymentObject> {
  const response = await fetch(`${YOOKASSA_BASE_URL}/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: getBasicAuth(),
    },
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`YooKassa ${response.status}: ${errText}`)
  }

  return response.json() as Promise<YookassaPaymentObject>
}
