import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth } from '@/lib/api-helpers'
import ChatMessage from '@/models/ChatMessage'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const room = req.nextUrl.searchParams.get('room') ?? 'general'

  await connectToDatabase()

  // Start from the latest existing message
  const latest = await ChatMessage.findOne({ roomId: room })
    .sort({ createdAt: -1 })
    .select('_id')
    .lean()

  let lastId: mongoose.Types.ObjectId | null = latest ? latest._id as mongoose.Types.ObjectId : null

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(async () => {
        try {
          const filter: Record<string, unknown> = { roomId: room }
          if (lastId) filter._id = { $gt: lastId }

          const messages = await ChatMessage.find(filter)
            .sort({ _id: 1 })
            .limit(20)
            .lean()

          for (const msg of messages) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`))
            lastId = msg._id as mongoose.Types.ObjectId
          }
        } catch {
          // skip failed ticks
        }
      }, 1500)

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
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
