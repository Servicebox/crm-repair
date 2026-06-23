import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace('Bearer ', '')
  const expectedKey = process.env.ADMIN_API_KEY

  if (!apiKey || !expectedKey || !timingSafeEqual(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS_SET: !!process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_SECRET_SET: !!process.env.AUTH_SECRET,
    NEXTAUTH_SECRET_SET: !!process.env.NEXTAUTH_SECRET,
    MONGODB_URI_SET: !!process.env.MONGODB_URI,
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return NextResponse.json({
      ok: false,
      error: 'SMTP environment variables not configured',
      config,
    })
  }

  const smtpPort = Number(process.env.SMTP_PORT) || 465
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  try {
    await transporter.verify()
    return NextResponse.json({ ok: true, message: 'SMTP connection successful', config })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      config,
    })
  }
}
