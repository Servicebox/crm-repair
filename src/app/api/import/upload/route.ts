import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ImportJob from '@/models/ImportJob'
import User from '@/models/User'
import mongoose from 'mongoose'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import type { ImportFileType } from '@/models/ImportJob'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const UPLOAD_BASE = process.env.UPLOAD_DIR ?? '/tmp/crm-imports'
const MAX_FILE_SIZE = 100 * 1024 * 1024  // 100 MB

const ALLOWED_MIME: Record<string, ImportFileType> = {
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/plain': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/xml': 'xml',
  'application/xml': 'xml',
}

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
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(8)
  fs.readSync(fd, buf, 0, 8, 0)
  fs.closeSync(fd)

  for (const sig of MAGIC_BYTES) {
    const match = sig.bytes.every((b, i) => buf[sig.offset + i] === b)
    if (match) return sig.type
  }
  // CSV: no magic bytes, detected by extension/mime
  return null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // session.user.companyId is populated by the session callback via a fresh DB lookup.
  // If that lookup failed (cold start, transient error), fall back to a direct DB query here.
  await connectToDatabase()
  let companyId = session.user.companyId
  if (!companyId && session.user.id) {
    try {
      const userDoc = await User.findById(session.user.id)
        .select('companyId')
        .lean() as { companyId?: mongoose.Types.ObjectId } | null
      companyId = userDoc?.companyId?.toString() ?? ''
    } catch {
      // leave empty, will hit the check below
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

  // Prepare upload directory BEFORE parsing so formidable knows where to save
  const jobDir = path.join(UPLOAD_BASE, companyId, new mongoose.Types.ObjectId().toString())
  fs.mkdirSync(jobDir, { recursive: true })

  // Convert Next.js Web ReadableStream → Node.js Readable for formidable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeStream = Readable.fromWeb(req.body as any)

  const form = formidable({
    uploadDir: jobDir,
    keepExtensions: true,
    maxFileSize: MAX_FILE_SIZE,
    maxFiles: 1,
    filter: part => {
      return part.name === 'file'
    },
  })

  let uploadedFile: formidable.File
  try {
    const [, files] = await form.parse(nodeStream as unknown as import('http').IncomingMessage)
    const fileField = files.file
    if (!fileField || !fileField[0]) {
      return NextResponse.json({ success: false, error: 'Файл не найден в запросе' }, { status: 400 })
    }
    uploadedFile = fileField[0]
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка загрузки'
    return NextResponse.json({ success: false, error: msg }, { status: 400 })
  }

  // Determine file type from extension + MIME
  const originalName = uploadedFile.originalFilename ?? 'file'
  const ext = path.extname(originalName).toLowerCase()
  let fileType: ImportFileType = ALLOWED_EXT[ext] ?? ALLOWED_MIME[uploadedFile.mimetype ?? ''] ?? 'csv'

  // Validate with magic bytes (prevents extension spoofing)
  const magic = checkMagicBytes(uploadedFile.filepath)
  if (magic && magic !== fileType && fileType !== 'csv') {
    fileType = magic
  }

  if (!Object.values(ALLOWED_EXT).includes(fileType)) {
    fs.unlinkSync(uploadedFile.filepath)
    return NextResponse.json({ success: false, error: 'Неподдерживаемый формат файла' }, { status: 400 })
  }

  const job = await ImportJob.create({
    organization_id: new mongoose.Types.ObjectId(companyId),
    created_by: new mongoose.Types.ObjectId(session.user.id),
    file_type: fileType,
    original_filename: originalName,
    storage_path: uploadedFile.filepath,
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
}
