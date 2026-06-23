'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Search, Filter, RefreshCw, User, ClipboardList, Settings, DollarSign, Package } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  order: ClipboardList,
  client: User,
  settings: Settings,
  finance: DollarSign,
  warehouse: Package,
}

const ACTION_COLORS: Record<string, string> = {
  create: 'text-green-600 bg-green-50 border-green-200',
  update: 'text-blue-600 bg-blue-50 border-blue-200',
  delete: 'text-red-600 bg-red-50 border-red-200',
  login: 'text-purple-600 bg-purple-50 border-purple-200',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  login: 'Вход',
  status_change: 'Смена статуса',
  payment: 'Платёж',
}

const DEMO_LOGS = Array.from({ length: 40 }, (_, i) => {
  const types = ['order', 'client', 'settings', 'finance', 'warehouse']
  const actions = ['create', 'update', 'delete', 'status_change', 'payment']
  const users = ['Иван Петров', 'Мария Иванова', 'Алексей Сидоров']
  const descs = [
    'Создан заказ SB-000234 — iPhone 14 Pro Max, не включается',
    'Изменён статус заказа SB-000231 → Готов',
    'Добавлен клиент Петров Сергей Александрович',
    'Выдан заказ SB-000228, оплата 8 500 ₽',
    'Обновлены настройки компании',
    'Принята предоплата 2 000 ₽ по заказу SB-000235',
    'Добавлена запчасть: Дисплей iPhone 13, 5 шт.',
    'Удалён сотрудник',
    'Создан заказ SB-000236 — Samsung Galaxy S23, разбит экран',
    'Изменён статус заказа SB-000229 → В работе',
  ]
  const t = types[i % types.length]
  const a = actions[i % actions.length]
  const d = new Date(Date.now() - i * 1000 * 60 * 23)
  return {
    _id: String(i),
    type: t,
    action: a,
    description: descs[i % descs.length],
    user: users[i % users.length],
    createdAt: d.toISOString(),
    ip: `192.168.1.${(i % 50) + 10}`,
  }
})

export default function JournalPage() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 15

  const filtered = DEMO_LOGS.filter(l => {
    const matchSearch = !search || l.description.toLowerCase().includes(search.toLowerCase()) || l.user.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || l.type === filterType
    const matchAction = !filterAction || l.action === filterAction
    return matchSearch && matchType && matchAction
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const logs = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Журнал событий
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">История всех действий в системе</p>
        </div>
        <button className="flex items-center gap-2 text-sm border px-3 py-2 rounded-lg hover:bg-accent transition">
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-48 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Поиск по описанию или пользователю..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1) }}
          className="px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Все разделы</option>
          <option value="order">Заказы</option>
          <option value="client">Клиенты</option>
          <option value="finance">Финансы</option>
          <option value="warehouse">Склад</option>
          <option value="settings">Настройки</option>
        </select>
        <select
          value={filterAction}
          onChange={e => { setFilterAction(e.target.value); setPage(1) }}
          className="px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Все действия</option>
          <option value="create">Создание</option>
          <option value="update">Изменение</option>
          <option value="delete">Удаление</option>
          <option value="status_change">Смена статуса</option>
          <option value="payment">Платёж</option>
        </select>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Заказы', count: DEMO_LOGS.filter(l => l.type === 'order').length, color: 'blue' },
          { label: 'Клиенты', count: DEMO_LOGS.filter(l => l.type === 'client').length, color: 'green' },
          { label: 'Финансы', count: DEMO_LOGS.filter(l => l.type === 'finance').length, color: 'amber' },
          { label: 'Склад', count: DEMO_LOGS.filter(l => l.type === 'warehouse').length, color: 'purple' },
          { label: 'Настройки', count: DEMO_LOGS.filter(l => l.type === 'settings').length, color: 'slate' },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold">{s.count}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Время</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Действие</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Описание</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Пользователь</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map(log => {
                const Icon = ACTION_ICONS[log.type] ?? FileText
                const color = ACTION_COLORS[log.action] ?? 'text-slate-600 bg-slate-50 border-slate-200'
                return (
                  <tr key={log._id} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), 'dd.MM HH:mm', { locale: ru })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${color}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">{log.description}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{log.user}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.ip}</td>
                  </tr>
                )
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    Записи не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
            <span>Всего записей: {filtered.length}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded hover:bg-accent disabled:opacity-40 transition"
              >
                ←
              </button>
              <span className="px-3 py-1">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded hover:bg-accent disabled:opacity-40 transition"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
