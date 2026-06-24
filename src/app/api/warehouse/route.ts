import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

const ProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  productType: z.enum(['part', 'product']).default('part'),
  condition: z.enum(['new', 'used']).optional(),
  location: z.string().optional(),
  serialTracking: z.boolean().default(false),
  quantity: z.number().default(0),
  minQuantity: z.number().default(1),
  cost: z.number().min(0),
  price: z.number().min(0),
  supplier: z.string().optional(),
  locationId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Product } } = auth

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const lowStock = searchParams.get('lowStock') === 'true'
  const productType = searchParams.get('productType')
  const stockFilter = searchParams.get('stock')

  const filter: Record<string, unknown> = { isActive: true }
  if (productType) filter.productType = productType
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { sku: { $regex: escaped, $options: 'i' } },
      { barcode: { $regex: escaped, $options: 'i' } },
      { category: { $regex: escaped, $options: 'i' } },
    ]
  }
  if (category) filter.category = category
  if (lowStock || stockFilter === 'low') filter.$expr = { $lte: ['$quantity', '$minQuantity'] }
  if (stockFilter === 'out') filter.quantity = 0

  const products = await Product.find(filter).sort({ name: 1 }).lean()
  return ok(products)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Product } } = auth

  try {
    const body = await req.json()
    const data = ProductSchema.parse(body)
    const product = await Product.create(data)
    return ok(product, 201)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка создания товара', 500)
  }
}
