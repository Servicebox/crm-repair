'use client'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { StatusBadge } from '@/components/orders/OrderBadge'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export default function MyOrdersPage() {
  const { data: session } = useSession()

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', session?.user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/orders?masterId=${session?.user?.id}&limit=100`)
      const json = await res.json()
      return json.data
    },
    enabled: !!session?.user?.id,
  })

  const orders = data?.orders ?? []

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold mb-6">Мои заказы</h1>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Заказов не назначено</div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: { _id: string; number: string; status: string; clientName: string; deviceType: string; deviceModel?: string; defectDescription: string; finalCost: number; createdAt: string }) => (
            <Link key={order._id} href={`/orders/${order._id}`}>
              <div className="bg-card border rounded-xl p-4 hover:shadow-md transition-shadow flex items-center gap-4">
                <div>
                  <div className="font-mono text-sm font-medium text-blue-600">{order.number}</div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{order.clientName}</div>
                  <div className="text-sm text-muted-foreground truncate">{order.deviceType} {order.deviceModel} · {order.defectDescription}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">{order.finalCost > 0 ? formatCurrency(order.finalCost) : '—'}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
