import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'
import Company from '@/models/Company'

const SETTINGS_KEY = 'cashierSettings'

export async function GET() {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findOne({ dbName: auth.session!.user.dbName }).lean() as Record<string, unknown> | null
  if (!company) return ok(null)

  const settings = (company[SETTINGS_KEY] ?? null) as unknown
  return ok(settings)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const body = await req.json() as unknown
  if (typeof body !== 'object' || body === null) {
    return err('Неверный формат данных')
  }

  const company = await Company.findOneAndUpdate(
    { dbName: auth.session!.user.dbName },
    { $set: { [SETTINGS_KEY]: body } },
    { new: true, upsert: true },
  )
  const doc = company as unknown as Record<string, unknown>
  return ok(doc[SETTINGS_KEY])
}
