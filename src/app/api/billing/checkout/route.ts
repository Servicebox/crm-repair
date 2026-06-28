import { NextResponse } from 'next/server'
import { requireTenantAuth } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'
import { createInitialPayment } from '@/lib/payments/yookassa'
import { Types } from 'mongoose'
import { z } from 'zod'

const CheckoutSchema = z.object({
  planSlug: z.enum(['start', 'pro', 'business']),
  billingPeriod: z.enum(['monthly', 'yearly']),
})

export async function POST(request: Request) {
  const { session, error } = await requireTenantAuth()
  if (error) return error

  const body: unknown = await request.json()
  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  try {
    await connectToDatabase()

    // IDOR protection: always use companyId from the server session
    const companyId = session!.user.companyId
    const company = await Company.findById(new Types.ObjectId(companyId))
      .select('discountPercentage')
      .lean()

    const discountPercentage = company?.discountPercentage ?? 0

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || 'http://localhost:3000'

    const result = await createInitialPayment({
      companyId,
      planSlug: parsed.data.planSlug,
      billingPeriod: parsed.data.billingPeriod,
      discountPercentage,
      returnUrl: `${baseUrl}/billing/success`,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[billing/checkout] error:', err)
    return NextResponse.json({ success: false, error: 'Payment creation failed' }, { status: 500 })
  }
}
