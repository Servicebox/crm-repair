import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'
import User from '@/models/User'
import mongoose from 'mongoose'

function isPlatformOwner(email: string | null | undefined) {
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL
  return ownerEmail && email === ownerEmail
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email || !isPlatformOwner(session.user.email)) return forbidden()

  await connectToDatabase()
  const companies = await Company.find().sort({ createdAt: -1 }).lean()

  // Single aggregation to count users per company instead of N queries
  const companiesWithUsers = await User.aggregate([
    { $group: { _id: '$companyId', count: { $sum: 1 } } },
  ])
  const userCountMap = new Map(companiesWithUsers.map(r => [r._id?.toString(), r.count as number]))

  const enriched = companies.map(c => ({
    ...c,
    userCount: userCountMap.get(c._id.toString()) ?? 0,
  }))

  return NextResponse.json({ data: enriched })
}

// Toggle org active/inactive — only platform owner
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email || !isPlatformOwner(session.user.email)) return forbidden()

  const body = await req.json() as { id: string; isActive: boolean }
  if (!body.id || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'id and isActive required' }, { status: 400 })
  }
  if (!mongoose.Types.ObjectId.isValid(body.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  await connectToDatabase()
  const company = await Company.findByIdAndUpdate(
    body.id,
    { $set: { isActive: body.isActive } },
    { new: true }
  ).lean()

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: { id: body.id, isActive: body.isActive } })
}
