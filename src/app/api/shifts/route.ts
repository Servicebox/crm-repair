import { NextRequest } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireTenantRole, requireTenantAuth, ok, err } from '@/lib/api-helpers'

const OpenShiftSchema = z.object({
  userId: z.string().min(1),
  notes: z.string().optional(),
  openCashAmount: z.number().min(0).default(0),
})

export async function GET(req: NextRequest) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { session, models: { Shift } } = authResult

  const { searchParams } = req.nextUrl
  const userIdParam = searchParams.get('userId')
  const status = searchParams.get('status')
  const month = searchParams.get('month') // 'YYYY-MM'

  const isPrivileged = session!.user.role === 'owner' || session!.user.role === 'admin'

  const filter: Record<string, unknown> = {}

  if (isPrivileged && userIdParam) {
    try {
      filter.userId = new mongoose.Types.ObjectId(userIdParam)
    } catch {
      return err('Неверный ID сотрудника', 400)
    }
  } else if (!isPrivileged) {
    filter.userId = new mongoose.Types.ObjectId(session!.user.id)
  }

  if (status === 'open' || status === 'closed') filter.status = status

  if (month) {
    const [year, monthNum] = month.split('-').map(Number)
    filter.openedAt = {
      $gte: new Date(year, monthNum - 1, 1),
      $lt: new Date(year, monthNum, 1),
    }
  }

  const shifts = await Shift.find(filter)
    .populate('userId', 'name email')
    .populate('openedBy', 'name')
    .sort({ openedAt: -1 })
    .limit(200)
    .lean()

  return ok(shifts)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { session, models: { Shift } } = auth

  const body = await req.json()
  const parsed = OpenShiftSchema.safeParse(body)
  if (!parsed.success) return parsed.error.errors[0] ? err(parsed.error.errors[0].message) : err('Ошибка валидации')

  let targetUserId: mongoose.Types.ObjectId
  try {
    targetUserId = new mongoose.Types.ObjectId(parsed.data.userId)
  } catch {
    return err('Неверный ID сотрудника', 400)
  }

  const existing = await Shift.findOne({ userId: targetUserId, status: 'open' })
  if (existing) return err('У сотрудника уже открыта смена', 409)

  const shift = await Shift.create({
    userId: targetUserId,
    openedBy: new mongoose.Types.ObjectId(session!.user.id),
    openedAt: new Date(),
    status: 'open',
    notes: parsed.data.notes,
    openCashAmount: parsed.data.openCashAmount,
    cashWithdrawals: [],
  })

  return ok(shift, 201)
}
