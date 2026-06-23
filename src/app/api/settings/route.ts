import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Company from '@/models/Company'

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findOne().lean()
  if (!company) return err('Компания не найдена', 404)
  return ok(company)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  const body = await req.json()
  const company = await Company.findOneAndUpdate({}, { $set: body }, { new: true, upsert: true })
  return ok(company)
}
