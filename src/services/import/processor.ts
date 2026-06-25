import path from 'path'
import mongoose from 'mongoose'
import ImportJob, { type IFieldMapping, type DuplicateStrategy, type IImportJob } from '@/models/ImportJob'
import { getTenantConnection } from '@/lib/tenantDb'
import { getModels } from '@/lib/models'
import { applyTransformer } from './transformers'
import { streamCsv } from './parsers/csv'
import { streamExcel } from './parsers/excel'
import { streamXml } from './parsers/xml'

const BATCH_SIZE = 100
const PROGRESS_FLUSH_EVERY = 50  // write progress to DB every N rows

// ── Row transformation ────────────────────────────────────────────────────────

function transformRow(
  raw: Record<string, string>,
  mapping: IFieldMapping[]
): { data: Record<string, unknown>; errors: string[] } {
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const field of mapping) {
    if (!field.target_field || field.target_field === '__skip__') continue

    const rawValue = raw[field.source_column] ?? field.default_value ?? null
    const transformed = applyTransformer(field.transformer, rawValue)

    if (field.is_required && (transformed === null || transformed === undefined || transformed === '')) {
      errors.push(`Обязательное поле '${field.source_column}' пустое`)
      continue
    }

    // Write to nested path: 'client.name' → data.client.name
    const parts = field.target_field.split('.')
    let obj = data
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {}
      obj = obj[parts[i]] as Record<string, unknown>
    }
    obj[parts[parts.length - 1]] = transformed
  }

  return { data, errors }
}

// ── Entity writers ────────────────────────────────────────────────────────────

async function upsertClient(
  models: ReturnType<typeof getModels>,
  data: Record<string, unknown>,
  strategy: DuplicateStrategy,
  companyId: string
): Promise<'created' | 'updated' | 'skipped'> {
  const client = (data.client as Record<string, unknown>) ?? {}
  if (!client.name) throw new Error('Имя клиента обязательно')

  const phone = client.phone ? String(client.phone) : null
  const email = client.email ? String(client.email) : null

  const dupFilter: Record<string, unknown>[] = []
  if (phone) dupFilter.push({ phone })
  if (email) dupFilter.push({ email })

  const existing = dupFilter.length
    ? await models.Client.findOne({ $or: dupFilter }).select('_id').lean<{ _id: mongoose.Types.ObjectId }>()
    : null

  if (existing) {
    if (strategy === 'skip') return 'skipped'
    if (strategy === 'create') {
      await models.Client.create({ ...client, source: client.source ?? 'import' })
      return 'created'
    }
    const update = strategy === 'merge'
      ? { $set: Object.fromEntries(Object.entries(client).filter(([, v]) => v != null && v !== '')) }
      : { $set: client }
    await models.Client.updateOne({ _id: existing._id }, update)
    return 'updated'
  }

  await models.Client.create({ ...client, source: client.source ?? 'import' })
  return 'created'
}

async function upsertProduct(
  models: ReturnType<typeof getModels>,
  data: Record<string, unknown>,
  strategy: DuplicateStrategy
): Promise<'created' | 'updated' | 'skipped'> {
  const product = (data.product as Record<string, unknown>) ?? {}
  if (!product.name) throw new Error('Название товара обязательно')

  const sku = product.sku ? String(product.sku) : null
  const barcode = product.barcode ? String(product.barcode) : null

  const dupFilter: Record<string, unknown>[] = []
  if (sku) dupFilter.push({ sku })
  if (barcode) dupFilter.push({ barcode })

  const existing = dupFilter.length
    ? await models.Product.findOne({ $or: dupFilter, isActive: true }).select('_id').lean<{ _id: mongoose.Types.ObjectId }>()
    : null

  if (existing) {
    if (strategy === 'skip') return 'skipped'
    if (strategy === 'create') {
      await models.Product.create({ ...product, isActive: true })
      return 'created'
    }
    await models.Product.updateOne({ _id: existing._id }, { $set: product })
    return 'updated'
  }

  await models.Product.create({ ...product, isActive: true })
  return 'created'
}

