import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok } from '@/lib/api-helpers'
import Order from '@/models/Order'
import Client from '@/models/Client'
import Transaction from '@/models/Transaction'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await connectToDatabase()

  const { searchParams } = req.nextUrl
  const period = searchParams.get('period') ?? 'month'

  const now = new Date()
  let from: Date
  switch (period) {
    case 'day':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'year':
      from = new Date(now.getFullYear(), 0, 1)
      break
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const [
    totalOrders,
    newOrders,
    inRepairOrders,
    readyOrders,
    issuedOrders,
    totalRevenue,
    newClients,
    ordersByStatus,
    revenueByDay,
    topMasters,
  ] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: from } }),
    Order.countDocuments({ status: 'new', createdAt: { $gte: from } }),
    Order.countDocuments({ status: 'in_repair', createdAt: { $gte: from } }),
    Order.countDocuments({ status: 'ready', createdAt: { $gte: from } }),
    Order.countDocuments({ status: 'issued', createdAt: { $gte: from } }),
    Transaction.aggregate([
      { $match: { type: 'income', date: { $gte: from } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Client.countDocuments({ createdAt: { $gte: from } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'income', date: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          revenue: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { masterId: { $exists: true }, status: 'issued', createdAt: { $gte: from } } },
      {
        $group: {
          _id: '$masterId',
          masterName: { $first: '$masterName' },
          count: { $sum: 1 },
          revenue: { $sum: '$finalCost' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
  ])

  return ok({
    period,
    from,
    orders: { total: totalOrders, new: newOrders, inRepair: inRepairOrders, ready: readyOrders, issued: issuedOrders },
    revenue: totalRevenue[0]?.total ?? 0,
    newClients,
    ordersByStatus,
    revenueByDay,
    topMasters,
  })
}
