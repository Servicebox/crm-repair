import { NextRequest } from 'next/server'
import { requireTenantAuth, ok } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { models: { Notification } } = authResult

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
