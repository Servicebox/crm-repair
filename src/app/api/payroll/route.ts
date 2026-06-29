import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import mongoose from 'mongoose'
import {
  isFlexSalary,
  calcFlexEarnings,
  calcLegacyEarnings,
  type CalcOrder,
  type FlexSalary,
  type LegacySalary,
} from '@/lib/salary'

const PostSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  userId: z.string().optional(),
})

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

  const userSalary = user.salary as Record<string, unknown> | undefined
  const useFlexMode = isFlexSalary(userSalary as FlexSalary | LegacySalary | null | undefined)

  // Для flex-режима запрашиваем все заказы, где сотрудник мог участвовать
  const orderQuery = useFlexMode
    ? {
        status: 'issued',
        createdAt: { $gte: startDate, $lt: endDate },
        $or: [
          { masterId },
          { receivedById: masterId },
          { 'works.masterId': masterId },
        ],
      }
    : {
        masterId,
        status: 'issued',
        createdAt: { $gte: startDate, $lt: endDate },
      }

  const [orders, shifts] = await Promise.all([
    Order.find(orderQuery).lean(),
    Shift.find({
      userId: masterId,
      status: 'closed',
      openedAt: { $gte: startDate, $lt: endDate },
    }).lean(),
  ])

  type LeanWork = {
    price?: number
    discount?: number
    cost?: number
    category?: string
    masterId?: mongoose.Types.ObjectId
  }
  type LeanPart = { price?: number; quantity?: number; cost?: number }
  type LeanOrder = {
    masterId?: mongoose.Types.ObjectId
    receivedById?: mongoose.Types.ObjectId
    works?: LeanWork[]
    parts?: LeanPart[]
    discount?: number
  }
  type LeanShift = { durationMinutes?: number }

  const leanOrders = orders as LeanOrder[]

  // Статистика считается только по заказам, где сотрудник — главный мастер
  const masterOrders = leanOrders.filter(
    o => o.masterId?.toString() === targetUserId,
  )

  const ordersCount = masterOrders.length
  const worksCount = masterOrders.reduce((sum, o) => sum + (o.works?.length ?? 0), 0)

  // Выручка работ и запчастей считается раздельно.
  // worksRevenue — база для расчёта % зарплаты мастера (запчасти не входят).
  const worksRevenue = masterOrders.reduce((sum, o) => {
    const worksRev = (o.works ?? []).reduce(
      (s, w) => s + (w.price ?? 0) - (w.discount ?? 0),
      0,
    )
    return sum + worksRev
  }, 0)

  // Полная выручка для статистики (работы + запчасти − скидки)
  const revenue = masterOrders.reduce((sum, o) => {
    const worksRev = (o.works ?? []).reduce(
      (s, w) => s + (w.price ?? 0) - (w.discount ?? 0),
      0,
    )
    const partsRev = (o.parts ?? []).reduce(
      (s, p) => s + (p.price ?? 0) * (p.quantity ?? 0),
      0,
    )
    return sum + worksRev + partsRev - (o.discount ?? 0)
  }, 0)

  // Прибыль: выручка работ − себестоимость работ (запчасти не в базе)
  const profit = masterOrders.reduce((sum, o) => {
    const worksRev = (o.works ?? []).reduce(
      (s, w) => s + (w.price ?? 0) - (w.discount ?? 0),
      0,
    )
    const worksCost = (o.works ?? []).reduce((s, w) => s + (w.cost ?? 0), 0)
    return sum + Math.max(0, worksRev - worksCost)
  }, 0)

  const totalMinutes = (shifts as LeanShift[]).reduce(
    (sum, s) => sum + (s.durationMinutes ?? 0),
    0,
  )
  const hoursWorked = Math.round((totalMinutes / 60) * 100) / 100
  const shiftsCount = shifts.length

  // ─── Расчёт начислений ────────────────────────────────────────────────────

  let baseAccrued = 0
  let breakdown: unknown = null

  if (useFlexMode) {
    const calcOrders: CalcOrder[] = leanOrders.map(o => {
      const isMainMaster = o.masterId?.toString() === targetUserId
      const isIntake = o.receivedById?.toString() === targetUserId

      // Работы: явно назначенные этому мастеру, либо без мастера в его заказах
      const works = (o.works ?? [])
        .filter(
          w =>
            w.masterId?.toString() === targetUserId ||
            (!w.masterId && isMainMaster),
        )
        .map(w => ({
          price: w.price ?? 0,
          discount: w.discount ?? 0,
          cost: w.cost ?? 0,
          category: w.category,
        }))

      // Запчасти учитываются только в заказах, где мастер — главный исполнитель
      const parts = isMainMaster
        ? (o.parts ?? []).map(p => ({
            price: p.price ?? 0,
            quantity: p.quantity ?? 1,
            cost: p.cost ?? 0,
          }))
        : []

      return { works, parts, isIntake }
    })

    const result = calcFlexEarnings(
      userSalary as unknown as FlexSalary,
      calcOrders,
      { shiftsCount, hoursWorked },
    )
    baseAccrued = result.total
    breakdown = result.byRule
  } else if (userSalary) {
    // Для legacy-режима % считается только от выручки работ, запчасти не входят
    baseAccrued =
      calcLegacyEarnings(
        userSalary as unknown as LegacySalary,
        worksRevenue,
        profit,
        hoursWorked,
        ordersCount,
      ) ?? 0
  }

  // Сохраняем существующие корректировки (бонусы/вычеты)
  const existing = await PayrollRecord.findOne({ userId: masterId, month })

  const bonusTotal = existing
    ? existing.bonuses.reduce((s: number, b: { amount: number }) => s + b.amount, 0)
    : 0
  const deductionTotal = existing
    ? existing.deductions.reduce((s: number, d: { amount: number }) => s + d.amount, 0)
    : 0

  const accrued = Math.max(0, baseAccrued + bonusTotal - deductionTotal)

  const record = await PayrollRecord.findOneAndUpdate(
    { userId: masterId, month },
    {
      $set: {
        ordersCount,
        worksCount,
        revenue,
        worksRevenue,
        profit,
        hoursWorked,
        shiftsCount,
        accrued,
        breakdown,
      },
      $setOnInsert: {
        paid: 0,
        status: 'pending',
        bonuses: [],
        deductions: [],
      },
    },
    { upsert: true, new: true },
  )

  return ok(record)
}
