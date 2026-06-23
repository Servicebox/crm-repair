'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, LayoutGrid, List, Search, Filter } from 'lucide-react'
import OrdersKanban from '@/components/orders/OrdersKanban'
import OrdersList from '@/components/orders/OrdersList'
import { ORDER_STATUSES } from '@/constants/orders'

type ViewMode = 'kanban' | 'list'

export default function OrdersPage() {
  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', search, filterStatus, filterType],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterType !== 'all') params.set('type', filterType)
      const res = await fetch(`/api/orders?${params}&limit=200`)
      const json = await res.json()
      return json.data
    },
  })

  const orders = data?.orders ?? []

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-4 md:px-6 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по номеру, клиенту, телефону, модели, IMEI..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 bg-background"
          >
            <option value="all">Все статусы</option>
            {ORDER_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 bg-background"
          >
            <option value="all">Все виды</option>
            <option value="repair">Ремонт</option>
            <option value="service">Услуга</option>
          </select>

          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`p-2 transition ${view === 'list' ? 'bg-blue-600 text-white' : 'hover:bg-accent'}`}
              title="Список"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`p-2 transition ${view === 'kanban' ? 'bg-blue-600 text-white' : 'hover:bg-accent'}`}
              title="Доска"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <Link
            href="/orders/new"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Новый заказ</span>
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mt-2 overflow-x-auto no-scrollbar">
          {[{ value: 'all', label: 'Все' }, ...ORDER_STATUSES].map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition ${
                filterStatus === s.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Заказов пока нет</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Создайте первый заказ — клиент, устройство, неисправность, и поехали.
            </p>
            <Link
              href="/orders/new"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              Создать первый заказ
            </Link>
          </div>
        ) : view === 'kanban' ? (
          <OrdersKanban orders={orders} onRefetch={refetch} />
        ) : (
          <OrdersList orders={orders} onRefetch={refetch} />
        )}
      </div>
    </div>
  )
}
