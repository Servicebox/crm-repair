import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireRole, ok, err } from '@/lib/api-helpers'
import User from '@/models/User'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const body = await req.json()
  const user = await User.findByIdAndUpdate(
    params.id,
    { $set: body },
    { new: true }
  ).select('-password -emailVerificationToken -passwordResetToken')
  if (!user) return err('Сотрудник не найден', 404)
  return ok(user)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  await User.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
