import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Product from '@/models/Product'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  const body = await req.json()
  const product = await Product.findByIdAndUpdate(params.id, body, { new: true })
  if (!product) return err('Товар не найден', 404)
  return ok(product)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  await Product.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
