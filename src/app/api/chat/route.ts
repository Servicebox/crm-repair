import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import ChatMessage from '@/models/ChatMessage'
import ChatRoom from '@/models/ChatRoom'

const PostMessageSchema = z.object({
  room: z.string().max(100).optional(),
  text: z.string().min(1).max(4000),
})

async function getRoomScope(roomSlug: string): Promise<'global' | 'internal'> {
  const room = await ChatRoom.findOne({ slug: roomSlug }).lean()
  return room?.scope ?? 'global'
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  const { searchParams } = req.nextUrl
  const room = searchParams.get('room') ?? 'general'
  const before = searchParams.get('before')
  const limit = 50

  const filter: Record<string, unknown> = { roomId: room }
  if (before) filter.createdAt = { $lt: new Date(before) }

  const messages = await ChatMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return ok(messages.reverse())
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error
  const { session } = auth

  try {
    const body = await req.json()
    const data = PostMessageSchema.parse(body)
    const roomSlug = data.room ?? 'general'

    await connectToDatabase()
    const scope = await getRoomScope(roomSlug)

    const message = await ChatMessage.create({
      roomId: roomSlug,
      scope,
      userId: session!.user.id,
      userName: session!.user.name ?? 'Пользователь',
      text: data.text,
    })
    return ok(message, 201)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка отправки сообщения', 500)
  }
}
