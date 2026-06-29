import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 15 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'])

function mediaRoot(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR, 'media')
    : path.join(process.cwd(), 'data', 'uploads', 'media')
}

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { models: { Order } } = authResult

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  let file: File
  try {
    const formData = await req.formData()
    const field = formData.get('file')
    if (!field || typeof field === 'string') return err('Файл не найден', 400)
    file = field as File
  } catch {
    return err('Ошибка чтения файла', 400)
  }

  if (!ALLOWED_MIME.has(file.type)) return err('Допустимы только изображения (JPG, PNG, WebP, BMP)', 400)
  if (file.size > MAX_SIZE) return err(`Файл слишком большой (максимум ${MAX_SIZE / 1024 / 1024} МБ)`, 400)

  const order = await Order.findById(params.id)
  if (!order) return err('Заказ не найден', 404)

  const uploadDir = path.join(mediaRoot(), 'orders')
  fs.mkdirSync(uploadDir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  const outputBuffer = await sharp(buffer)
    .resize(1920, 1440, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  const filename = `${params.id}_${Date.now()}.webp`
  const filePath = path.join(uploadDir, filename)
  fs.writeFileSync(filePath, outputBuffer)

  const url = `/api/serve/orders/${filename}`
  order.photos = [...(order.photos ?? []), url]
  await order.save()

  return ok({ url, photos: order.photos })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error
  const { models: { Order } } = authResult

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  if (!url) return err('URL не указан', 400)

  const order = await Order.findById(params.id)
  if (!order) return err('Заказ не найден', 404)

  // Remove from photos array
  order.photos = (order.photos ?? []).filter((p: string) => p !== url)
  await order.save()

  // Try to delete the file (best effort)
  try {
    const filename = path.basename(url)
    const safeName = path.basename(filename)
    if (safeName === filename && safeName.endsWith('.webp') && safeName.startsWith(params.id)) {
      const filePath = path.join(mediaRoot(), 'orders', safeName)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
  } catch {
    // ignore file deletion errors
  }

  return ok({ photos: order.photos })
}
