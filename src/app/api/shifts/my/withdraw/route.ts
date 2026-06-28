import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import mongoose from 'mongoose'

const WithdrawSchema = z.object({
  amount: z.number().positive('Сумма должна быть больше нуля'),
  reason: z.string().min(1, 'Укажите причину изъятия'),
})

export async function POST(req: Request) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { session, models: { Shift, Transaction } } = auth

  const body = await req.json().catch(() => ({}))
  const parsed = WithdrawSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Ошибка валидации')

  const uid = new mongoose.Types.ObjectId(session!.user.id)

  const shift = await Shift.findOne({ userId: uid, status: 'open' })
  if (!shift) return err('Нет открытой смены', 404)

  const withdrawal = {
    amount: parsed.data.amount,
    reason: parsed.data.reason,
    withdrawnAt: new Date(),
    withdrawnBy: uid,
  }

  shift.cashWithdrawals.push(withdrawal as never)
  await shift.save()

  // Фиксируем изъятие как расходную транзакцию
  await Transaction.create({
    type: 'expense',
    category: 'cash_withdrawal',
    amount: parsed.data.amount,
    description: `Изъятие из кассы: ${parsed.data.reason}`,
    paymentMethod: 'cash',
    createdBy: session!.user.id,
    date: new Date(),
  })

  return ok(shift)
}
