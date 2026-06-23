import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

export function validateApiKey(request: NextRequest): boolean {
  const envKey = process.env.ADMIN_API_KEY
  if (!envKey) return false
  const auth = request.headers.get('authorization') ?? request.nextUrl.searchParams.get('api_key') ?? ''
  const key = auth.replace('Bearer ', '').trim()
  if (!key) return false
  try {
    return timingSafeEqual(Buffer.from(key), Buffer.from(envKey))
  } catch {
    return false
  }
}

export function apiUnauthorized() {
  return NextResponse.json(
    { success: false, error: 'Unauthorized. Pass Authorization: Bearer YOUR_API_KEY header.' },
    { status: 401 }
  )
}
