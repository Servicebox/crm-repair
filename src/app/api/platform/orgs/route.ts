import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'
import User from '@/models/User'

function isPlatformOwner(email: string | null | undefined) {
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL
  return ownerEmail && email === ownerEmail
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email || !isPlatformOwner(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectToDatabase()
  const companies = await Company.find().sort({ createdAt: -1 }).lean()

  const enriched = await Promise.all(
    companies.map(async (c) => {
      const userCount = await User.countDocuments({ companyId: c._id })
      return { ...c, userCount }
    })
  )

  return NextResponse.json({ data: enriched })
}
