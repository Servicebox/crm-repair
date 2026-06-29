import { NextResponse } from 'next/server'
import { requireTenantAuth } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import Subscription from '@/models/Subscription'
import Company from '@/models/Company'
import { Types } from 'mongoose'

export async function GET() {
  const { session, error } = await requireTenantAuth()
  if (error) return error

  if (!session!.user.companyId) {
    return NextResponse.json({ success: true, data: { company: null, subscription: null } })
  }

  try {
    await connectToDatabase()
    const companyId = new Types.ObjectId(session!.user.companyId)

    const [company, subscription] = await Promise.all([
      Company.findById(companyId)
        .select(
          'subscriptionStatus subscriptionPlan subscriptionEndDate trialEndDate pastDueUntil discountPercentage'
        )
        .lean(),
      Subscription.findOne({ companyId, status: 'active' })
        .select('planSlug billingPeriod startDate endDate autoRenew finalAmount')
        .lean(),
    ])

    return NextResponse.json({ success: true, data: { company, subscription } })
  } catch (err) {
    console.error('[billing/subscription] error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}
