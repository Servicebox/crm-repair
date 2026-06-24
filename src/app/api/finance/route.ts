import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok } from '@/lib/api-helpers'

const TransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  category: z.string().min(1),
  description: z.string().optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'online']).default('cash'),
  date: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Transaction } } = auth

  const { searchParams } = req.nextUrl
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = parseInt(searchParams.get('limit') ?? '100')

  const filter: Record<string, unknown> = {}
  if (type) filter.type = type
  if (from || to) {
    filter.date = {
      ...(from && { $gte: new Date(from) }),
      ...(to && { $lte: new Date(to) }),
    }
  }

  const transactions = await Transaction.find(filter)
    .sort({ date: -1 })
    .limit(limit)
    .lean()

  const [incomeAgg, expenseAgg] = await Promise.all([
    Transaction.aggregate([
      { $match: { ...filter, type: 'income' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { ...filter, type: 'expense' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ])

  return ok({
    transactions,
    summary: {
      income: incomeAgg[0]?.total ?? 0,
      expense: expenseAgg[0]?.total ?? 0,
      profit: (incomeAgg[0]?.total ?? 0) - (expenseAgg[0]?.total ?? 0),
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Transaction } } = auth

  const body = await req.json()
  const data = TransactionSchema.parse(body)
  const tx = await Transaction.create({
    ...data,
    date: data.date ? new Date(data.date) : new Date(),
    userId: auth.session!.user.id,
  })
  return ok(tx, 201)
}
