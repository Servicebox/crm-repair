import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'

const UpdateCompanySchema = z.object({
  subscriptionStatus: z
    .enum(['trial', 'active', 'past_due', 'blocked', 'free'])
    .optional(),
  subscriptionPlan: z.string().optional(),
  subscriptionEndDate: z.string().datetime().optional(),
  trialEndDate: z.string().datetime().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateCompanySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  await connectToDatabase()
  const company = await Company.findByIdAndUpdate(
    params.id,
    { $set: parsed.data },
    { new: true }
  ).select(
    'name subscriptionStatus subscriptionPlan subscriptionEndDate discountPercentage'
  )

  if (!company) {
    return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: company })
}
