import { NextRequest } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'

const AddSchema = z.object({
  type: z.enum(['bonus', 'deduction']),
  amount: z.number().min(0.01),
  reason: z.string().min(1),
})

const RemoveSchema = z.object({
  type: z.enum(['bonus', 'deduction']),
  adjustmentId: z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { session, models: { PayrollRecord } } = auth

  const { id } = await params
  const body = await req.json()
  const parsed = AddSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const record = await PayrollRecord.findById(id)
  if (!record) return err('Запись не найдена', 404)
  if (record.status === 'paid') return err('Нельзя изменять выплаченную запись', 409)

  const item = {
    _id: new mongoose.Types.ObjectId(),
    amount: parsed.data.amount,
    reason: parsed.data.reason,
    addedAt: new Date(),
    addedBy: new mongoose.Types.ObjectId(session!.user.id),
  }

  if (parsed.data.type === 'bonus') {
    record.bonuses.push(item as never)
    record.accrued += parsed.data.amount
  } else {
    record.deductions.push(item as never)
    record.accrued = Math.max(0, record.accrued - parsed.data.amount)
  }

  await record.save()
  return ok(record)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { PayrollRecord } } = auth

  const { id } = await params
  const body = await req.json()
  const parsed = RemoveSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const record = await PayrollRecord.findById(id)
  if (!record) return err('Запись не найдена', 404)
  if (record.status === 'paid') return err('Нельзя изменять выплаченную запись', 409)

  const field = parsed.data.type === 'bonus' ? 'bonuses' : 'deductions'
  const idx = record[field].findIndex((a: { _id: { toString(): string } }) => a._id.toString() === parsed.data.adjustmentId)
  if (idx === -1) return err('Корректировка не найдена', 404)

  const removed = record[field][idx]
  record[field].splice(idx, 1)

  if (parsed.data.type === 'bonus') {
    record.accrued = Math.max(0, record.accrued - removed.amount)
  } else {
    record.accrued += removed.amount
  }

  await record.save()
  return ok(record)
}
