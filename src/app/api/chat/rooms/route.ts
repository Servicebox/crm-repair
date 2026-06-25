import { NextRequest } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ChatRoom from '@/models/ChatRoom'
import ChatMessage from '@/models/ChatMessage'
import mongoose from 'mongoose'
import { NextResponse } from 'next/server'

const DEFAULT_ROOMS = [
  { slug: 'general', name: 'Общий чат', scope: 'global' as const, participants: [] },
  { slug: 'internal', name: 'Внутренний чат', scope: 'internal' as const, participants: [] },
]

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(60),
  scope: z.enum(['global', 'internal', 'inter_org']),
  description: z.string().max(200).optional(),
  participants: z.array(z.string()).optional(),
})

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) return unauthorized()

  await connectToDatabase()

  for (const room of DEFAULT_ROOMS) {
    await ChatRoom.updateOne({ slug: room.slug }, { $setOnInsert: room }, { upsert: true })
  }

  const companyOid = session.user.companyId
    ? new mongoose.Types.ObjectId(session.user.companyId)
    : null

  const roomFilter = companyOid
    ? { $or: [{ scope: 'global' }, { scope: 'internal' }, { scope: 'inter_org', participants: companyOid }] }
    : { $or: [{ scope: 'global' }, { scope: 'internal' }] }

  const rooms = await ChatRoom.find(roomFilter).sort({ scope: 1, createdAt: 1 }).lean()

  const roomSlugs = rooms.map(r => r.slug)
  const lastMessages = await ChatMessage.aggregate([
    { $match: { roomId: { $in: roomSlugs } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$roomId',
        text: { $first: '$text' },
        userName: { $first: '$userName' },
        createdAt: { $first: '$createdAt' },
      },
    },
  ])

  const lastMsgByRoom = new Map(lastMessages.map(m => [m._id as string, m]))

  const roomsWithMeta = rooms.map(room => ({
    ...room,
    lastMessage: lastMsgByRoom.get(room.slug) ?? null,
  }))

  return NextResponse.json({ success: true, data: roomsWithMeta })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) return unauthorized()
  if (!['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  await connectToDatabase()

  try {
    const body = await req.json()
    const parsed = CreateRoomSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
    }

    const slug = parsed.data.name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 40)

    const existing = await ChatRoom.findOne({ slug })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Комната с таким названием уже существует' }, { status: 409 })
    }

    const participants: mongoose.Types.ObjectId[] = []
    if (parsed.data.scope === 'inter_org') {
      const creatorCompany = session.user.companyId
        ? new mongoose.Types.ObjectId(session.user.companyId)
        : null
      if (creatorCompany) participants.push(creatorCompany)

      for (const id of parsed.data.participants ?? []) {
        if (mongoose.Types.ObjectId.isValid(id)) {
          const oid = new mongoose.Types.ObjectId(id)
          if (!participants.some(p => p.equals(oid))) participants.push(oid)
        }
      }
    }

    const room = await ChatRoom.create({
      slug,
      name: parsed.data.name,
      scope: parsed.data.scope,
      description: parsed.data.description,
      participants,
      createdBy: new mongoose.Types.ObjectId(session.user.id),
    })

    return NextResponse.json({ success: true, data: room }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Ошибка создания комнаты' }, { status: 500 })
  }
}
