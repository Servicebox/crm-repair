import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformOwner } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import PlanConfig from '@/models/PlanConfig'

const UpdatePlanSchema = z.object({
  priceMonthly: z.number().int('priceMonthly must be an integer (kopecks)').positive().optional(),
  priceYearly: z.number().int('priceYearly must be an integer (kopecks)').positive().optional(),
  isActive: z.boolean().optional(),
  features: z.array(z.string()).optional(),
  maxUsers: z.number().int().positive().optional(),
  maxLocations: z.number().int().positive().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { error } = await requirePlatformOwner()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdatePlanSchema.safeParse(body)
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
  const plan = await PlanConfig.findOneAndUpdate(
    { slug: params.slug },
    { $set: parsed.data },
    { new: true }
  )

  if (!plan) {
    return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: plan })
}
