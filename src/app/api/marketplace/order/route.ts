import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

const OrderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().min(0),
  qty: z.number().int().min(1),
  supplier: z.string(),
})

const MarketOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1),
  comment: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { session, models: { Transaction } } = auth

  const body = await req.json()
  const parsed = MarketOrderSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { items, comment } = parsed.data
  const total = items.reduce((s, i) => s + i.price * i.qty, 0)
  const orderNum = `MP-${Date.now().toString(36).toUpperCase()}`

  // Create procurement transaction (expense)
  await Transaction.create({
    type: 'expense',
    category: 'procurement',
    amount: total,
    description: `Заявка на закупку ${orderNum}${comment ? ': ' + comment : ''}`,
    paymentMethod: 'invoice',
    createdBy: session!.user.id,
    items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price, type: 'marketplace' })),
  })

  // Group by supplier for notification
  const bySupplier = items.reduce((acc: Record<string, typeof items>, i) => {
    ;(acc[i.supplier] = acc[i.supplier] ?? []).push(i)
    return acc
  }, {})

  return ok({
    orderNumber: orderNum,
    total,
    suppliers: Object.keys(bySupplier),
    itemCount: items.length,
  }, 201)
}
