'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { StatusBadge } from './OrderBadge'
import { ORDER_STATUSES } from '@/constants/orders'
import { Smartphone, Clock } from 'lucide-react'

interface Order {
  _id: string
  number: string
  status: string
  priority: string
  clientName: string
  clientPhone?: string
  deviceType: string
  deviceBrand?: string
  deviceModel?: string
  defectDescription: string
  masterName?: string
  finalCost: number
  dueDate?: string
  createdAt: string
}

const KANBAN_COLUMNS = ORDER_STATUSES.filter(s =>
  !['issued', 'cancelled'].includes(s.value)
)

function OrderCard({ order }: { order: Order }) {
  const isOverdue = order.dueDate && new Date(order.dueDate) < new Date() && order.status !== 'issued'

  return (
    <Link href={`/orders/${order._id}`}>
      <div className={`bg-background border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer ${isOverdue ? 'border-red-300' : ''}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="font-mono text-xs font-medium text-blue-600">{order.number}</span>
          {isOverdue && <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />}
        </div>
        <div className="font-medium text-sm mb-1 truncate">{order.clientName}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Smartphone className="w-3 h-3" />
          <span className="truncate">{order.deviceBrand} {order.deviceModel || order.deviceType}</span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{order.defectDescription}</p>
        {order.masterName && (
          <div className="text-xs text-blue-600">👨‍🔧 {order.masterName}</div>
        )}
        {order.dueDate && (
          <div className={`text-xs mt-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
            Срок: {formatDate(order.dueDate)}
          </div>
        )}
      </div>
    </Link>
  )
}

export default function OrdersKanban({ orders, onRefetch }: { orders: Order[]; onRefetch: () => void }) {
  const grouped = Object.fromEntries(
    KANBAN_COLUMNS.map(col => [
      col.value,
      orders.filter(o => o.status === col.value),
    ])
  )

  return (
    <div className="flex gap-4 h-full overflow-x-auto p-4 scrollbar-thin">
      {KANBAN_COLUMNS.map(col => (
        <div key={col.value} className="flex-shrink-0 w-72">
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
            <span className="font-medium text-sm">{col.label}</span>
            <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {grouped[col.value]?.length ?? 0}
            </span>
          </div>
          <div className="space-y-2">
            {grouped[col.value]?.map(order => (
              <OrderCard key={order._id} order={order} />
            ))}
            {grouped[col.value]?.length === 0 && (
              <div className="border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                Нет заказов
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
