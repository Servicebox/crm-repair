import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, requireTenantRole, ok, err } from '@/lib/api-helpers'
import mongoose from 'mongoose'

const DEFAULT_ROOMS = [
  { slug: 'general', name: 'Общий чат', scope: 'global' as const },
  { slug: 'internal', name: 'Внутренний чат', scope: 'internal' as const },
]

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(60),
  scope: z.enum(['global', 'internal']),
  description: z.string().max(200).optional(),
})

export async function GET() {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { ChatRoom, ChatMessage } } = auth

  for (const room of DEFAULT_ROOMS) {
    await ChatRoom.updateOne({ slug: room.slug }, { $setOnInsert: room }, { upsert: true })
  }

  const rooms = await ChatRoom.find({}).sort({ scope: 1, createdAt: 1 }).lean()

  // Attach last message + unread count per room
  const roomsWithMeta = await Promise.all(
    rooms.map(async (room) => {
      const lastMsg = await ChatMessage.findOne({ roomId: room.slug })
        .sort({ createdAt: -1 })
        .select('text userName createdAt')
        .lean()
      return { ...room, lastMessage: lastMsg ?? null }
    })
  )

  return ok(roomsWithMeta)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { session, models: { ChatRoom } } = auth

  const body = await req.json()
  const parsed = CreateRoomSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const slug = parsed.data.name
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 40) + '-' + Date.now().toString(36)

  const existing = await ChatRoom.findOne({ slug })
  if (existing) return err('Комната с таким названием уже существует', 409)

  const room = await ChatRoom.create({
    slug,
    name: parsed.data.name,
    scope: parsed.data.scope,
    description: parsed.data.description,
    createdBy: new mongoose.Types.ObjectId(session!.user.id),
  })

  return ok(room, 201)
}
