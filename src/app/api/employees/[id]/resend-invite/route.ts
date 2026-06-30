import { NextRequest } from 'next/server'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'
import { sendVerificationEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { User } } = auth
  const tenantDbName = auth.session!.user.dbName
  const { id } = await params

  const user = await User.findById(id).select('name email isEmailVerified emailVerificationToken emailVerificationExpires')
  if (!user) return err('Сотрудник не найден', 404)
  if (user.isEmailVerified) return err('Email уже подтверждён', 400)

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  user.emailVerificationToken = tokenHash
  user.emailVerificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000)
  await user.save()

  try {
    await sendVerificationEmail(user.email, token, user.name, tenantDbName)
    return ok({ sent: true })
  } catch (e) {
    console.error('[resend-invite] Failed to send email:', e)
    return err('Не удалось отправить письмо', 500)
  }
}
