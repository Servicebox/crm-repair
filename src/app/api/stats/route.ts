import { NextRequest } from 'next/server'
import { requireTenantAuth, ok } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Order, Client, Transaction } } = auth

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
    cancelledOrders,
    newClients,
    ordersByStatus,
    // Revenue = finalCost from issued orders
    revenueAgg,
    // COGS = works.cost + parts.cost*qty from issued orders
    cogsAgg,
    // Revenue by day (issued orders)
    revenueByDay,
    // Top masters
    topMasters,
    // POS sales via Transaction
    salesAgg,
    // Manual expenses
    expensesAgg,
    // Avg repair time hours
    avgRepairTimeAgg,
    // Device types
    deviceTypesAgg,
    // Sources
    sourcesAgg,
  ] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: from } }),
    Order.countDocuments({ status: 'new', createdAt: { $gte: from } }),
    Order.countDocuments({ status: 'in_repair', createdAt: { $gte: from } }),
    Order.countDocuments({ status: 'ready', createdAt: { $gte: from } }),
    Order.countDocuments({ status: 'issued', createdAt: { $gte: from } }),
    Order.countDocuments({ status: 'cancelled', createdAt: { $gte: from } }),
    Client.countDocuments({ createdAt: { $gte: from } }),

    Order.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Revenue: sum finalCost of issued orders in period
    Order.aggregate([
      { $match: { status: 'issued', createdAt: { $gte: from } } },
      { $group: { _id: null, total: { $sum: '$finalCost' } } },
    ]),

    // COGS: sum works.cost + parts.cost * parts.quantity for issued orders
    Order.aggregate([
      { $match: { status: 'issued', createdAt: { $gte: from } } },
      {
        $project: {
          worksCost: {
            $reduce: {
              input: { $ifNull: ['$works', []] },
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] },
            },
          },
          partsCost: {
            $reduce: {
              input: { $ifNull: ['$parts', []] },
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  { $multiply: [{ $ifNull: ['$$this.cost', 0] }, { $ifNull: ['$$this.quantity', 1] }] },
                ],
              },
            },
          },
        },
      },
      { $group: { _id: null, totalCogs: { $sum: { $add: ['$worksCost', '$partsCost'] } } } },
    ]),

    // Revenue by day
    Order.aggregate([
      { $match: { status: 'issued', createdAt: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$finalCost' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Top masters
    Order.aggregate([
      { $match: { masterId: { $exists: true }, status: 'issued', createdAt: { $gte: from } } },
      {
        $group: {
          _id: '$masterId',
          masterName: { $first: '$masterName' },
          count: { $sum: 1 },
          revenue: { $sum: '$finalCost' },
          cogs: {
            $sum: {
              $add: [
                {
                  $reduce: {
                    input: { $ifNull: ['$works', []] },
                    initialValue: 0,
                    in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] },
                  },
                },
                {
                  $reduce: {
                    input: { $ifNull: ['$parts', []] },
                    initialValue: 0,
                    in: {
                      $add: [
                        '$$value',
                        { $multiply: [{ $ifNull: ['$$this.cost', 0] }, { $ifNull: ['$$this.quantity', 1] }] },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),

    // POS sales
    Transaction.aggregate([
      { $match: { type: 'income', category: 'sale', date: { $gte: from } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Manual expenses
    Transaction.aggregate([
      { $match: { type: 'expense', date: { $gte: from } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    // Avg repair time (hours)
    Order.aggregate([
      { $match: { status: 'issued', issuedAt: { $exists: true }, createdAt: { $gte: from } } },
      {
        $project: {
          durationHours: { $divide: [{ $subtract: ['$issuedAt', '$createdAt'] }, 3600000] },
        },
      },
      { $group: { _id: null, avg: { $avg: '$durationHours' } } },
    ]),

    // Device type distribution
    Order.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),

    // Client source distribution
    Order.aggregate([
      { $match: { createdAt: { $gte: from }, source: { $exists: true, $ne: '' } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ])

  const orderRevenue = revenueAgg[0]?.total ?? 0
  const orderCogs = cogsAgg[0]?.totalCogs ?? 0
  const grossProfit = orderRevenue - orderCogs
  const grossMargin = orderRevenue > 0 ? Math.round((grossProfit / orderRevenue) * 100) : 0
  const posRevenue = salesAgg[0]?.total ?? 0
  const posCount = salesAgg[0]?.count ?? 0
  const manualExpenses = expensesAgg[0]?.total ?? 0
  const totalRevenue = orderRevenue + posRevenue
  const netProfit = grossProfit - manualExpenses
  const avgCheck = issuedOrders > 0 ? Math.round(orderRevenue / issuedOrders) : 0
  const conversionRate = totalOrders > 0 ? Math.round((issuedOrders / totalOrders) * 100) : 0
  const avgRepairHours = avgRepairTimeAgg[0]?.avg != null
    ? Math.round((avgRepairTimeAgg[0].avg as number) * 10) / 10
    : null

  const topMastersEnriched = (topMasters as Array<{
    _id: unknown; masterName: string; count: number; revenue: number; cogs: number
  }>).map(m => ({
    ...m,
    grossProfit: m.revenue - m.cogs,
    margin: m.revenue > 0 ? Math.round(((m.revenue - m.cogs) / m.revenue) * 100) : 0,
  }))

  return ok({
    period,
    from,
    orders: {
      total: totalOrders,
      new: newOrders,
      inRepair: inRepairOrders,
      ready: readyOrders,
      issued: issuedOrders,
      cancelled: cancelledOrders,
    },
    // Financial
    revenue: totalRevenue,
    orderRevenue,
    posRevenue,
    posCount,
    orderCogs,
    grossProfit,
    grossMargin,
    manualExpenses,
    netProfit,
    avgCheck,
    // Operational
    newClients,
    conversionRate,
    avgRepairHours,
    // Charts & breakdowns
    ordersByStatus,
    revenueByDay,
    deviceTypesAgg,
    sourcesAgg,
    topMasters: topMastersEnriched,
  })
}
