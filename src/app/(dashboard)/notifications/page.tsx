'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck, Loader2, Package, CreditCard, AlertTriangle, Info } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Notification {
  _id: string
  type: 'order_new' | 'order_status' | 'order_payment' | 'stock_low' | 'system'
  title: string
  body: string
  read: boolean
  link?: string
  orderNumber?: string
  createdAt: string
}

function NotificationIcon({ type }: { type: Notification['type'] }) {
  if (type === 'order_new') return <Package className="w-4 h-4 text-blue-500" />
  if (type === 'order_status') return <Info className="w-4 h-4 text-purple-500" />
  if (type === 'order_payment') return <CreditCard className="w-4 h-4 text-green-500" />
  if (type === 'stock_low') return <AlertTriangle className="w-4 h-4 text-orange-500" />
  return <Bell className="w-4 h-4 text-gray-400" />
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru })
  } catch {
    return ''
  }
}

export default function NotificationsPage() {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications')
      const json = await res.json() as { data: Notification[] }
      return json.data ?? []
    },
    refetchInterval: 30000,
  })

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      void qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })

  const markAll = useMutation({
    mutationFn: async () => {
      await fetch('/api/notifications/read-all', { method: 'PATCH' })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      void qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold">Уведомления</h1>
          {unreadCount > 0 && (
            <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
              {unreadCount} новых
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            {markAll.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckCheck className="w-3.5 h-3.5" />}
            Отметить все
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Уведомлений пока нет</p>
          <p className="text-xs mt-1 opacity-60">Новые заказы и изменения статусов появятся здесь</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const inner = (
              <div
                className={`flex items-start gap-3 p-4 rounded-xl border transition ${
                  !n.read
                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                    : 'bg-card'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  !n.read ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-muted'
                }`}>
                  <NotificationIcon type={n.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-snug">{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div>
                  <div className="text-xs text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.read && (
                  <button
                    onClick={(e) => { e.preventDefault(); markOne.mutate(n._id) }}
                    disabled={markOne.isPending}
                    className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition shrink-0"
                    title="Отметить прочитанным"
                  >
                    <Check className="w-4 h-4 text-blue-600" />
                  </button>
                )}
              </div>
            )

            return n.link ? (
              <Link key={n._id} href={n.link} className="block hover:opacity-90 transition">
                {inner}
              </Link>
            ) : (
              <div key={n._id}>{inner}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
