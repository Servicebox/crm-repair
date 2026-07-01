import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'
import Company from '@/models/Company'
import TelegramChat from '@/models/TelegramChat'
import { tgSetWebhook, tgDeleteWebhook, tgGetMe } from '@/lib/telegram'
import crypto from 'crypto'
import mongoose from 'mongoose'

export async function GET() {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findOne({ dbName: auth.session!.user.dbName })
    .select('_id telegramBotToken features')
    .lean()

  if (!company) return err('Компания не найдена', 404)

  const hasToken = !!company.telegramBotToken
  let botUsername: string | undefined

  if (hasToken) {
    const me = await tgGetMe(company.telegramBotToken!)
    if (me.ok) botUsername = me.result?.username
  }

  const companyObjId = company._id as mongoose.Types.ObjectId
  const linkedCount = hasToken
    ? await TelegramChat.countDocuments({ companyId: companyObjId, status: 'active' })
    : 0

  return ok({
    hasToken,
    botUsername,
    enabled: company.features?.telegramBot ?? false,
    linkedCount,
  })
}

const RegisterSchema = z.object({
  token: z.string().min(20, 'Неверный формат токена'),
})

export async function POST(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findOne({ dbName: auth.session!.user.dbName })
    .select('_id')
    .lean()
  if (!company) return err('Компания не найдена', 404)

  try {
    const body = await req.json()
    const { token } = RegisterSchema.parse(body)

    // Verify the token is valid with Telegram
    const me = await tgGetMe(token)
    if (!me.ok) return err('Неверный токен бота. Проверьте токен в @BotFather.', 400)

    // Generate a random secret that Telegram will send in every webhook request
    // This prevents anyone who knows the URL from forging requests
    const webhookSecret = crypto.randomBytes(32).toString('hex')

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.AUTH_URL ||
      process.env.NEXTAUTH_URL ||
      ''
    if (!appUrl) return err('APP_URL не настроен на сервере', 500)

    const companyObjId = company._id as mongoose.Types.ObjectId
    const webhookUrl = `${appUrl}/api/webhooks/telegram/${companyObjId.toString()}`

    const result = await tgSetWebhook(token, webhookUrl, webhookSecret)
    if (!result.ok) {
      return err(`Ошибка Telegram: ${result.description ?? 'не удалось зарегистрировать webhook'}`, 400)
    }

    await Company.findByIdAndUpdate(companyObjId, {
      $set: {
        telegramBotToken: token,
        telegramWebhookSecret: webhookSecret,
        'features.telegramBot': true,
      },
    })

    return ok({ botUsername: me.result?.username, webhookUrl })
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка подключения', 500)
  }
}

export async function DELETE() {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findOne({ dbName: auth.session!.user.dbName })
    .select('_id telegramBotToken')
    .lean()
  if (!company) return err('Компания не найдена', 404)

  if (company.telegramBotToken) {
    await tgDeleteWebhook(company.telegramBotToken)
  }

  const companyObjId = company._id as mongoose.Types.ObjectId

  await Company.findByIdAndUpdate(companyObjId, {
    $unset: { telegramBotToken: '', telegramWebhookSecret: '' },
    $set: { 'features.telegramBot': false },
  })

  // Remove all subscriber links for this company
  await TelegramChat.deleteMany({ companyId: companyObjId })

  return ok({ disconnected: true })
}
