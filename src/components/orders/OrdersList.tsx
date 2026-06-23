'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { StatusBadge, PriorityBadge } from './OrderBadge'
import { Smartphone, Laptop, ChevronDown, ChevronUp } from 'lucide-react'

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

function DeviceIcon({ type }: { type: string }) {
  const t = type.toLowerCase()
  if (t.includes('ноутбук') || t.includes('пк')) return <Laptop className="w-4 h-4" />
  return <Smartphone className="w-4 h-4" />
}

export default function OrdersList({ orders, onRefetch }: { orders: Order[]; onRefetch: () => void }) {
  const [sortKey, setSortKey] = useState<keyof Order>('createdAt')
  const [sortAsc, setSortAsc] = useState(false)

  function toggleSort(key: keyof Order) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...orders].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    return sortAsc
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })

  function SortIcon({ k }: { k: keyof Order }) {
    if (sortKey !== k) return null
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  function Th({ label, k }: { label: string; k: keyof Order }) {
    return (
      <th
        className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
        onClick={() => toggleSort(k)}
      >
        <span className="flex items-center gap-1">
          {label}
          <SortIcon k={k} />
        </span>
      </th>
    )
  }

  return (
    <div className="overflow-auto h-full scrollbar-thin">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background border-b z-10">
          <tr>
            <Th label="№" k="number" />
            <Th label="Статус" k="status" />
            <Th label="Клиент" k="clientName" />
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Устройство</th>
            <Th label="Неисправность" k="defectDescription" />
            <Th label="Мастер" k="masterName" />
            <Th label="Срок" k="dueDate" />
            <Th label="Сумма" k="finalCost" />
            <Th label="Создан" k="createdAt" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(order => (
            <tr key={order._id} className="border-b hover:bg-accent/50 transition-colors">
              <td className="px-3 py-2.5">
                <Link href={`/orders/${order._id}`} className="font-mono font-medium text-blue-600 hover:underline text-xs">
                  {order.number}
                </Link>
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={order.status} />
              </td>
              <td className="px-3 py-2.5">
                <div className="font-medium">{order.clientName}</div>
                {order.clientPhone && <div className="text-xs text-muted-foreground">{order.clientPhone}</div>}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <DeviceIcon type={order.deviceType} />
                  <div>
                    <div className="text-xs">{order.deviceBrand} {order.deviceModel}</div>
                    <div className="text-xs text-muted-foreground">{order.deviceType}</div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={order.defectDescription}>
                  {order.defectDescription}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <span className="text-xs">{order.masterName ?? '—'}</span>
              </td>
              <td className="px-3 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {order.dueDate ? formatDateTime(order.dueDate) : '—'}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className="text-sm font-medium">
                  {order.finalCost > 0 ? formatCurrency(order.finalCost) : '—'}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
