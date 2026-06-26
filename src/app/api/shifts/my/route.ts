import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import mongoose from 'mongoose'

export async function GET() {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { session, models: { Shift } } = auth

  const shift = await Shift.findOne({
    userId: new mongoose.Types.ObjectId(session!.user.id),
    status: 'open',
  }).lean()

  return ok(shift)
}

export async function POST() {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { session, models: { Shift } } = auth

  const uid = new mongoose.Types.ObjectId(session!.user.id)

  const existing = await Shift.findOne({ userId: uid, status: 'open' })
  if (existing) return err('Смена уже открыта', 409)

  const shift = await Shift.create({
    userId: uid,
    openedBy: uid,
    openedAt: new Date(),
    status: 'open',
  })

  return ok(shift, 201)
}

export async function PATCH() {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { session, models: { Shift } } = auth

  const uid = new mongoose.Types.ObjectId(session!.user.id)

  const shift = await Shift.findOne({ userId: uid, status: 'open' })
  if (!shift) return err('Открытая смена не найдена', 404)

  const closedAt = new Date()
  const durationMinutes = Math.floor(
    (closedAt.getTime() - shift.openedAt.getTime()) / 60000
  )

  shift.closedAt = closedAt
  shift.durationMinutes = durationMinutes
  shift.status = 'closed'
  await shift.save()

  return ok(shift)
}
