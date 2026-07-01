import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'
import TelegramChat from '@/models/TelegramChat'
import { tgSendMessage } from '@/lib/telegram'
import mongoose from 'mongoose'

// Telegram calls GET to verify the URL is reachable
export async function GET() {
  return new Response('ok', { status: 200 })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return new Response('bad request', { status: 400 })
  }

  try {
    await connectToDatabase()

    const company = await Company
      .findById(companyId)
      .select('telegramBotToken telegramWebhookSecret features name')
      .lean()

    if (!company?.telegramBotToken) {
      return new Response('not found', { status: 404 })
    }

    // ── Verify Telegram's secret_token header ──────────────────────────────
    // This prevents any third party from forging requests to this endpoint.
    const receivedSecret = req.headers.get('x-telegram-bot-api-secret-token')
    if (company.telegramWebhookSecret && receivedSecret !== company.telegramWebhookSecret) {
      return new Response('forbidden', { status: 403 })
    }

    const update = await req.json().catch(() => null)
    const message = update?.message
    if (!message?.text || !message?.chat?.id) {
      return new Response('ok', { status: 200 })
    }

    const chatId = String(message.chat.id)
    const text = (message.text as string).trim()
    const token = company.telegramBotToken
    const companyObjId = new mongoose.Types.ObjectId(companyId)

    // ── /start ─────────────────────────────────────────────────────────────
    if (text === '/start' || text.startsWith('/start ')) {
      await tgSendMessage(
        token, chatId,
        `👋 Привет! Я бот <b>${company.name ?? 'ServiceBox CRM'}</b>.\n\n` +
        `Чтобы привязать аккаунт, запросите у руководителя код и отправьте:\n` +
        `<code>/link ВАШИ-КОД</code>\n\n` +
        `После привязки вы будете получать уведомления о заказах.`
      )
      return new Response('ok', { status: 200 })
    }

    // ── /link CODE ─────────────────────────────────────────────────────────
    if (text.startsWith('/link ')) {
      const code = text.slice(6).trim().toUpperCase()

      const pending = await TelegramChat.findOne({
        companyId: companyObjId,
        linkCode: code,
        status: 'pending',
        linkCodeExpires: { $gt: new Date() },
      })

      if (!pending) {
        await tgSendMessage(
          token, chatId,
          '❌ Код не найден или истёк срок действия.\nЗапросите новый код у руководителя.'
        )
        return new Response('ok', { status: 200 })
      }

      // Check if this chatId is already linked to someone in this company
      const alreadyLinked = await TelegramChat.findOne({
        companyId: companyObjId,
        chatId,
        status: 'active',
      })
      if (alreadyLinked) {
        await tgSendMessage(
          token, chatId,
          'ℹ️ Этот аккаунт Telegram уже привязан к другому сотруднику этой компании.\n' +
          'Попросите руководителя отвязать старую привязку.'
        )
        return new Response('ok', { status: 200 })
      }

      await TelegramChat.findByIdAndUpdate(pending._id, {
        $set: {
          chatId,
          userName: message.from?.first_name
            ? [message.from.first_name, message.from.last_name].filter(Boolean).join(' ')
            : message.from?.username ?? 'Telegram пользователь',
          status: 'active',
          linkCode: undefined,
          linkCodeExpires: undefined,
        },
        $unset: { linkCode: '', linkCodeExpires: '' },
      })

      await tgSendMessage(
        token, chatId,
        `✅ Аккаунт Telegram привязан к <b>${company.name ?? 'ServiceBox CRM'}</b>!\n\n` +
        `Вы будете получать уведомления о заказах, назначениях и событиях.\n\n` +
        `Команды:\n` +
        `/status НОМЕР — узнать статус заказа`
      )
      return new Response('ok', { status: 200 })
    }

    // ── /status NUMBER ──────────────────────────────────────────────────────
    if (text.startsWith('/status ')) {
      // Verify this chatId belongs to this company
      const chat = await TelegramChat.findOne({ companyId: companyObjId, chatId, status: 'active' })
      if (!chat) {
        await tgSendMessage(token, chatId, '❌ Аккаунт не привязан. Отправьте /start для инструкций.')
        return new Response('ok', { status: 200 })
      }

      await tgSendMessage(
        token, chatId,
        'ℹ️ Для проверки статуса откройте CRM или воспользуйтесь ссылкой отслеживания из квитанции.'
      )
      return new Response('ok', { status: 200 })
    }

    // All other messages — check if user is linked to this company
    const linked = await TelegramChat.exists({ companyId: companyObjId, chatId, status: 'active' })
    if (!linked) {
      await tgSendMessage(token, chatId,
        '👋 Чтобы начать, отправьте /start'
      )
    }

    return new Response('ok', { status: 200 })
  } catch {
    // Always return 200 to Telegram — it retries on non-200
    return new Response('ok', { status: 200 })
  }
}
