import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, requireTenantRole, ok, err } from '@/lib/api-helpers'

const ListingSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1),
  price: z.number().min(0),
  oldPrice: z.number().min(0).optional(),
  supplier: z.string().min(1),
  supplierUrl: z.string().url().optional().or(z.literal('')),
  sku: z.string().optional(),
  brand: z.string().optional(),
  description: z.string().max(1000).optional(),
  inStock: z.boolean().default(true),
  delivery: z.string().optional(),
  imageUrl: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Product } } = auth

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const supplier = searchParams.get('supplier')
  const inStock = searchParams.get('inStock')

  // Marketplace items are Products with productType='marketplace'
  const filter: Record<string, unknown> = { productType: 'marketplace', isActive: true }
  if (category) filter.category = category
  if (supplier) filter.supplier = supplier
  if (inStock === 'true') filter.quantity = { $gt: 0 }
  if (search) {
    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { name: { $regex: esc, $options: 'i' } },
      { supplier: { $regex: esc, $options: 'i' } },
      { description: { $regex: esc, $options: 'i' } },
    ]
  }

  const items = await Product.find(filter).sort({ name: 1 }).lean()
  return ok(items)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { Product } } = auth

  const body = await req.json()
  const parsed = ListingSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const item = await Product.create({
    ...parsed.data,
    productType: 'marketplace',
    quantity: parsed.data.inStock ? 999 : 0,
    minQuantity: 1,
    cost: parsed.data.price * 0.7,
    isActive: true,
  })

  return ok(item, 201)
}
