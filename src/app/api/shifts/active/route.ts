import { requireTenantAuth, ok } from '@/lib/api-helpers'
import mongoose from 'mongoose'

export async function GET() {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { session, models: { Shift } } = authResult

  const shift = await Shift.findOne({
    userId: new mongoose.Types.ObjectId(session!.user.id),
    status: 'open',
  }).lean()

  return ok(shift)
}
