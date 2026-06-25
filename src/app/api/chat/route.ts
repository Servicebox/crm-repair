import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'

const PostMessageSchema = z.object({
  room: z.string().max(100).optional(),
  text: z.string().min(1).max(4000),
})

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { ChatMessage } } = auth

  const { searchParams } = req.nextUrl
  const room = searchParams.get('room') ?? 'general'
  const before = searchParams.get('before')
  const limit = 50

  const filter: Record<string, unknown> = { roomId: room }
  if (before) {
    const d = new Date(before)
    if (!isNaN(d.getTime())) filter.createdAt = { $lt: d }
  }

  const messages = await ChatMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return ok(messages.reverse())
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { session, models: { ChatMessage, ChatRoom } } = auth

  try {
    const body = await req.json()
    const data = PostMessageSchema.parse(body)
    const roomSlug = data.room ?? 'general'

    const roomDoc = await ChatRoom.findOne({ slug: roomSlug }).lean() as { scope?: 'global' | 'internal' } | null
    const scope: 'global' | 'internal' = roomDoc?.scope ?? 'global'

    // Resolve sender name: prefer session name, fall back to email prefix
    const senderName = session!.user.name?.trim()
      || session!.user.email?.split('@')[0]
      || 'Пользователь'

    // For general/global room, attach the company name so receivers see the org
    let companyName: string | null = null
    if (scope === 'global') {
      await connectToDatabase()
      const company = await Company.findOne({ dbName: session!.user.dbName }).select('name').lean() as { name?: string } | null
      companyName = company?.name ?? null
    }

    const message = await ChatMessage.create({
      roomId: roomSlug,
      scope,
      userId: session!.user.id,
      userName: senderName,
      companyName,
      text: data.text,
    })
    return ok(message, 201)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка отправки сообщения', 500)
  }
}
