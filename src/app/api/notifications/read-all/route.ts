import { requireTenantAuth, ok } from '@/lib/api-helpers'

export async function PATCH() {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { models: { Notification } } = authResult

  await Notification.updateMany({ read: false }, { read: true })

  return ok({ success: true })
}
