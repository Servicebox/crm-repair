import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireRole, ok, err } from '@/lib/api-helpers'
import Company from '@/models/Company'

const SETTINGS_KEY = 'labelSettings'

export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findOne().lean() as Record<string, unknown> | null
  if (!company) return ok(null)

  const settings = (company[SETTINGS_KEY] ?? null) as unknown
  return ok(settings)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const body = await req.json() as unknown
  if (typeof body !== 'object' || body === null) {
    return err('Неверный формат данных')
  }

  const company = await Company.findOneAndUpdate(
    {},
    { $set: { [SETTINGS_KEY]: body } },
    { new: true, upsert: true },
  )
  const doc = company as unknown as Record<string, unknown>
  return ok(doc[SETTINGS_KEY])
}