// ── Main processor ────────────────────────────────────────────────────────────

export async function runImport(jobId: string, companyId: string, dbName: string): Promise<void> {
  const abortController = new AbortController()

  const jobOrNull = await ImportJob.findById(jobId).lean<IImportJob>()
  if (!jobOrNull) return
  const job = jobOrNull

  await ImportJob.updateOne({ _id: jobId }, {
    $set: {
      status: 'importing',
      started_at: new Date(),
      'progress.total': job.analysis.total_rows,
    },
  })

  const tenantConn = await getTenantConnection(dbName)
  const models = getModels(tenantConn)

  let processed = 0
  let successful = 0
  let failed = 0
  let duplicates_skipped = 0
  const batchErrors: Array<{ row_number: number; source_data: unknown; error_message: string; error_code: string }> = []

  async function processRow(row: Record<string, string>, index: number) {
    if (index % 10 === 0) {
      const current = await ImportJob.findById(jobId).select('status').lean<{ status: string }>()
      if (current?.status === 'cancelled') {
        abortController.abort()
        return
      }
    }

    const { data, errors: validationErrors } = transformRow(row, job.mapping)

    if (validationErrors.length) {
      batchErrors.push({
        row_number: index + 2,  // +1 for header, +1 for 1-based
        source_data: row,
        error_message: validationErrors.join('; '),
        error_code: 'VALIDATION_ERROR',
      })
      failed++
      return
    }

    try {
      let result: 'created' | 'updated' | 'skipped'

      switch (job.target_entity) {
        case 'clients':
          result = await upsertClient(models, data, job.duplicate_strategy, companyId)
          break
        case 'products':
          result = await upsertProduct(models, data, job.duplicate_strategy)
          break
        default:
          throw new Error(`Неизвестная сущность: ${job.target_entity}`)
      }

      if (result === 'skipped') {
        duplicates_skipped++
      } else {
        successful++
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      batchErrors.push({
        row_number: index + 2,
        source_data: row,
        error_message: message,
        error_code: 'IMPORT_ERROR',
      })
      failed++
    }

    // Flush progress to DB periodically (not on every row — reduces write pressure)
    if (++processed % PROGRESS_FLUSH_EVERY === 0) {
      const errorsToAdd = batchErrors.splice(0)
      await ImportJob.updateOne({ _id: jobId }, {
        $set: {
          'progress.processed': processed,
          'progress.successful': successful,
          'progress.failed': failed,
          'progress.duplicates_skipped': duplicates_skipped,
        },
        ...(errorsToAdd.length
          ? { $push: { import_errors: { $each: errorsToAdd, $slice: -500 } } }
          : {}),
      })
    }
  }

  try {
    const ext = path.extname(job.storage_path).toLowerCase().replace('.', '')

    if (ext === 'csv') {
      await streamCsv(
        job.storage_path,
        job.analysis.encoding ?? 'UTF-8',
        processRow,
        abortController.signal
      )
    } else if (ext === 'xml') {
      await streamXml(job.storage_path, processRow, abortController.signal)
    } else {
      await streamExcel(
        job.storage_path,
        job.selected_sheet ?? '',
        processRow,
        abortController.signal
      )
    }

    const remaining = batchErrors.splice(0)
    await ImportJob.updateOne({ _id: jobId }, {
      $set: {
        status: abortController.signal.aborted ? 'cancelled' : 'completed',
        completed_at: new Date(),
        'progress.processed': processed,
        'progress.successful': successful,
        'progress.failed': failed,
        'progress.duplicates_skipped': duplicates_skipped,
      },
      ...(remaining.length
        ? { $push: { import_errors: { $each: remaining, $slice: -500 } } }
        : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await ImportJob.updateOne({ _id: jobId }, {
      $set: {
        status: 'failed',
        completed_at: new Date(),
        'progress.processed': processed,
        'progress.successful': successful,
        'progress.failed': failed,
      },
      $push: {
        import_errors: {
          $each: [{ row_number: 0, source_data: null, error_message: message, error_code: 'FATAL' }],
          $slice: -500,
        },
      },
    })
  }
}
