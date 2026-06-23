'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, Bell, Plus, User } from 'lucide-react'

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
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)

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

  const title = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ?? 'CRM'

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur-sm flex items-center gap-4 px-4 shrink-0">
      <h1 className="text-sm font-semibold text-foreground hidden lg:block">{title}</h1>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:block">
        {searchOpen ? (
          <input
            autoFocus
            type="text"
            placeholder="Поиск по номеру, клиенту, IMEI..."
            className="w-72 px-3 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            onBlur={() => setSearchOpen(false)}
          />
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-lg hover:bg-accent transition"
          >
            <Search className="w-4 h-4" />
            <span>Поиск...</span>
            <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
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
