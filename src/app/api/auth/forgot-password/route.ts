import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email обязателен' }, { status: 400 })

    await connectToDatabase()
    const user = await User.findOne({ email: email.toLowerCase().trim() })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    user.passwordResetToken = token
    user.passwordResetExpires = expires
    await user.save()

    try {
      await sendPasswordResetEmail(email, token)
    } catch {
      // Email sending can fail in dev — still return success
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
