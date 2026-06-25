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

  // Fetch last message per room in a single aggregation instead of N findOne calls
  const roomSlugs = rooms.map(r => r.slug)
  const lastMessages = await ChatMessage.aggregate([
    { $match: { roomId: { $in: roomSlugs } } },
    { $sort: { createdAt: -1 } },
    { $group: {
      _id: '$roomId',
      text: { $first: '$text' },
      userName: { $first: '$userName' },
      createdAt: { $first: '$createdAt' },
    }},
  ])

  const lastMsgByRoom = new Map(lastMessages.map(m => [m._id as string, m]))

  const roomsWithMeta = rooms.map(room => ({
    ...room,
    lastMessage: lastMsgByRoom.get(room.slug) ?? null,
  }))

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
    .substring(0, 40)

  // Check for duplicate name (without timestamp suffix so names remain unique)
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
