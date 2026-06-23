import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, requireRole, ok } from '@/lib/api-helpers'
import Location from '@/models/Location'

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  const locations = await Location.find({ isActive: true }).lean()
  return ok(locations)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  const body = await req.json()
  await connectToDatabase()
  const location = await Location.create(body)
  return ok(location, 201)
}
