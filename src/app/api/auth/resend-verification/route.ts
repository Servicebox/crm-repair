import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'
import { sendVerificationEmail } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const ResendSchema = z.object({
  email: z.string().email('Некорректный email'),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`resend-verify:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Слишком много запросов. Попробуйте через час.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const { email } = ResendSchema.parse(body)

    await connectToDatabase()

    const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true })

    if (!user || user.isEmailVerified) {
      // Don't leak info about whether email exists or is already verified
      return NextResponse.json({ success: true })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    try {
      await sendVerificationEmail(email, token, user.name)
    } catch (emailError) {
      console.error('[resend-verification] Failed to send email:', emailError)
      return NextResponse.json(
        { error: 'Не удалось отправить письмо. Проверьте настройки SMTP или обратитесь к администратору.' },
        { status: 500 }
      )
    }

    await User.findOneAndUpdate(
      { _id: user._id },
      { emailVerificationToken: tokenHash, emailVerificationExpires: expires }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
