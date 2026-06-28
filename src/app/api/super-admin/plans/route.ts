import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import PlanConfig from '@/models/PlanConfig'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  await connectToDatabase()
  const plans = await PlanConfig.find().sort({ sortOrder: 1 }).lean()

  return NextResponse.json({ success: true, data: plans })
}
