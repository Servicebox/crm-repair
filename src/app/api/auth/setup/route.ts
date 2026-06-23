import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'
import Company from '@/models/Company'
import { validateApiKey } from '@/lib/apiAuth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const SetupSchema = z.object({
  name: z.string().min(2).default('Администратор'),
  email: z.string().email(),
  password: z.string().min(8, 'Пароль минимум 8 символов'),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`setup:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })
  }

  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Неверный API ключ' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = SetupSchema.parse(body)

    await connectToDatabase()

    const ownerCount = await User.countDocuments({ role: 'owner', isEmailVerified: true })
    const existingUser = await User.findOne({ email: data.email })

    if (existingUser) {
      if (!existingUser.isEmailVerified || existingUser.role !== 'owner') {
        await User.findOneAndUpdate(
          { email: data.email },
          { isEmailVerified: true, role: 'owner', isActive: true },
          { new: true }
        )
        return NextResponse.json({
          success: true,
          message: `Пользователь ${data.email} активирован как owner`,
        })
      }
      return NextResponse.json({ error: 'Пользователь уже существует' }, { status: 409 })
    }

    if (ownerCount > 0) {
      return NextResponse.json({ error: 'Система уже инициализирована. Нельзя создать нового owner.' }, { status: 409 })
    }

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: 'owner',
      isEmailVerified: true,
      isActive: true,
    })

    const existingCompany = await Company.findOne()
    if (!existingCompany) {
      await Company.create({ name: 'Мой сервисный центр' })
    }

    return NextResponse.json({
      success: true,
      message: 'Администратор создан',
      user: { id: user._id.toString(), email: user.email, role: user.role },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Неверный API ключ' }, { status: 403 })
  }

  await connectToDatabase()
  const userCount = await User.countDocuments()
  const ownerCount = await User.countDocuments({ role: 'owner', isEmailVerified: true })
  const companyExists = !!(await Company.findOne())

  return NextResponse.json({
    setupRequired: userCount === 0 || ownerCount === 0,
    userCount,
    ownerCount,
    companyExists,
  })
}
