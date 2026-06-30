import fs from 'fs'
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
  const data: Record<string, unknown> = Object.create(null)
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
  if (!dupFilter.length && client.name) dupFilter.push({ name: client.name })

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

async function upsertOrder(
  models: ReturnType<typeof getModels>,
  data: Record<string, unknown>,
  strategy: DuplicateStrategy,
  companyId: string
): Promise<'created' | 'updated' | 'skipped'> {
  const order = (data.order as Record<string, unknown>) ?? {}

  const clientName = order.client_name ? String(order.client_name) : null
  const clientPhone = order.client_phone ? String(order.client_phone) : null
  const deviceType = order.device_name ? String(order.device_name) : 'Устройство'
  const defect = order.malfunction ? String(order.malfunction) : '—'

  if (!clientName) throw new Error('Имя клиента (заказ) обязательно')

  // Find or create the client
  const clientFilter: Record<string, unknown>[] = []
  if (clientPhone) clientFilter.push({ phone: clientPhone })
  if (!clientFilter.length) clientFilter.push({ name: clientName })
  let clientDoc = await models.Client.findOne({ $or: clientFilter }).select('_id name').lean<{ _id: mongoose.Types.ObjectId; name: string }>()
  if (!clientDoc) {
    const created = await models.Client.create({ name: clientName, phone: clientPhone ?? undefined, source: 'import' })
    clientDoc = { _id: created._id as mongoose.Types.ObjectId, name: created.name as string }
  }

  // Find a system user to set as createdBy (first owner/admin in tenant, or fallback ObjectId)
  const systemUser = await models.User.findOne({}).select('_id').lean<{ _id: mongoose.Types.ObjectId }>()
  const createdByOid = systemUser?._id ?? new mongoose.Types.ObjectId()

  // Order number — required and unique
  let orderNumber = order.number ? String(order.number) : null
  if (!orderNumber) {
    const count = await models.Order.countDocuments()
    orderNumber = `IMP-${String(count + 1).padStart(5, '0')}`
  }

  // Duplicate check by order number
  const existing = await models.Order.findOne({ number: orderNumber }).select('_id').lean<{ _id: mongoose.Types.ObjectId }>()

  if (existing) {
    if (strategy === 'skip') return 'skipped'
    if (strategy === 'create') {
      const suffix = `-${Date.now().toString(36)}`
      orderNumber = orderNumber + suffix
    } else {
      const updateData: Record<string, unknown> = {
        clientName,
        clientPhone: clientPhone ?? undefined,
        deviceType,
        defectDescription: defect,
        status: order.status ?? undefined,
        finalCost: order.total_price ? Number(order.total_price) : undefined,
        masterName: order.master_name ?? undefined,
      }
      if (order.created_at) updateData.createdAt = new Date(String(order.created_at))
      if (order.completed_at) updateData.issuedAt = new Date(String(order.completed_at))
      await models.Order.updateOne({ _id: existing._id }, { $set: updateData })
      return 'updated'
    }
  }

  const orderData: Record<string, unknown> = {
    number: orderNumber,
    clientId: clientDoc._id,
    clientName,
    clientPhone: clientPhone ?? undefined,
    deviceType,
    defectDescription: defect,
    createdBy: createdByOid,
    status: (order.status as string) || 'new',
    finalCost: order.total_price ? Number(order.total_price) : 0,
  }
  if (order.device_brand) orderData.deviceBrand = String(order.device_brand)
  if (order.device_model) orderData.deviceModel = String(order.device_model)
  if (order.serial_number) orderData.deviceSerial = String(order.serial_number)
  if (order.master_name) orderData.masterName = String(order.master_name)
  if (order.notes) orderData.adminComment = String(order.notes)
  if (order.created_at) orderData.createdAt = new Date(String(order.created_at))
  if (order.completed_at) orderData.issuedAt = new Date(String(order.completed_at))

  await models.Order.create(orderData)
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
    } else {
      try {
        let result: 'created' | 'updated' | 'skipped'

        switch (job.target_entity) {
          case 'clients':
            result = await upsertClient(models, data, job.duplicate_strategy, companyId)
            break
          case 'products':
            result = await upsertProduct(models, data, job.duplicate_strategy)
            break
          case 'orders':
            result = await upsertOrder(models, data, job.duplicate_strategy, companyId)
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
    }

    // Always increment processed (including rows with validation errors)
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

    // Clean up the uploaded file — data is now in the database (but not if cancelled)
    if (!abortController.signal.aborted) {
      try {
        const fileDir = path.dirname(job.storage_path)
        fs.rmSync(fileDir, { recursive: true, force: true })
      } catch {
        console.warn('[import] Could not clean up upload dir:', job.storage_path)
      }
    }
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

    // Clean up the uploaded file — import failed, file is no longer needed
    try {
      const fileDir = path.dirname(job.storage_path)
      fs.rmSync(fileDir, { recursive: true, force: true })
    } catch {
      console.warn('[import] Could not clean up upload dir:', job.storage_path)
    }
  }
}
