'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Search, RefreshCw, User, ClipboardList, Settings, DollarSign, Package } from 'lucide-react'
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
  status_change: 'text-amber-600 bg-amber-50 border-amber-200',
  payment: 'text-teal-600 bg-teal-50 border-teal-200',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  login: 'Вход',
  status_change: 'Смена статуса',
  payment: 'Платёж',
}

interface LogEntry {
  _id: string
  type: string
  action: string
  description: string
  userName: string
  createdAt: string
  ip?: string
}

interface JournalData {
  logs: LogEntry[]
  total: number
  page: number
  limit: number
  pages: number
}

export default function JournalPage() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams()
  params.set('page', String(page))
  if (search) params.set('search', search)
  if (filterType) params.set('type', filterType)
  if (filterAction) params.set('action', filterAction)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['journal', page, search, filterType, filterAction],
    queryFn: async () => {
      const res = await fetch(`/api/journal?${params.toString()}`)
      const json = await res.json() as { success: boolean; data: JournalData }
      return json.data
    },
  })

  const logs = data?.logs ?? []
  const totalPages = data?.pages ?? 1
  const total = data?.total ?? 0

  function handleSearchChange(val: string) {
    setSearch(val)
    setPage(1)
  }

  function handleTypeChange(val: string) {
    setFilterType(val)
    setPage(1)
  }

  function handleActionChange(val: string) {
    setFilterAction(val)
    setPage(1)
  }

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
        <button onClick={() => void refetch()} className="flex items-center gap-2 text-sm border px-3 py-2 rounded-lg hover:bg-accent transition">
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-48 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Поиск по описанию или пользователю..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterType}
          onChange={e => handleTypeChange(e.target.value)}
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
          onChange={e => handleActionChange(e.target.value)}
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

      <div className="bg-card border rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-2 border-b text-xs text-muted-foreground">
          Найдено записей: {total}
        </div>
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
              {isLoading && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">Загрузка...</td>
                </tr>
              )}
              {!isLoading && logs.map(log => {
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
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{log.userName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.ip ?? '—'}</td>
                  </tr>
                )
              })}
              {!isLoading && logs.length === 0 && (
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
            <span>Всего записей: {total}</span>
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
