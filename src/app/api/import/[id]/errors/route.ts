import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ImportJob, { type IImportError } from '@/models/ImportJob'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  await connectToDatabase()

  const job = await ImportJob.findOne({
    _id: params.id,
    organization_id: new mongoose.Types.ObjectId(session.user.companyId),
  })
    .select('import_errors original_filename')
    .lean<{ import_errors?: IImportError[]; original_filename?: string }>()

  if (!job) return new NextResponse('Не найден', { status: 404 })

  const errs = job.import_errors ?? []
  if (!errs.length) return new NextResponse('Нет ошибок', { status: 204 })

  const bom = '﻿'
  const header = 'Строка,Сообщение об ошибке,Код ошибки,Данные строки'

  const rows = errs.map(e => {
    const row = String(e.row_number)
    const msg = `"${String(e.error_message).replace(/"/g, '""')}"`
    const code = String(e.error_code)
    const data = `"${JSON.stringify(e.source_data).replace(/"/g, '""')}"`
    return [row, msg, code, data].join(',')
  })

  const csv = bom + [header, ...rows].join('\n')
  const filename = `import-errors-${params.id}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
