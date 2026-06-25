import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ImportJob from '@/models/ImportJob'
import User from '@/models/User'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import type { ImportFileType } from '@/models/ImportJob'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const UPLOAD_BASE = process.env.UPLOAD_DIR ?? '/tmp/crm-imports'
const MAX_FILE_SIZE = 100 * 1024 * 1024  // 100 MB

const ALLOWED_EXT: Record<string, ImportFileType> = {
  '.csv': 'csv',
  '.xlsx': 'xlsx',
  '.xls': 'xls',
  '.xml': 'xml',
}

// Magic byte signatures for basic file type validation
const MAGIC_BYTES: Array<{ type: ImportFileType; offset: number; bytes: number[] }> = [
  { type: 'xlsx', offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] },  // PK ZIP (xlsx)
  { type: 'xls',  offset: 0, bytes: [0xD0, 0xCF, 0x11, 0xE0] },  // OLE2 (xls)
  { type: 'xml',  offset: 0, bytes: [0x3C]                     },  // '<' (XML)
]

function checkMagicBytes(filePath: string): ImportFileType | null {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(8)
    fs.readSync(fd, buf, 0, 8, 0)
    fs.closeSync(fd)
    for (const sig of MAGIC_BYTES) {
      const match = sig.bytes.every((b, i) => buf[sig.offset + i] === b)
      if (match) return sig.type
    }
  } catch {
    // ignore — extension-based detection will be used
  }
  return null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve companyId: session first, then direct DB lookup as fallback
  await connectToDatabase()
  let companyId = session.user.companyId
  if (!companyId && session.user.id) {
    try {
      const userDoc = await User.findById(session.user.id)
        .select('companyId')
        .lean() as { companyId?: mongoose.Types.ObjectId } | null
      companyId = userDoc?.companyId?.toString() ?? ''
    } catch {
      // will hit check below
    }
  }
  if (!companyId) {
    return NextResponse.json({ success: false, error: 'Нет привязки к организации' }, { status: 403 })
  }

  // Rate limiting: max 5 active imports per org in the last hour
  const recentCount = await ImportJob.countDocuments({
    organization_id: new mongoose.Types.ObjectId(companyId),
    created_at: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    status: { $in: ['uploading', 'analyzing', 'importing'] },
  })
  if (recentCount >= 5) {
    return NextResponse.json({ success: false, error: 'Лимит: не более 5 активных импортов в час' }, { status: 429 })
  }

  // Parse multipart form using the built-in Web API (no formidable needed)
  let uploadedFile: File
  try {
    const formData = await req.formData()
    const field = formData.get('file')
    if (!field || typeof field === 'string') {
      return NextResponse.json({ success: false, error: 'Файл не найден в запросе' }, { status: 400 })
    }
    uploadedFile = field as File
    if (uploadedFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: `Файл слишком большой (максимум ${MAX_FILE_SIZE / 1024 / 1024} МБ)`,
      }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка чтения файла'
    return NextResponse.json({ success: false, error: msg }, { status: 400 })
  }

  // Determine file type from extension
  const originalName = uploadedFile.name
  const ext = path.extname(originalName).toLowerCase()
  let fileType: ImportFileType = ALLOWED_EXT[ext] ?? 'csv'

  // Save to disk
  const jobDir = path.join(UPLOAD_BASE, companyId, new mongoose.Types.ObjectId().toString())
  try {
    fs.mkdirSync(jobDir, { recursive: true })
    const savedFilename = `upload_${Date.now()}${ext}`
    const filePath = path.join(jobDir, savedFilename)

    const buffer = Buffer.from(await uploadedFile.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    // Validate with magic bytes (prevents extension spoofing)
    const magic = checkMagicBytes(filePath)
    if (magic && magic !== fileType && fileType !== 'csv') {
      fileType = magic
    }

    if (!Object.values(ALLOWED_EXT).includes(fileType)) {
      fs.unlinkSync(filePath)
      return NextResponse.json({ success: false, error: 'Неподдерживаемый формат файла' }, { status: 400 })
    }

    const job = await ImportJob.create({
      organization_id: new mongoose.Types.ObjectId(companyId),
      created_by: new mongoose.Types.ObjectId(session.user.id),
      file_type: fileType,
      original_filename: originalName,
      storage_path: filePath,
      status: 'uploaded',
    })

    return NextResponse.json({
      success: true,
      data: {
        id: job._id.toString(),
        file_type: fileType,
        original_filename: originalName,
        status: job.status,
      },
    }, { status: 201 })
  } catch (err: unknown) {
    try { fs.rmSync(jobDir, { recursive: true, force: true }) } catch { /* ignore */ }
    const msg = err instanceof Error ? err.message : 'Ошибка сохранения файла'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
