import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import { getTenantConnection, getDefaultDbName } from '@/lib/tenantDb'
import { getUserModel } from '@/models/User'
import Company from '@/models/Company'
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

  const defaultDb = getDefaultDbName()

  // Count users per company from the correct DB (tenant or default)
  const enriched = await Promise.all(companies.map(async (c) => {
    let userCount = 0
    try {
      const dbName = (c as { dbName?: string }).dbName
      if (dbName && dbName !== defaultDb) {
        const conn = await getTenantConnection(dbName)
        const TenantUser = getUserModel(conn)
        userCount = await TenantUser.countDocuments({ companyId: c._id })
      } else {
        // Count from default DB
        const DefaultUser = getUserModel(mongoose.connection)
        userCount = await DefaultUser.countDocuments({ companyId: c._id })
      }
    } catch {
      userCount = 0
    }
    return { ...c, userCount }
  }))

  return NextResponse.json({ data: enriched })
}

// Permanently delete an org and all its data — only platform owner
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email || !isPlatformOwner(session.user.email)) return forbidden()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  await connectToDatabase()
  const company = await Company.findById(id).lean() as ({ dbName?: string; _id: mongoose.Types.ObjectId } & Record<string, unknown>) | null
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Protect the platform owner's own company from deletion
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL
  if (ownerEmail) {
    const DefaultUser = getUserModel(mongoose.connection)
    const ownerUser = await DefaultUser.findOne({ email: ownerEmail }).lean() as { companyId?: { toString(): string } } | null
    if (ownerUser?.companyId?.toString() === id) {
      return NextResponse.json({ error: 'Нельзя удалить организацию платформенного владельца' }, { status: 403 })
    }
  }

  const defaultDb = getDefaultDbName()
  const tenantDb = company.dbName

  // Check how many other companies share the same tenant DB
  const sharedCount = tenantDb
    ? await Company.countDocuments({ _id: { $ne: company._id }, dbName: tenantDb })
    : 0

  // Delete the company record
  await Company.findByIdAndDelete(id)

  if (tenantDb && tenantDb !== defaultDb && sharedCount === 0) {
    // Drop the entire tenant database — no other company uses it
    try {
      const conn = await getTenantConnection(tenantDb)
      await conn.dropDatabase()
    } catch {
      // Non-fatal: DB may not exist yet
    }
  } else {
    // Shared DB, default DB, or company has no dbName — delete users belonging to this company
    try {
      const conn = (tenantDb && tenantDb !== defaultDb)
        ? await getTenantConnection(tenantDb)
        : mongoose.connection
      const TenantUser = getUserModel(conn)
      await TenantUser.deleteMany({ companyId: company._id })
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ data: { deleted: id } })
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
