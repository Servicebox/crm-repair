import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireRole, ok, err } from '@/lib/api-helpers'
import PayrollRecord from '@/models/PayrollRecord'

const PatchSchema = z.object({
  paid: z.number().min(0),
  notes: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  const { id } = await params

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  await connectToDatabase()

  const record = await PayrollRecord.findById(id)
  if (!record) return err('Запись не найдена', 404)

  record.paid = parsed.data.paid
  if (parsed.data.notes !== undefined) record.notes = parsed.data.notes
  record.status = 'paid'
  record.paidAt = new Date()
  await record.save()

  return ok(record)
}
