import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ImportJob from '@/models/ImportJob'
import mongoose from 'mongoose'
import { analyseCsv } from '@/services/import/parsers/csv'
import { analyseExcel } from '@/services/import/parsers/excel'
import { analyseXml } from '@/services/import/parsers/xml'
import { autoMapColumns } from '@/services/import/fuzzyMapper'
import type { IColumnAnalysis } from '@/models/ImportJob'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()

  const companyId = session.user.companyId
  const job = await ImportJob.findOne({
    _id: params.id,
    organization_id: new mongoose.Types.ObjectId(companyId),
  })

  if (!job) return NextResponse.json({ success: false, error: 'Не найден' }, { status: 404 })

  if (!['uploaded', 'ready_for_mapping'].includes(job.status)) {
    return NextResponse.json({ success: false, error: 'Анализ уже выполнен или импорт запущен' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const entity = body.entity ?? job.target_entity ?? 'clients'
  const sheetName = body.sheet ?? undefined

  await ImportJob.updateOne({ _id: job._id }, { $set: { status: 'analyzing', target_entity: entity } })

  try {
    let headers: string[] = []
    let sample: Record<string, string>[] = []
    let total_rows = 0
    let encoding = 'UTF-8'
    let sheets: string[] = []

    const filePath = job.storage_path
    const ext = job.file_type

    if (ext === 'csv') {
      const result = await analyseCsv(filePath)
      headers = result.headers
      sample = result.sample
      total_rows = result.total_rows
      encoding = result.encoding
    } else if (ext === 'xml') {
      const result = await analyseXml(filePath)
      headers = result.headers
      sample = result.sample
      total_rows = result.total_rows
    } else {
      // xlsx / xls
      const result = await analyseExcel(filePath, sheetName)
      headers = result.headers
      sample = result.sample
      total_rows = result.total_rows
      sheets = result.sheets
      if (sheetName) {
        await ImportJob.updateOne({ _id: job._id }, { $set: { selected_sheet: sheetName } })
      }
    }

    // Run fuzzy matching to generate field suggestions
    const suggestions = autoMapColumns(headers, entity)

    const detected_columns: IColumnAnalysis[] = headers.map((h, i) => {
      const suggestion = suggestions[i]?.suggestion
      return {
        source_name: h,
        sample_values: sample.slice(0, 5).map(r => r[h] ?? '').filter(Boolean),
        suggested_target: suggestion?.path ?? '',
        confidence: suggestion?.confidence ?? 0,
      }
    })

    await ImportJob.updateOne({ _id: job._id }, {
      $set: {
        status: 'ready_for_mapping',
        'analysis.total_rows': total_rows,
        'analysis.detected_columns': detected_columns,
        'analysis.encoding': encoding,
        'analysis.sheets': sheets,
        'progress.total': total_rows,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        total_rows,
        encoding,
        sheets,
        detected_columns,
        sample: sample.slice(0, 10),
        entity,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await ImportJob.updateOne({ _id: job._id }, { $set: { status: 'failed' } })
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
