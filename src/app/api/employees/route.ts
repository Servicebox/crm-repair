import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireRole, ok, err } from '@/lib/api-helpers'
import User from '@/models/User'
import crypto from 'crypto'
import { sendVerificationEmail } from '@/lib/email'

const CreateEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'master']),
  phone: z.string().optional(),
  locationId: z.string().optional(),
  salary: z.object({
    type: z.enum(['percent_revenue', 'percent_profit', 'fixed', 'rate_per_order', 'hourly']),
    value: z.number(),
    hourlyRate: z.number().optional(),
    overtimeMultiplier: z.number().optional(),
    salesPercent: z.number().optional(),
    guaranteed: z.number().optional(),
  }).optional(),
})

export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const employees = await User.find({}).select('-password -emailVerificationToken -passwordResetToken').lean()
  return ok(employees)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  const body = await req.json()
  const data = CreateEmployeeSchema.parse(body)

  await connectToDatabase()

  const existing = await User.findOne({ email: data.email })
  if (existing) return err('Email уже зарегистрирован', 409)

  const tempPassword = crypto.randomBytes(8).toString('hex')
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: tempPassword,
    role: data.role,
    phone: data.phone,
    locationId: data.locationId,
    salary: data.salary,
    isEmailVerified: false,
    emailVerificationToken: tokenHash,
    emailVerificationExpires: new Date(Date.now() + 48 * 60 * 60 * 1000),
  })

  let emailSent = false
  try {
    await sendVerificationEmail(data.email, token, data.name)
    emailSent = true
  } catch (emailError) {
    console.error('[employees] Failed to send verification email to', data.email, ':', emailError)
  }

  return ok({ id: user._id, name: user.name, email: user.email, role: user.role, emailSent }, 201)
}
