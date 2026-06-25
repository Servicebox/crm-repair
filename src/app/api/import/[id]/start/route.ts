import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ImportJob from '@/models/ImportJob'
import mongoose from 'mongoose'
import { runImport } from '@/services/import/processor'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = session.user.companyId
  const dbName = session.user.dbName
  if (!companyId || !dbName) {
    return NextResponse.json({ success: false, error: 'Нет привязки к организации' }, { status: 403 })
  }

  await connectToDatabase()

  let job
  try {
    job = await ImportJob.findOne({
      _id: params.id,
      organization_id: new mongoose.Types.ObjectId(companyId),
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Не найден' }, { status: 404 })
  }

  if (!job) return NextResponse.json({ success: false, error: 'Не найден' }, { status: 404 })

  if (job.status !== 'ready_for_mapping') {
    return NextResponse.json({
      success: false,
      error: `Нельзя запустить импорт в статусе '${job.status}'`,
    }, { status: 409 })
  }

  if (!job.mapping || job.mapping.length === 0) {
    return NextResponse.json({ success: false, error: 'Маппинг полей не задан' }, { status: 400 })
  }

  // Fire-and-forget: return 202 immediately, process in background.
  // The event loop in Node.js keeps running after we return the response.
  setImmediate(() => {
    runImport(params.id, companyId, dbName).catch(err => {
      console.error('[import] runImport error:', err)
    })
  })

  return NextResponse.json({
    success: true,
    data: { id: params.id, status: 'importing' },
  }, { status: 202 })
}
