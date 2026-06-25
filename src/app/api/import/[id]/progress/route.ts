import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ImportJob, { type IImportJob } from '@/models/ImportJob'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  await connectToDatabase()

  const companyId = session.user.companyId

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      const tick = async () => {
        try {
          const job = await ImportJob.findOne({
            _id: params.id,
            organization_id: new mongoose.Types.ObjectId(companyId),
          })
            .select('status progress import_errors')
            .lean<Pick<IImportJob, 'status' | 'progress'>>()

          if (!job) {
            send({ error: 'Не найден' })
            controller.close()
            return
          }

          send({
            status: job.status,
            processed: job.progress.processed,
            total: job.progress.total,
            successful: job.progress.successful,
            failed: job.progress.failed,
            duplicates_skipped: job.progress.duplicates_skipped,
            percent: job.progress.total > 0
              ? Math.round((job.progress.processed / job.progress.total) * 100)
              : 0,
          })

          if (TERMINAL_STATUSES.has(job.status)) {
            controller.close()
            return
          }

          if (!req.signal.aborted) {
            setTimeout(tick, 1000)
          } else {
            try { controller.close() } catch { /* ok */ }
          }
        } catch {
          try { controller.close() } catch { /* ok */ }
        }
      }

      req.signal.addEventListener('abort', () => {
        try { controller.close() } catch { /* ok */ }
      })

      await tick()
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
