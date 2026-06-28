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

// Type for the email module — sendSubscriptionEmail is added in Task 5
type EmailModule = typeof import('@/lib/email') & {
  sendSubscriptionEmail?: (
    email: string,
    type: string,
    data: Record<string, unknown>
  ) => Promise<void>
}

export async function checkSubscriptions(): Promise<CronResult> {
  await connectToDatabase()
  const now = new Date()
  const gracePeriodEnd = new Date(now.getTime() + GRACE_PERIOD_MS)
  const renewalTrigger = new Date(now.getTime() + RENEWAL_TRIGGER_MS)

  // Dynamic import to avoid circular deps — sendSubscriptionEmail added in Task 5
  const emailModule = (await import('@/lib/email')) as EmailModule
  const sendSubscriptionEmail = emailModule.sendSubscriptionEmail

  // 1. Trial period expired → blocked
  const trialExpired = await Company.find(
    { subscriptionStatus: 'trial', trialEndDate: { $lt: now } },
    { _id: 1, email: 1, name: 1 }
  ).lean<Array<{ _id: unknown; email?: string; name: string }>>()

  if (trialExpired.length > 0) {
    await Company.updateMany(
      { _id: { $in: trialExpired.map(c => c._id) } },
      { $set: { subscriptionStatus: 'blocked' } }
    )
    if (typeof sendSubscriptionEmail === 'function') {
      await Promise.allSettled(
        trialExpired
          .filter(c => c.email)
          .map(c =>
            sendSubscriptionEmail!(c.email!, 'trial_blocked', { name: c.name })
          )
      )
    }
  }

  // 2. Grace period expired → blocked
  const pastDueExpired = await Company.find(
    { subscriptionStatus: 'past_due', pastDueUntil: { $lt: now } },
    { _id: 1, email: 1, name: 1 }
  ).lean<Array<{ _id: unknown; email?: string; name: string }>>()

  if (pastDueExpired.length > 0) {
    await Company.updateMany(
      { _id: { $in: pastDueExpired.map(c => c._id) } },
      { $set: { subscriptionStatus: 'blocked' } }
    )
    if (typeof sendSubscriptionEmail === 'function') {
      await Promise.allSettled(
        pastDueExpired
          .filter(c => c.email)
          .map(c =>
            sendSubscriptionEmail!(c.email!, 'subscription_blocked', {
              name: c.name,
            })
          )
      )
    }
  }

  // 3. autoRenew: true — initiate payment 24h before expiry
  const renewalDue = await Subscription.find({
    status: 'active',
    autoRenew: true,
    endDate: { $gt: now, $lte: renewalTrigger },
    savedPaymentMethodId: { $exists: true, $ne: null },
  }).lean()

  let renewalInitiated = 0
  for (const sub of renewalDue) {
    try {
      // Dynamic import so YooKassa SDK is not loaded in dev mode (Task 6).
      // Non-literal path prevents TS2307 while the module is not yet created.
      const yookassaPath = '@/lib/payments/yookassa'
      const { initiateRenewalPayment } = (await import(yookassaPath)) as {
        initiateRenewalPayment: (sub: unknown) => Promise<void>
      }
      await initiateRenewalPayment(sub)
      renewalInitiated++
    } catch (err) {
      console.error('[cron] renewal failed for subscription', sub._id, err)
      await Company.updateOne(
        { _id: (sub as { companyId: unknown }).companyId },
        { $set: { subscriptionStatus: 'past_due', pastDueUntil: gracePeriodEnd } }
      )
    }
  }

  // 4. Payment not processed / autoRenew off → past_due
  const activeExpired = await Company.find(
    { subscriptionStatus: 'active', subscriptionEndDate: { $lt: now } },
    { _id: 1, email: 1, name: 1 }
  ).lean<Array<{ _id: unknown; email?: string; name: string }>>()

  if (activeExpired.length > 0) {
    await Company.updateMany(
      { _id: { $in: activeExpired.map(c => c._id) } },
      { $set: { subscriptionStatus: 'past_due', pastDueUntil: gracePeriodEnd } }
    )
    if (typeof sendSubscriptionEmail === 'function') {
      await Promise.allSettled(
        activeExpired
          .filter(c => c.email)
          .map(c =>
            sendSubscriptionEmail!(c.email!, 'payment_past_due', {
              name: c.name,
            })
          )
      )
    }
  }

  // 5. Sync Subscription documents
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
