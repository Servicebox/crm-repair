'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ORDER_STATUSES } from '@/constants/orders'
import { Smartphone, Clock, Phone, Wrench } from 'lucide-react'

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

const PRIORITY_STRIP: Record<string, string> = {
  urgent: 'border-l-[3px] border-l-red-500',
  high: 'border-l-[3px] border-l-orange-400',
  normal: '',
  low: '',
}

function OrderCard({
  order,
  onDragStart,
  onDragEnd,
}: {
  order: Order
  onDragStart: (id: string) => void
  onDragEnd: () => void
}) {
  const isOverdue = order.dueDate && new Date(order.dueDate) < new Date() && order.status !== 'issued'
  const strip = PRIORITY_STRIP[order.priority] ?? ''

  return (
    <div
      className="relative group"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('orderId', order._id)
        onDragStart(order._id)
      }}
      onDragEnd={onDragEnd}
    >
      <Link href={`/orders/${order._id}`} onClick={(e) => e.stopPropagation()}>
        <div
          className={[
            'bg-background border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer',
            isOverdue ? 'border-red-300' : '',
            strip,
          ].join(' ')}
        >
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
            <div className="text-xs text-blue-600">
              <Wrench className="w-3 h-3 inline mr-1" />
              {order.masterName}
            </div>
          )}
          {order.dueDate && (
            <div className={`text-xs mt-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              Срок: {formatDate(order.dueDate)}
            </div>
          )}
        </div>
      </Link>

      {/* Hover preview popup */}
      <div className="absolute left-full top-0 z-50 ml-2 w-64 bg-popover border rounded-xl p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-sm">
        <div className="font-mono text-xs text-blue-600 mb-1">{order.number}</div>
        <div className="font-semibold mb-2">{order.clientName}</div>
        {order.clientPhone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Phone className="w-3 h-3" />
            {order.clientPhone}
          </div>
        )}
        <div className="text-xs text-muted-foreground mb-2 line-clamp-3">{order.defectDescription}</div>
        {order.finalCost > 0 && (
          <div className="text-xs font-medium text-green-700">
            {order.finalCost.toLocaleString('ru-RU')} ₽
          </div>
        )}
      </div>
    </div>
  )
}

export default function OrdersKanban({ orders, onRefetch }: { orders: Order[]; onRefetch: () => void }) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const grouped = Object.fromEntries(
    KANBAN_COLUMNS.map(col => [
      col.value,
      orders.filter(o => o.status === col.value),
    ])
  )

  async function handleDrop(targetStatus: string) {
    if (!draggingId) return
    setDragOverColumn(null)

    const res = await fetch(`/api/orders/${draggingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus }),
    })

    setDraggingId(null)
    if (res.ok) onRefetch()
  }

  return (
    <div className="flex gap-4 h-full overflow-x-auto p-4 scrollbar-thin">
      {KANBAN_COLUMNS.map(col => (
        <div
          key={col.value}
          className={[
            'flex-shrink-0 w-72 rounded-xl transition-colors',
            dragOverColumn === col.value && draggingId ? 'bg-accent/40 ring-2 ring-blue-300 ring-offset-1' : '',
          ].join(' ')}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverColumn(col.value)
          }}
          onDragLeave={() => setDragOverColumn(prev => prev === col.value ? null : prev)}
          onDrop={() => handleDrop(col.value)}
        >
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
            <span className="font-medium text-sm">{col.label}</span>
            <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {grouped[col.value]?.length ?? 0}
            </span>
          </div>
          <div className="space-y-2">
            {grouped[col.value]?.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                onDragStart={setDraggingId}
                onDragEnd={() => { setDraggingId(null); setDragOverColumn(null) }}
              />
            ))}
            {grouped[col.value]?.length === 0 && (
              <div className={[
                'border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground transition-colors',
                dragOverColumn === col.value && draggingId ? 'border-blue-400 bg-blue-50/30' : '',
              ].join(' ')}>
                {dragOverColumn === col.value && draggingId ? 'Перетащите сюда' : 'Нет заказов'}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
