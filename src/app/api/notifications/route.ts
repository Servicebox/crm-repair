import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok } from '@/lib/api-helpers'
import Notification from '@/models/Notification'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  await connectToDatabase()

  const countOnly = req.nextUrl.searchParams.get('count') === 'unread'

  if (countOnly) {
    const count = await Notification.countDocuments({ read: false })
    return ok({ count })
  }

  const notifications = await Notification.find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  return ok(notifications)
}
