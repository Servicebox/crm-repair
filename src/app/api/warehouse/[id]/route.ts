import { NextRequest } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  productType: z.enum(['part', 'product']).optional(),
  condition: z.enum(['new', 'used']).optional(),
  location: z.string().optional(),
  serialTracking: z.boolean().optional(),
  quantity: z.number().int().min(0).optional(),
  minQuantity: z.number().int().min(0).optional(),
  cost: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  supplier: z.string().optional(),
  locationId: z.string().optional(),
  isActive: z.boolean().optional(),
})

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Product } } = auth

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  try {
    const body = await req.json()
    const data = UpdateProductSchema.parse(body)
    const product = await Product.findByIdAndUpdate(params.id, data, { new: true })
    if (!product) return err('Товар не найден', 404)
    return ok(product)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка обновления товара', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Product } } = auth

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  await Product.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
