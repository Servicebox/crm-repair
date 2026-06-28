import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'

const CloseSchema = z.object({
  notes: z.string().optional(),
  closeCashAmount: z.number().min(0).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Shift, Transaction } } = auth

  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = CloseSchema.safeParse(body)
  const notes = parsed.success ? parsed.data.notes : undefined
  const closeCashAmount = parsed.success ? parsed.data.closeCashAmount : undefined

  const shift = await Shift.findById(id)
  if (!shift) return err('Смена не найдена', 404)
  if (shift.status === 'closed') return err('Смена уже закрыта', 409)

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

  const totalWithdrawals = (shift.cashWithdrawals ?? []).reduce(
    (s: number, w: { amount: number }) => s + w.amount, 0
  )

  let cashDiscrepancy: number | undefined
  if (closeCashAmount !== undefined) {
    const expected = (shift.openCashAmount ?? 0) + cashSalesTotal - totalWithdrawals
    cashDiscrepancy = closeCashAmount - expected
  }

  shift.closedAt = closedAt
  shift.durationMinutes = durationMinutes
  shift.status = 'closed'
  if (notes !== undefined) shift.notes = notes
  if (closeCashAmount !== undefined) shift.closeCashAmount = closeCashAmount
  if (cashDiscrepancy !== undefined) shift.cashDiscrepancy = cashDiscrepancy
  await shift.save()

  return ok(shift)
}
