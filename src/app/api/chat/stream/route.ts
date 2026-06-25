import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ChatMessage from '@/models/ChatMessage'
import ChatRoom from '@/models/ChatRoom'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return new Response('Unauthorized', { status: 401 })
  }

  const room = req.nextUrl.searchParams.get('room') ?? 'general'

  await connectToDatabase()

  // Org isolation: verify the user is allowed to access this room.
  const chatRoom = await ChatRoom.findOne({ slug: room }).lean() as {
    _id: mongoose.Types.ObjectId
    scope: string
    participants: mongoose.Types.ObjectId[]
  } | null

  if (chatRoom) {
    if (chatRoom.scope === 'internal') {
      // internal rooms are per-tenant — user must belong to a company
      if (!session.user.companyId) {
        return new Response('Forbidden', { status: 403 })
      }
    } else if (chatRoom.scope === 'inter_org') {
      // inter_org rooms: companyId must be in participants list
      const companyOid = session.user.companyId
        ? new mongoose.Types.ObjectId(session.user.companyId)
        : null
      const allowed = companyOid && chatRoom.participants.some(p => p.equals(companyOid))
      if (!allowed) {
        return new Response('Forbidden', { status: 403 })
      }
    }
    // global rooms: any authenticated user
  }

  const lastEventIdHeader = req.headers.get('last-event-id')
  let lastId: mongoose.Types.ObjectId | null = null

  if (lastEventIdHeader && mongoose.Types.ObjectId.isValid(lastEventIdHeader)) {
    lastId = new mongoose.Types.ObjectId(lastEventIdHeader)
  } else {
    const latest = await ChatMessage.findOne({ roomId: room })
      .sort({ createdAt: -1 })
      .select('_id')
      .lean()
    lastId = latest ? (latest as { _id: mongoose.Types.ObjectId })._id : null
  }

  // For internal rooms, scope messages to the user's company
  const baseFilter: Record<string, unknown> = { roomId: room }
  if (chatRoom?.scope === 'internal' && session.user.companyId) {
    baseFilter.companyId = new mongoose.Types.ObjectId(session.user.companyId)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const pollInterval = setInterval(async () => {
        try {
          const filter = { ...baseFilter }
          if (lastId) filter._id = { $gt: lastId }

          const messages = await ChatMessage.find(filter)
            .sort({ _id: 1 })
            .limit(20)
            .lean()

          for (const msg of messages) {
            const id = (msg._id as mongoose.Types.ObjectId).toString()
            controller.enqueue(encoder.encode(`id: ${id}\ndata: ${JSON.stringify(msg)}\n\n`))
            lastId = msg._id as mongoose.Types.ObjectId
          }
        } catch { /* skip failed poll ticks */ }
      }, 1500)

      // Heartbeat every 20s — keeps nginx/proxy from closing idle connections
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(heartbeatInterval)
        }
      }, 20000)

      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval)
        clearInterval(heartbeatInterval)
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
