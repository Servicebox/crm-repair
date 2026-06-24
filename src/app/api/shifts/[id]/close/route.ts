import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireRole, ok, err } from '@/lib/api-helpers'
import Shift from '@/models/Shift'

const CloseSchema = z.object({
  notes: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = CloseSchema.safeParse(body)
  const notes = parsed.success ? parsed.data.notes : undefined

  await connectToDatabase()

  const shift = await Shift.findById(id)
  if (!shift) return err('Смена не найдена', 404)
  if (shift.status === 'closed') return err('Смена уже закрыта', 409)

  const closedAt = new Date()
  const durationMinutes = Math.floor((closedAt.getTime() - shift.openedAt.getTime()) / 60000)

  shift.closedAt = closedAt
  shift.durationMinutes = durationMinutes
  shift.status = 'closed'
  if (notes !== undefined) shift.notes = notes
  await shift.save()

  return ok(shift)
}
