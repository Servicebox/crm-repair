import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok } from '@/lib/api-helpers'
import Shift from '@/models/Shift'
import mongoose from 'mongoose'

export async function GET() {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error
  const { session } = authResult

  await connectToDatabase()

  const shift = await Shift.findOne({
    userId: new mongoose.Types.ObjectId(session!.user.id),
    status: 'open',
  }).lean()

  return ok(shift)
}
