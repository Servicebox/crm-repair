import { NextRequest } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ChatMessage from '@/models/ChatMessage'
import ChatRoom from '@/models/ChatRoom'
import Company from '@/models/Company'
import mongoose from 'mongoose'
import { NextResponse } from 'next/server'

const PostMessageSchema = z.object({
  room: z.string().max(100).optional(),
  text: z.string().min(1).max(4000),
})

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) return unauthorized()

  await connectToDatabase()

  const { searchParams } = req.nextUrl
  const room = searchParams.get('room') ?? 'general'
  const before = searchParams.get('before')
  const limit = 50

  // Org isolation check
  const chatRoom = await ChatRoom.findOne({ slug: room }).lean() as {
    scope: string
    participants: mongoose.Types.ObjectId[]
  } | null

  if (chatRoom?.scope === 'inter_org') {
    const companyOid = session.user.companyId
      ? new mongoose.Types.ObjectId(session.user.companyId)
      : null
    const allowed = companyOid && chatRoom.participants.some(p => p.equals(companyOid))
    if (!allowed) return forbidden()
  }

  const filter: Record<string, unknown> = { roomId: room }
  if (chatRoom?.scope === 'internal' && session.user.companyId) {
    filter.companyId = new mongoose.Types.ObjectId(session.user.companyId)
  }
  if (before) {
    const d = new Date(before)
    if (!isNaN(d.getTime())) filter.createdAt = { $lt: d }
  }

  const messages = await ChatMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return NextResponse.json({ success: true, data: messages.reverse() })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) return unauthorized()

  await connectToDatabase()

  try {
    const body = await req.json()
    const data = PostMessageSchema.parse(body)
    const roomSlug = data.room ?? 'general'

    const roomDoc = await ChatRoom.findOne({ slug: roomSlug }).lean() as {
      scope: 'global' | 'internal' | 'inter_org'
      participants: mongoose.Types.ObjectId[]
    } | null

    const scope = roomDoc?.scope ?? 'global'

    // Inter-org: verify sender is a participant
    if (scope === 'inter_org') {
      const companyOid = session.user.companyId
        ? new mongoose.Types.ObjectId(session.user.companyId)
        : null
      const allowed = companyOid && roomDoc!.participants.some(p => p.equals(companyOid))
      if (!allowed) return forbidden()
    }

    const senderName = session.user.name?.trim()
      || session.user.email?.split('@')[0]
      || 'Пользователь'

    let companyName: string | null = null
    let companyId: mongoose.Types.ObjectId | undefined

    if (session.user.companyId) {
      companyId = new mongoose.Types.ObjectId(session.user.companyId)
    }

    // Attach org name for global / inter_org rooms so receivers see who sent it
    if (scope !== 'internal' && session.user.companyId) {
      const company = await Company.findById(session.user.companyId).select('name').lean() as { name?: string } | null
      companyName = company?.name ?? null
    }

    const message = await ChatMessage.create({
      roomId: roomSlug,
      scope,
      userId: new mongoose.Types.ObjectId(session.user.id),
      userName: senderName,
      companyId,
      companyName,
      text: data.text,
    })

    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Ошибка отправки сообщения' }, { status: 500 })
  }
}
