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
