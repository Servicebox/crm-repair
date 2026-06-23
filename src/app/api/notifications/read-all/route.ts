import { requireAuth, ok } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import Notification from '@/models/Notification'

export async function PATCH() {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  await connectToDatabase()
  await Notification.updateMany({ read: false }, { read: true })

  return ok({ success: true })
}
