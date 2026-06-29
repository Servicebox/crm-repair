import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/api-helpers'
import { checkSubscriptions } from '@/lib/cron/checkSubscriptions'

export const runtime = 'nodejs'

export async function POST() {
  const authResult = await requirePlatformOwner()
  if (authResult.error) return authResult.error

  try {
    await checkSubscriptions()
    return NextResponse.json({ ok: true, message: 'Subscription check completed' })
  } catch (error) {
    console.error('[cron/run] error:', error)
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 })
  }
}
