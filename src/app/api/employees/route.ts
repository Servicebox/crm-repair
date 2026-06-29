import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'
import { sendVerificationEmail } from '@/lib/email'
import crypto from 'crypto'

const SalaryRuleSchema = z.object({
  id: z.string(),
  source: z.enum(['services_all', 'services_category', 'parts_all', 'order_intake', 'shift', 'hourly']),
  categories: z.array(z.string()).optional(),
  method: z.enum(['percent_revenue', 'percent_profit', 'fixed']),
  value: z.number().min(0),
  enabled: z.boolean(),
})

const SalarySchema = z.union([
  // Гибкая схема (flex)
  z.object({
    guaranteed: z.number().min(0),
    rules: z.array(SalaryRuleSchema).min(1),
  }),
  // Устаревшая схема (legacy — обратная совместимость)
  z.object({
    type: z.enum(['percent_revenue', 'percent_profit', 'fixed', 'rate_per_order', 'hourly']),
    value: z.number(),
    hourlyRate: z.number().optional(),
    overtimeMultiplier: z.number().optional(),
    salesPercent: z.number().optional(),
    guaranteed: z.number().optional(),
  }),
])

const CreateEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'master']),
  phone: z.string().optional(),
  locationId: z.string().optional(),
  salary: SalarySchema.optional(),
  // Manual password option (owner sets it; no email invite sent)
  password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .regex(/[A-Za-z]/, 'Пароль должен содержать буквы')
    .regex(/[0-9]/, 'Пароль должен содержать цифры')
    .optional(),
})

export async function GET() {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { User } } = auth
  const companyId = auth.session!.user.companyId

  const filter = companyId ? { companyId } : {}
  const employees = await User.find(filter).select('-password -emailVerificationToken -passwordResetToken').lean()
  return ok(employees)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { User } } = auth

  try {
    const body = await req.json()
    const data = CreateEmployeeSchema.parse(body)

    const companyId = auth.session!.user.companyId
    const existing = await User.findOne({ email: data.email, ...(companyId ? { companyId } : {}) })
    if (existing) return err('Email уже зарегистрирован', 409)

    const manualPassword = !!data.password

    let token: string | undefined
    let tokenHash: string | undefined

    if (!manualPassword) {
      token = crypto.randomBytes(32).toString('hex')
      tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    }

    const user = await User.create({
      name: data.name,
      email: data.email,
      // bcrypt hashing happens in pre-save hook
      password: manualPassword ? data.password : crypto.randomBytes(16).toString('hex'),
      role: data.role,
      phone: data.phone,
      locationId: data.locationId,
      salary: data.salary,
      companyId: auth.session!.user.companyId || undefined,
      isEmailVerified: manualPassword,
      emailVerificationToken: tokenHash,
      emailVerificationExpires: tokenHash ? new Date(Date.now() + 48 * 60 * 60 * 1000) : undefined,
    })

    let emailSent = false
    if (!manualPassword && token) {
      try {
        await sendVerificationEmail(data.email, token, data.name)
        emailSent = true
      } catch (emailError) {
        console.error('[employees] Failed to send invite email to', data.email, ':', emailError)
      }
    }

    return ok({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      manualPassword,
      emailSent,
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка создания сотрудника', 500)
  }
}
