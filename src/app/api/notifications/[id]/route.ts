import { NextRequest } from 'next/server'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { models: { Notification } } = authResult

  const { id } = await params

  const notification = await Notification.findByIdAndUpdate(
    id,
    { read: true },
    { new: true }
  )
  if (!notification) return err('Уведомление не найдено', 404)

  return ok(notification)
}
