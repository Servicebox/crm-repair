import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// GET: validate token. If user already has a password (org registration), auto-verify.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Токен не указан' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit(`verify-check:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    await connectToDatabase()
    const user = await User.findOne({
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    }).select('name email password')

    if (!user) {
      return NextResponse.json({ error: 'Ссылка недействительна или устарела' }, { status: 400 })
    }

    // If user already has a password (set during org registration), auto-verify
    if (user.password) {
      user.isEmailVerified = true
      user.emailVerificationToken = undefined
      user.emailVerificationExpires = undefined
      await user.save()
      return NextResponse.json({ success: true, autoVerified: true, name: user.name, email: user.email })
    }

    return NextResponse.json({ success: true, autoVerified: false, name: user.name, email: user.email })
  } catch {
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

const SetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .regex(/[A-Za-z]/, 'Пароль должен содержать буквы')
    .regex(/[0-9]/, 'Пароль должен содержать цифры'),
})

// POST: set password + mark email verified (single-use)
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`verify-set:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })

  try {
    const body = await req.json()
    const { token, password } = SetPasswordSchema.parse(body)

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const rlToken = checkRateLimit(`verify-token:${tokenHash.slice(0, 16)}`, { limit: 5, windowMs: 60 * 60 * 1000 })
    if (!rlToken.ok) return NextResponse.json({ error: 'Слишком много попыток для этой ссылки' }, { status: 429 })

    await connectToDatabase()
    const user = await User.findOne({
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    })

    if (!user) {
      return NextResponse.json({ error: 'Ссылка недействительна или устарела' }, { status: 400 })
    }

    // Set password (triggers bcrypt hash via pre-save hook) + verify email + clear token
    user.password = password
    user.isEmailVerified = true
    user.emailVerificationToken = undefined
    user.emailVerificationExpires = undefined
    await user.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
