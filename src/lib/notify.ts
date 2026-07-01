import { connectToDatabase } from '@/lib/mongodb'
import { getTenantConnection } from '@/lib/tenantDb'
import { getUserModel } from '@/models/User'
import TelegramChat from '@/models/TelegramChat'
import Company from '@/models/Company'
import { tgSendMessage } from '@/lib/telegram'
import { sendOrderStatusNotification } from '@/lib/email'
import mongoose from 'mongoose'

export type NotifyEvent =
  | 'order_new'
  | 'order_assigned'
  | 'order_status'
  | 'order_ready'
  | 'client_approved'
  | 'client_rejected'

export interface NotifyPayload {
  orderNumber?: string
  clientName?: string
  device?: string
  defect?: string
  status?: string
  masterName?: string
  /** If set, notify only this master (tenant user._id as string). Otherwise notify owners/admins. */
  targetUserId?: string
}

function buildTelegramText(event: NotifyEvent, p: NotifyPayload): string {
  switch (event) {
    case 'order_new':
      return `📋 <b>Новый заказ ${p.orderNumber}</b>\n👤 ${p.clientName}\n📱 ${p.device ?? ''}\n🔧 ${p.defect ?? ''}`
    case 'order_assigned':
      return `👨‍🔧 <b>Вам назначен заказ ${p.orderNumber}</b>\n👤 ${p.clientName}\n📱 ${p.device ?? ''}\n🔧 ${p.defect ?? ''}`
    case 'order_status':
      return `🔄 <b>Заказ ${p.orderNumber}</b>\nСтатус изменён: <b>${p.status}</b>`
    case 'order_ready':
      return `✅ <b>Заказ ${p.orderNumber} готов к выдаче</b>\n👤 ${p.clientName}\n📱 ${p.device ?? ''}`
    case 'client_approved':
      return `✅ <b>Клиент согласовал ремонт</b>\nЗаказ: ${p.orderNumber}\n👤 ${p.clientName}`
    case 'client_rejected':
      return `❌ <b>Клиент отказался от ремонта</b>\nЗаказ: ${p.orderNumber}\n👤 ${p.clientName}`
  }
}

function buildEmailSubject(event: NotifyEvent, p: NotifyPayload): string {
  switch (event) {
    case 'order_new':      return `Новый заказ ${p.orderNumber} — ${p.clientName}`
    case 'order_assigned': return `Вам назначен заказ ${p.orderNumber}`
    case 'order_status':   return `Заказ ${p.orderNumber} — статус: ${p.status}`
    case 'order_ready':    return `Заказ ${p.orderNumber} готов к выдаче`
    case 'client_approved':return `Клиент согласовал ремонт — заказ ${p.orderNumber}`
    case 'client_rejected':return `Клиент отказался от ремонта — заказ ${p.orderNumber}`
  }
}

/**
 * Sends internal staff notifications (Telegram + email) for an org event.
 * Always fire-and-forget — never throws, never blocks the caller.
 */
export function notifyStaff(
  companyId: string,
  dbName: string,
  event: NotifyEvent,
  payload: NotifyPayload
): void {
  _notifyStaff(companyId, dbName, event, payload).catch(() => undefined)
}

async function _notifyStaff(
  companyId: string,
  dbName: string,
  event: NotifyEvent,
  payload: NotifyPayload
): Promise<void> {
  await connectToDatabase()

  const company = await Company.findById(companyId)
    .select('telegramBotToken features name')
    .lean()
  if (!company) return

  // ─── Resolve target user IDs ───────────────────────────────────────────────
  const conn = await getTenantConnection(dbName)
  const UserModel = getUserModel(conn)

  let targetEmails: string[] = []
  let targetChatIds: string[] = []

  if (payload.targetUserId) {
    // Notify a specific user (e.g. assigned master)
    const user = await UserModel.findById(payload.targetUserId).select('email').lean()
    if (user?.email) targetEmails = [user.email]

    const chat = await TelegramChat.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      userId: payload.targetUserId,
      status: 'active',
    }).select('chatId').lean()
    if (chat?.chatId) targetChatIds = [chat.chatId]
  } else {
    // Notify all owners + admins
    const admins = await UserModel.find({
      role: { $in: ['owner', 'admin'] },
      isActive: true,
    }).select('_id email').lean()

    targetEmails = admins.map(u => u.email).filter(Boolean) as string[]

    const adminIds = admins.map(u => u._id.toString())
    const chats = await TelegramChat.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      userId: { $in: adminIds },
      status: 'active',
    }).select('chatId').lean()
    targetChatIds = chats.map(c => c.chatId).filter(Boolean) as string[]
  }

  // ─── Send Telegram ─────────────────────────────────────────────────────────
  if (company.telegramBotToken && company.features?.telegramBot && targetChatIds.length) {
    const text = buildTelegramText(event, payload)
    await Promise.all(
      targetChatIds.map(chatId => tgSendMessage(company.telegramBotToken!, chatId, text))
    )
  }

  // ─── Send Email ────────────────────────────────────────────────────────────
  // Only for high-signal events; skip status updates to avoid spam
  const emailEvents: NotifyEvent[] = ['order_new', 'order_assigned', 'order_ready', 'client_approved', 'client_rejected']
  if (emailEvents.includes(event) && targetEmails.length) {
    const subject = buildEmailSubject(event, payload)
    const statusText = buildTelegramText(event, payload).replace(/<[^>]+>/g, '')
    await Promise.all(
      targetEmails.map(email =>
        sendOrderStatusNotification(email, 'Сотрудник', payload.orderNumber ?? '', subject, statusText)
          .catch(() => undefined)
      )
    )
  }
}
