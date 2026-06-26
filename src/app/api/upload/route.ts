import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

const MAX_SIZE_AVATAR = 10 * 1024 * 1024
const MAX_SIZE_LOGO   = 10 * 1024 * 1024

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/svg+xml', 'image/bmp', 'image/tiff',
])

// Store files outside /public/ so reading and writing always use the same
// process.cwd() (same Node.js process), regardless of how pm2/Next.js
// resolves the static-file root at startup.
// Files are served through /api/serve/[...path]/route.ts instead.
function mediaRoot(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR, 'media')
    : path.join(process.cwd(), 'data', 'uploads', 'media')
}

const TYPE_CONFIG: Record<string, {
  dir: string
  maxInput: number
  maxWidth: number
  maxHeight: number
  quality: number
}> = {
  avatar: { dir: 'avatars', maxInput: MAX_SIZE_AVATAR, maxWidth: 256,  maxHeight: 256,  quality: 85 },
  logo:   { dir: 'logos',   maxInput: MAX_SIZE_LOGO,   maxWidth: 600,  maxHeight: 300,  quality: 90 },
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') ?? 'avatar'
  const config = TYPE_CONFIG[type]
  if (!config) {
    return NextResponse.json({ success: false, error: 'Неверный тип загрузки' }, { status: 400 })
  }

  let file: File
  try {
    const formData = await req.formData()
    const field = formData.get('file')
    if (!field || typeof field === 'string') {
      return NextResponse.json({ success: false, error: 'Файл не найден' }, { status: 400 })
    }
    file = field as File
  } catch {
    return NextResponse.json({ success: false, error: 'Ошибка чтения файла' }, { status: 400 })
  }

  // SVG — skip sharp processing, save as-is
  const isSvg = file.type === 'image/svg+xml'

  if (!ALLOWED_MIME.has(file.type) && !isSvg) {
    return NextResponse.json({ success: false, error: 'Допустимы только изображения (JPG, PNG, WebP, GIF, SVG, BMP)' }, { status: 400 })
  }

  if (file.size > config.maxInput) {
    return NextResponse.json({
      success: false,
      error: `Файл слишком большой (максимум ${config.maxInput / 1024 / 1024} МБ)`,
    }, { status: 400 })
  }

  const uploadDir = path.join(mediaRoot(), config.dir)
  try {
    fs.mkdirSync(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    let outputBuffer: Buffer
    let ext: string

    if (isSvg) {
      outputBuffer = buffer
      ext = '.svg'
    } else {
      outputBuffer = await sharp(buffer)
        .resize(config.maxWidth, config.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: config.quality })
        .toBuffer()
      ext = '.webp'
    }

    const filename = `${session.user.id}_${Date.now()}${ext}`
    const filePath = path.join(uploadDir, filename)
    fs.writeFileSync(filePath, outputBuffer)

    // Served via /api/serve/ route — avoids Next.js static-serving path issues
    const url = `/api/serve/${config.dir}/${filename}`
    return NextResponse.json({ success: true, data: { url } }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка сохранения'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
