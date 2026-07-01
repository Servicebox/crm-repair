import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'
import Company from '@/models/Company'
import TelegramChat from '@/models/TelegramChat'
import mongoose from 'mongoose'
import crypto from 'crypto'

function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findById(auth.session!.user.companyId)
    .select('_id')
    .lean()
  if (!company) return err('Компания не найдена', 404)

  const chat = await TelegramChat.findOne({
    companyId: company._id as mongoose.Types.ObjectId,
    userId: id,
  }).select('status chatId userName linkCode linkCodeExpires').lean()

  return ok(chat ?? { status: 'none' })
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findById(auth.session!.user.companyId)
    .select('_id telegramBotToken')
    .lean()
  if (!company) return err('Компания не найдена', 404)
  if (!company.telegramBotToken) {
    return err('Сначала подключите Telegram-бота в настройках компании', 400)
  }

  const companyObjId = company._id as mongoose.Types.ObjectId

  // If already active — return current status
  const existing = await TelegramChat.findOne({ companyId: companyObjId, userId: id, status: 'active' })
  if (existing) {
    return ok({ status: 'active', chatId: existing.chatId, userName: existing.userName })
  }

  // Remove any stale pending codes for this user
  await TelegramChat.deleteMany({ companyId: companyObjId, userId: id, status: 'pending' })

  const code = generateLinkCode()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await TelegramChat.create({
    companyId: companyObjId,
    userId: id,
    dbName: auth.session!.user.dbName,
    linkCode: code,
    linkCodeExpires: expiresAt,
    status: 'pending',
  })

  return ok({ status: 'pending', code, expiresAt })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findById(auth.session!.user.companyId)
    .select('_id')
    .lean()
  if (!company) return err('Компания не найдена', 404)

  await TelegramChat.deleteMany({
    companyId: company._id as mongoose.Types.ObjectId,
    userId: id,
  })

  return ok({ unlinked: true })
}
