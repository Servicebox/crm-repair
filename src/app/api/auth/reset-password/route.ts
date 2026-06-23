import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const ResetSchema = z.object({
  token: z.string().min(1, 'Токен обязателен'),
  password: z.string().min(8, 'Минимум 8 символов'),
})

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`reset:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { token, password } = ResetSchema.parse(body)

    await connectToDatabase()
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    })

    if (!user) {
      return NextResponse.json({ error: 'Ссылка устарела или недействительна' }, { status: 400 })
    }

    user.password = password
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
