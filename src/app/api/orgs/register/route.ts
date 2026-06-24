import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import { getTenantConnection } from '@/lib/tenantDb'
import { getModels } from '@/lib/models'
import User from '@/models/User'
import Company from '@/models/Company'
import { sendVerificationEmail } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const OrgRegisterSchema = z.object({
  orgName: z.string().min(2, 'Название организации минимум 2 символа').max(100),
  adminName: z.string().min(2, 'Имя администратора минимум 2 символа'),
  adminEmail: z.string().email('Некорректный email'),
  adminPassword: z.string().min(8, 'Пароль минимум 8 символов'),
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => {
      const map: Record<string, string> = {
        а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',
        й:'j',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',
        у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',
        э:'e',ю:'yu',я:'ya',
      }
      return map[ch] ?? ch
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`org-register:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Слишком много запросов. Попробуйте через час.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const data = OrgRegisterSchema.parse(body)

    await connectToDatabase()

    // Check email uniqueness globally
    const existingUser = await User.findOne({ email: data.adminEmail })
    if (existingUser) {
      return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 409 })
    }

    // Generate unique slug
    let baseSlug = slugify(data.orgName) || 'org'
    let slug = baseSlug
    let suffix = 1
    while (await Company.findOne({ slug })) {
      slug = `${baseSlug}-${suffix++}`
    }

    const dbName = `crm_${slug.replace(/-/g, '_')}`

    // Ensure tenant DB is reachable (creates connection)
    await getTenantConnection(dbName)

    // Create Company record on platform DB
    const company = await Company.create({
      name: data.orgName,
      slug,
      dbName,
      isActive: true,
    })

    // Seed default data in tenant DB
    const tenantConn = await getTenantConnection(dbName)
    const tenantModels = getModels(tenantConn)
    await tenantModels.ChatRoom.findOneAndUpdate(
      { slug: 'general' },
      { slug: 'general', name: 'Общий чат', scope: 'global' },
      { upsert: true, setDefaultsOnInsert: true }
    )
    await tenantModels.ChatRoom.findOneAndUpdate(
      { slug: 'internal' },
      { slug: 'internal', name: 'Внутренний чат', scope: 'internal' },
      { upsert: true, setDefaultsOnInsert: true }
    )

    // Create admin user on platform DB
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await User.create({
      name: data.adminName,
      email: data.adminEmail,
      password: data.adminPassword,
      role: 'owner',
      companyId: company._id,
      isEmailVerified: false,
      emailVerificationToken: tokenHash,
      emailVerificationExpires: expires,
    })

    try {
      await sendVerificationEmail(data.adminEmail, token, data.adminName)
    } catch (emailErr) {
      console.error('[org-register] Failed to send verification email:', emailErr)
      return NextResponse.json({
        success: true,
        emailSent: false,
        message: 'Организация создана, но письмо не отправлено. Обратитесь в поддержку.',
      })
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
      message: 'Организация создана. Проверьте почту для подтверждения аккаунта.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('[org-register]', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
