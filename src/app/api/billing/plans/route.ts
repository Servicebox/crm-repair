import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import PlanConfig from '@/models/PlanConfig'

// Public endpoint — no auth required
export async function GET() {
  try {
    await connectToDatabase()
    const plans = await PlanConfig.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .select('slug name priceMonthly priceYearly maxUsers maxLocations features')
      .lean()

    return NextResponse.json({ success: true, data: plans })
  } catch (err) {
    console.error('[billing/plans] error:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch plans' }, { status: 500 })
  }
}
