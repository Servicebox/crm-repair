'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, Bell, Plus, User, Menu } from 'lucide-react'
import { useSidebar } from '@/lib/sidebar-context'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Главная',
  '/orders': 'Заказы',
  '/my-orders': 'Мои заказы',
  '/clients': 'Клиенты',
  '/warehouse': 'Склад',
  '/finance': 'Финансы',
  '/reports': 'Отчёты',
  '/employees': 'Сотрудники',
  '/services': 'Услуги',
  '/settings': 'Настройки',
  '/chat': 'Чат',
  '/funnel': 'Воронка продаж',
}

export default function Header() {
  const { data: session } = useSession()
  const { setMobileOpen } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    if (searchOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [searchOpen])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?count=unread')
      const json = await res.json() as { data: { count: number } }
      return json.data?.count ?? 0
    },
    refetchInterval: 30000,
    staleTime: 20000,
  })
  const unreadCount = unreadData ?? 0

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return { orders: [], clients: [] }
      const [ordersRes, clientsRes] = await Promise.all([
        fetch(`/api/orders?search=${encodeURIComponent(debouncedQuery)}&limit=5`),
        fetch(`/api/clients?search=${encodeURIComponent(debouncedQuery)}&limit=5`),
      ])
      const ordersJson = await ordersRes.json() as { data: { orders: unknown[] } }
      const clientsJson = await clientsRes.json() as { data: { clients: unknown[] } }
      return {
        orders: ordersJson.data?.orders ?? [],
        clients: clientsJson.data?.clients ?? [],
      }
    },
    enabled: debouncedQuery.length >= 2,
  })

  const searchOrders = (searchResults?.orders ?? []) as Array<{ _id: string; number: string; clientName: string; deviceType: string; status: string }>
  const searchClients = (searchResults?.clients ?? []) as Array<{ _id: string; name: string; phone?: string; totalOrders: number }>

  const title = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ?? 'CRM'

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur-sm flex items-center gap-4 px-4 shrink-0">
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden p-2 rounded-lg hover:bg-accent transition text-muted-foreground"
        aria-label="Открыть меню"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-sm font-semibold text-foreground hidden lg:block">{title}</h1>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:block" ref={searchRef}>
        {!searchOpen ? (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-lg hover:bg-accent transition"
          >
            <Search className="w-4 h-4" />
            <span>Поиск...</span>
            <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
        ) : (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по заказам, клиентам..."
              className="w-72 pl-9 pr-3 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') } }}
            />
            {searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-background border rounded-xl shadow-lg z-50 overflow-hidden">
                {searchLoading && (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Поиск...</div>
                )}
                {!searchLoading && searchOrders.length === 0 && searchClients.length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Ничего не найдено</div>
                )}
                {searchOrders.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b">Заказы</div>
                    {searchOrders.map(order => (
                      <button
                        key={order._id}
                        className="w-full text-left px-4 py-2.5 hover:bg-accent transition text-sm border-b last:border-0"
                        onClick={() => { router.push(`/orders/${order._id}`); setSearchOpen(false); setSearchQuery('') }}
                      >
                        <div className="font-medium font-mono">{order.number}</div>
                        <div className="text-xs text-muted-foreground">{order.clientName} · {order.deviceType}</div>
                      </button>
                    ))}
                  </>
                )}
                {searchClients.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b">Клиенты</div>
                    {searchClients.map(client => (
                      <button
                        key={client._id}
                        className="w-full text-left px-4 py-2.5 hover:bg-accent transition text-sm border-b last:border-0"
                        onClick={() => { router.push(`/clients/${client._id}`); setSearchOpen(false); setSearchQuery('') }}
                      >
                        <div className="font-medium">{client.name}</div>
                        <div className="text-xs text-muted-foreground">{client.phone} · {client.totalOrders} заказов</div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Order shortcut */}
      <Link
        href="/orders/new"
        className="hidden md:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
      >
        <Plus className="w-4 h-4" />
        Новый заказ
      </Link>

      {/* Notifications */}
      <button
        onClick={() => router.push('/notifications')}
        className="relative p-2 rounded-lg hover:bg-accent transition"
        aria-label={`Уведомления${unreadCount > 0 ? `, ${unreadCount} непрочитанных` : ''}`}
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* User */}
      <Link href="/settings/profile" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition">
        <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium hidden lg:block">{session?.user?.name}</span>
      </Link>
    </header>
  )
}
