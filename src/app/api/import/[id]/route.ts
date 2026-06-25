import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ImportJob from '@/models/ImportJob'
import mongoose from 'mongoose'
import fs from 'fs'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()

  const job = await ImportJob.findOne({
    _id: params.id,
    organization_id: new mongoose.Types.ObjectId(session.user.companyId),
  })
    .select('-errors')  // errors can be large; use /errors endpoint instead
    .lean()

  if (!job) return NextResponse.json({ success: false, error: 'Не найден' }, { status: 404 })

  return NextResponse.json({ success: true, data: job })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()

  const job = await ImportJob.findOne({
    _id: params.id,
    organization_id: new mongoose.Types.ObjectId(session.user.companyId),
  })

  if (!job) return NextResponse.json({ success: false, error: 'Не найден' }, { status: 404 })

  if (job.status === 'importing') {
    // Signal cancellation — the processor polls status and will abort
    await ImportJob.updateOne({ _id: job._id }, { $set: { status: 'cancelled' } })
    return NextResponse.json({ success: true, data: { cancelled: true } })
  }

  // Clean up uploaded file
  if (job.storage_path) {
    try {
      const dir = require('path').dirname(job.storage_path)
      fs.rmSync(dir, { recursive: true, force: true })
    } catch { /* file may already be gone */ }
  }

  await ImportJob.deleteOne({ _id: job._id })

  return NextResponse.json({ success: true, data: { deleted: true } })
}
