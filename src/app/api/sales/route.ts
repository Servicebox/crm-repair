import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

const SaleItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().min(0),
  qty: z.number().int().min(1),
  type: z.enum(['product', 'service']),
  discount: z.number().min(0).max(100),
})

const SaleSchema = z.object({
  items: z.array(SaleItemSchema).min(1),
  payMethod: z.enum(['cash', 'card', 'qr']),
  clientName: z.string().optional(),
  globalDiscount: z.number().min(0).max(100).default(0),
})

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { session, models: { Product, Transaction } } = auth

  const body = await req.json()
  const parsed = SaleSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { items, payMethod, clientName, globalDiscount } = parsed.data

  // 1. Check and decrement stock for products
  const productItems = items.filter(i => i.type === 'product')
  for (const item of productItems) {
    const product = await Product.findById(item.id)
    if (!product) return err(`Товар "${item.name}" не найден`, 404)
    if (product.quantity < item.qty) {
      return err(`Недостаточно товара "${item.name}": в наличии ${product.quantity}, нужно ${item.qty}`, 409)
    }
  }

  // 2. Decrement stock
  for (const item of productItems) {
    await Product.findByIdAndUpdate(item.id, { $inc: { quantity: -item.qty } })
  }

  // 3. Calculate totals
  const subtotal = items.reduce((s, i) => s + i.price * i.qty * (1 - i.discount / 100), 0)
  const total = Math.round(subtotal * (1 - globalDiscount / 100))

  // 4. Create transaction
  const saleNumber = `S-${Date.now().toString(36).toUpperCase()}`
  const transaction = await Transaction.create({
    type: 'income',
    category: 'sale',
    amount: total,
    description: `Продажа ${saleNumber}${clientName ? ` (${clientName})` : ''}`,
    paymentMethod: payMethod,
    createdBy: session!.user.id,
    items: items.map(i => ({
      name: i.name,
      qty: i.qty,
      price: i.price,
      discount: i.discount,
      type: i.type,
    })),
  })

  return ok({ saleNumber, total, transactionId: transaction._id }, 201)
}
