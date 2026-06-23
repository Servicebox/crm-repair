import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'
import Company from '@/models/Company'
import { sendVerificationEmail } from '@/lib/email'

const RegisterSchema = z.object({
  name: z.string().min(2, 'Имя минимум 2 символа'),
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль минимум 6 символов'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = RegisterSchema.parse(body)

    await connectToDatabase()

    const existing = await User.findOne({ email: data.email })
    if (existing) {
      return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 409 })
    }

    const existingCompany = await Company.findOne().select('_id').lean()
    const isFirstUser = !existingCompany

    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: isFirstUser ? 'owner' : 'master',
      isEmailVerified: isFirstUser,
      emailVerificationToken: isFirstUser ? undefined : token,
      emailVerificationExpires: isFirstUser ? undefined : expires,
    })

    if (isFirstUser) {
      await Company.create({ name: 'Мой сервисный центр' })
    } else {
      try {
        await sendVerificationEmail(data.email, token, data.name)
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      message: isFirstUser
        ? 'Аккаунт создан. Вы первый пользователь — роль Владелец присвоена автоматически.'
        : 'Проверьте почту для подтверждения email.',
      emailVerified: isFirstUser,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
