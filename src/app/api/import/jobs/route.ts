import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ImportJob from '@/models/ImportJob'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const status = searchParams.get('status')

  const filter: Record<string, unknown> = {
    organization_id: new mongoose.Types.ObjectId(session.user.companyId),
  }
  if (status) filter.status = status

  const [jobs, total] = await Promise.all([
    ImportJob.find(filter)
      .select('-errors -mapping -analysis.detected_columns')  // keep response lean
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ImportJob.countDocuments(filter),
  ])

  return NextResponse.json({
    success: true,
    data: {
      jobs,
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  })
}
