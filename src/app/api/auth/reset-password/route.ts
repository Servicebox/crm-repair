import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()
    if (!token || !password) return NextResponse.json({ error: 'Токен и пароль обязательны' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Минимум 6 символов' }, { status: 400 })

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
  } catch {
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
