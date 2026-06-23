import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'
import { sendPasswordResetEmail } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const ForgotSchema = z.object({ email: z.string().email('Некорректный email') })

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`forgot:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Слишком много запросов. Попробуйте через 15 минут.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { email } = ForgotSchema.parse(body)

    await connectToDatabase()
    const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000)

    await User.findOneAndUpdate(
      { _id: user._id },
      { passwordResetToken: token, passwordResetExpires: expires }
    )

    try {
      await sendPasswordResetEmail(email, token)
    } catch {
      // Email sending can fail in dev — still return success
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
