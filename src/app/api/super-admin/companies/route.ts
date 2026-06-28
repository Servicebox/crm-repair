import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  await connectToDatabase()
  const companies = await Company.find()
    .select(
      'name email subscriptionStatus subscriptionPlan subscriptionEndDate trialEndDate discountPercentage isActive createdAt'
    )
    .sort({ createdAt: -1 })
    .lean()

  return NextResponse.json({ success: true, data: companies })
}
