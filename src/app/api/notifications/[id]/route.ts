import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Notification from '@/models/Notification'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  const { id } = await params
  await connectToDatabase()

  const notification = await Notification.findByIdAndUpdate(
    id,
    { read: true },
    { new: true }
  )
  if (!notification) return err('Уведомление не найдено', 404)

  return ok(notification)
}
