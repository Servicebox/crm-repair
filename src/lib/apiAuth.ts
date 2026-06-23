import { NextRequest, NextResponse } from 'next/server'

export function validateApiKey(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') ?? request.nextUrl.searchParams.get('api_key') ?? ''
  const key = auth.replace('Bearer ', '').trim()
  return key === process.env.ADMIN_API_KEY
}

export function apiUnauthorized() {
  return NextResponse.json(
    { success: false, error: 'Unauthorized. Pass Authorization: Bearer YOUR_API_KEY header.' },
    { status: 401 }
  )
}
