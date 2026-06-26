import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const ALLOWED_DIRS = new Set(['avatars', 'logos'])

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.bmp':  'image/bmp',
}

function mediaRoot(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR, 'media')
    : path.join(process.cwd(), 'data', 'uploads', 'media')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path

  // Require exactly 2 segments: <dir>/<filename>
  if (!segments || segments.length !== 2) {
    return new NextResponse('Not found', { status: 404 })
  }

  const [dir, filename] = segments

  // Allowlist directories
  if (!ALLOWED_DIRS.has(dir)) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Sanitize filename — reject path traversal attempts
  const safeName = path.basename(filename)
  if (!safeName || safeName !== filename) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const filePath = path.join(mediaRoot(), dir, safeName)

  // Ensure the resolved path stays inside mediaRoot
  const root = mediaRoot()
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const ext = path.extname(safeName).toLowerCase()
  const contentType = MIME[ext] ?? 'application/octet-stream'

  const fileBuffer = fs.readFileSync(filePath)
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
