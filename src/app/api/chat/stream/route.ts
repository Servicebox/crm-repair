import { NextRequest } from 'next/server'
import { requireTenantAuth } from '@/lib/api-helpers'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { ChatMessage } } = auth

  const room = req.nextUrl.searchParams.get('room') ?? 'general'

  // On reconnect, browser sends Last-Event-ID so we resume without gaps
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

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const pollInterval = setInterval(async () => {
        try {
          const filter: Record<string, unknown> = { roomId: room }
          if (lastId) filter._id = { $gt: lastId }

          const messages = await ChatMessage.find(filter)
            .sort({ _id: 1 })
            .limit(20)
            .lean()

          for (const msg of messages) {
            const id = (msg._id as mongoose.Types.ObjectId).toString()
            // id: field lets browser track Last-Event-ID for reconnection
            controller.enqueue(encoder.encode(`id: ${id}\ndata: ${JSON.stringify(msg)}\n\n`))
            lastId = msg._id as mongoose.Types.ObjectId
          }
        } catch { /* skip failed ticks */ }
      }, 1500)

      // Heartbeat every 20s — prevents nginx/proxy from closing idle connections
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
