import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok } from '@/lib/api-helpers'
import ChatMessage from '@/models/ChatMessage'

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

  const body = await req.json()
  await connectToDatabase()
  const message = await ChatMessage.create({
    roomId: body.room ?? 'general',
    userId: session!.user.id,
    userName: session!.user.name ?? 'Пользователь',
    text: body.text,
  })
  return ok(message, 201)
}
