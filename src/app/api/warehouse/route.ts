import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Product from '@/models/Product'

const ProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().default(0),
  minQuantity: z.number().default(1),
  cost: z.number().default(0),
  price: z.number().default(0),
  supplier: z.string().optional(),
  locationId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const lowStock = searchParams.get('lowStock') === 'true'

  const filter: Record<string, unknown> = { isActive: true }
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { sku: { $regex: search, $options: 'i' } },
  ]
  if (category) filter.category = category
  if (lowStock) filter.$expr = { $lte: ['$quantity', '$minQuantity'] }

  const products = await Product.find(filter).sort({ name: 1 }).lean()
  return ok(products)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const body = await req.json()
  const data = ProductSchema.parse(body)
  await connectToDatabase()
  const product = await Product.create(data)
  return ok(product, 201)
}
