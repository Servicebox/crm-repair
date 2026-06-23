'use client'
import { Bell, Check } from 'lucide-react'

const MOCK_NOTIFICATIONS = [
  { id: 1, text: 'Заказ SB-000001 готов к выдаче', time: '10 мин назад', read: false, type: 'success' },
  { id: 2, text: 'Низкий остаток: Дисплей iPhone 14 (0 шт)', time: '1 час назад', read: false, type: 'warning' },
  { id: 3, text: 'Новый заказ SB-000002 создан менеджером', time: '2 часа назад', read: true, type: 'info' },
  { id: 4, text: 'Заказ SB-000003 зависел более 3 дней', time: 'Вчера', read: true, type: 'warning' },
]

export default function NotificationsPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold">Уведомления</h1>
        </div>
        <button className="text-sm text-blue-600 hover:underline">Отметить все прочитанными</button>
      </div>

      <div className="space-y-2">
        {MOCK_NOTIFICATIONS.map(n => (
          <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border transition ${!n.read ? 'bg-blue-50 border-blue-200' : 'bg-card'}`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-blue-600' : 'bg-slate-300'}`} />
            <div className="flex-1">
              <div className="text-sm font-medium">{n.text}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{n.time}</div>
            </div>
            {!n.read && (
              <button className="p-1 hover:bg-blue-100 rounded transition">
                <Check className="w-4 h-4 text-blue-600" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
