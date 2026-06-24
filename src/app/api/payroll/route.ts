import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import mongoose from 'mongoose'

const PostSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  userId: z.string().optional(),
})

interface SalaryConfig {
  type: 'percent_revenue' | 'percent_profit' | 'fixed' | 'rate_per_order' | 'hourly'
  value: number
  hourlyRate?: number
  overtimeMultiplier?: number
  guaranteed?: number
}

function calculateAccrued(
  salary: SalaryConfig | undefined,
  revenue: number,
  profit: number,
  ordersCount: number,
  hoursWorked: number,
): number {
  if (!salary?.type) return 0
  let base = 0
  if (salary.type === 'percent_revenue') base = revenue * (salary.value / 100)
  else if (salary.type === 'percent_profit') base = profit * (salary.value / 100)
  else if (salary.type === 'fixed') base = salary.value
  else if (salary.type === 'rate_per_order') base = ordersCount * salary.value
  else if (salary.type === 'hourly') {
    const rate = salary.hourlyRate ?? salary.value
    base = hoursWorked * rate
  }
  return Math.max(base, salary.guaranteed ?? 0)
}

export async function GET(req: NextRequest) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { session, models: { PayrollRecord } } = authResult

  const { searchParams } = req.nextUrl
  const monthParam = searchParams.get('month')
  const userIdParam = searchParams.get('userId')

  const isPrivileged = session!.user.role === 'owner' || session!.user.role === 'admin'
  const filter: Record<string, unknown> = {}

  try {
    if (isPrivileged && userIdParam) {
      filter.userId = new mongoose.Types.ObjectId(userIdParam)
    } else if (!isPrivileged) {
      filter.userId = new mongoose.Types.ObjectId(session!.user.id)
    }
  } catch {
    return err('Неверный идентификатор пользователя', 400)
  }

  if (monthParam) filter.month = monthParam

  const records = await PayrollRecord.find(filter).lean()
  return ok(records)
}

export async function POST(req: NextRequest) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { session, models: { PayrollRecord, Order, Shift, User } } = authResult

  const body = await req.json()
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { month } = parsed.data
  const isPrivileged = session!.user.role === 'owner' || session!.user.role === 'admin'
  const targetUserId = isPrivileged && parsed.data.userId ? parsed.data.userId : session!.user.id

  const user = await User.findById(targetUserId).lean()
  if (!user) return err('Сотрудник не найден', 404)

  const [year, monthNum] = month.split('-').map(Number)
  const startDate = new Date(year, monthNum - 1, 1)
  const endDate = new Date(year, monthNum, 1)

  let masterId: mongoose.Types.ObjectId
  try {
    masterId = new mongoose.Types.ObjectId(targetUserId)
  } catch {
    return err('Неверный идентификатор сотрудника', 400)
  }

  const [orders, shifts] = await Promise.all([
    Order.find({
      masterId,
      status: 'issued',
      createdAt: { $gte: startDate, $lt: endDate },
    }).lean(),
    Shift.find({
      userId: masterId,
      status: 'closed',
      openedAt: { $gte: startDate, $lt: endDate },
    }).lean(),
  ])

  const ordersCount = orders.length
  type LeanOrder = { works?: unknown[]; finalCost?: number; parts?: Array<{cost: number; quantity: number}> }
  type LeanShift = { durationMinutes?: number }
  const worksCount = (orders as LeanOrder[]).reduce((sum, o) => sum + (o.works?.length ?? 0), 0)
  const revenue = (orders as LeanOrder[]).reduce((sum, o) => sum + (o.finalCost ?? 0), 0)
  const profit = (orders as LeanOrder[]).reduce((sum, o) => {
    const partsCost = (o.parts ?? []).reduce((ps, p) => ps + p.cost * p.quantity, 0)
    return sum + (o.finalCost ?? 0) - partsCost
  }, 0)

  const totalMinutes = (shifts as LeanShift[]).reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)
  const hoursWorked = Math.round((totalMinutes / 60) * 100) / 100
  const shiftsCount = shifts.length

  const baseAccrued = calculateAccrued(
    user.salary as SalaryConfig | undefined,
    revenue,
    profit,
    ordersCount,
    hoursWorked,
  )

  // Preserve existing adjustments when recalculating
  const existing = await PayrollRecord.findOne({
    userId: masterId,
    month,
  })

  const bonusTotal = existing ? existing.bonuses.reduce((s: number, b: {amount: number}) => s + b.amount, 0) : 0
  const deductionTotal = existing ? existing.deductions.reduce((s: number, d: {amount: number}) => s + d.amount, 0) : 0
  const accrued = Math.max(0, baseAccrued + bonusTotal - deductionTotal)

  const record = await PayrollRecord.findOneAndUpdate(
    { userId: masterId, month },
    {
      $set: {
        ordersCount,
        worksCount,
        revenue,
        profit,
        hoursWorked,
        shiftsCount,
        accrued,
      },
      $setOnInsert: {
        paid: 0,
        status: 'pending',
        bonuses: [],
        deductions: [],
      },
    },
    { upsert: true, new: true }
  )

  return ok(record)
}
