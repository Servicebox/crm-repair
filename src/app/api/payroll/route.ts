import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import PayrollRecord from '@/models/PayrollRecord'
import Order from '@/models/Order'
import User from '@/models/User'
import mongoose from 'mongoose'

const PostSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  userId: z.string().optional(),
})

interface SalaryConfig {
  type: 'percent_revenue' | 'percent_profit' | 'fixed' | 'rate_per_order'
  value: number
  guaranteed?: number
}

function calculateAccrued(
  salary: SalaryConfig | undefined,
  revenue: number,
  profit: number,
  ordersCount: number,
): number {
  if (!salary?.type) return 0
  let base = 0
  if (salary.type === 'percent_revenue') base = revenue * (salary.value / 100)
  else if (salary.type === 'percent_profit') base = profit * (salary.value / 100)
  else if (salary.type === 'fixed') base = salary.value
  else if (salary.type === 'rate_per_order') base = ordersCount * salary.value
  return Math.max(base, salary.guaranteed ?? 0)
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error
  const { session } = authResult

  await connectToDatabase()

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

  if (monthParam) {
    filter.month = monthParam
  }

  const records = await PayrollRecord.find(filter).lean()
  return ok(records)
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error
  const { session } = authResult

  const body = await req.json()
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { month } = parsed.data
  const isPrivileged = session!.user.role === 'owner' || session!.user.role === 'admin'

  const targetUserId = isPrivileged && parsed.data.userId
    ? parsed.data.userId
    : session!.user.id

  await connectToDatabase()

  const user = await User.findById(targetUserId).lean()
  if (!user) return err('Сотрудник не найден', 404)

  // Build date range for the month
  const [year, monthNum] = month.split('-').map(Number)
  const startDate = new Date(year, monthNum - 1, 1)
  const endDate = new Date(year, monthNum, 1)

  let masterId: mongoose.Types.ObjectId
  try {
    masterId = new mongoose.Types.ObjectId(targetUserId)
  } catch {
    return err('Неверный идентификатор сотрудника', 400)
  }

  const orders = await Order.find({
    masterId,
    status: 'issued',
    createdAt: { $gte: startDate, $lt: endDate },
  }).lean()

  const ordersCount = orders.length
  const worksCount = orders.reduce((sum, o) => sum + (o.works?.length ?? 0), 0)
  const revenue = orders.reduce((sum, o) => sum + (o.finalCost ?? 0), 0)
  // Profit approximation: finalCost minus parts cost
  const profit = orders.reduce((sum, o) => {
    const partsCost = (o.parts ?? []).reduce((ps: number, p: { cost: number; quantity: number }) => ps + p.cost * p.quantity, 0)
    return sum + (o.finalCost ?? 0) - partsCost
  }, 0)

  const accrued = calculateAccrued(
    user.salary as SalaryConfig | undefined,
    revenue,
    profit,
    ordersCount,
  )

  const record = await PayrollRecord.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(targetUserId), month },
    {
      $set: {
        ordersCount,
        worksCount,
        revenue,
        profit,
        accrued,
        // Only reset paid/status if recalculating a pending record
      },
      $setOnInsert: {
        paid: 0,
        status: 'pending',
      },
    },
    { upsert: true, new: true },
  )

  return ok(record)
}
