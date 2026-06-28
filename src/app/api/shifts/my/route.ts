import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import mongoose from 'mongoose'

const OpenSchema = z.object({
  openCashAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
})

const CloseSchema = z.object({
  closeCashAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
})

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

export async function POST(req: Request) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { session, models: { Shift } } = auth

  const body = await req.json().catch(() => ({}))
  const parsed = OpenSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Ошибка валидации')

  const uid = new mongoose.Types.ObjectId(session!.user.id)

  const existing = await Shift.findOne({ userId: uid, status: 'open' })
  if (existing) return err('Смена уже открыта', 409)

  const shift = await Shift.create({
    userId: uid,
    openedBy: uid,
    openedAt: new Date(),
    status: 'open',
    openCashAmount: parsed.data.openCashAmount,
    notes: parsed.data.notes,
    cashWithdrawals: [],
  })

  return ok(shift, 201)
}

export async function PATCH(req: Request) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { session, models: { Shift, Transaction } } = auth

  const uid = new mongoose.Types.ObjectId(session!.user.id)

  const body = await req.json().catch(() => ({}))
  const parsed = CloseSchema.safeParse(body)

  const shift = await Shift.findOne({ userId: uid, status: 'open' })
  if (!shift) return err('Открытая смена не найдена', 404)

  const closedAt = new Date()
  const durationMinutes = Math.floor((closedAt.getTime() - shift.openedAt.getTime()) / 60000)

  // Считаем наличные продажи за период смены
  const cashSalesTotal = await (async () => {
    try {
      const txs = await Transaction.find({
        type: 'income',
        paymentMethod: 'cash',
        date: { $gte: shift.openedAt, $lte: closedAt },
      }).lean()
      return (txs as unknown as Array<{ amount: number }>).reduce((s, t) => s + (t.amount ?? 0), 0)
    } catch { return 0 }
  })()

  const totalWithdrawals = shift.cashWithdrawals.reduce((s: number, w: { amount: number }) => s + w.amount, 0)
  const closeCashAmount = parsed.success && parsed.data.closeCashAmount !== undefined
    ? parsed.data.closeCashAmount
    : undefined

  let cashDiscrepancy: number | undefined
  if (closeCashAmount !== undefined) {
    const expected = (shift.openCashAmount ?? 0) + cashSalesTotal - totalWithdrawals
    cashDiscrepancy = closeCashAmount - expected
  }

  shift.closedAt = closedAt
  shift.durationMinutes = durationMinutes
  shift.status = 'closed'
  if (closeCashAmount !== undefined) shift.closeCashAmount = closeCashAmount
  if (cashDiscrepancy !== undefined) shift.cashDiscrepancy = cashDiscrepancy
  if (parsed.success && parsed.data.notes !== undefined) shift.notes = parsed.data.notes
  await shift.save()

  return ok({ ...shift.toObject(), cashSalesTotal, totalWithdrawals })
}
