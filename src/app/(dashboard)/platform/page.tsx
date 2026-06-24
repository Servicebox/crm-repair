'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Users, Globe, RefreshCw, Loader2, Terminal, CheckCircle, XCircle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrgRecord {
  _id: string
  name: string
  slug: string
  dbName: string
  isActive: boolean
  userCount: number
  createdAt: string
  updatedAt: string
}

export default function PlatformPage() {
  const [tab, setTab] = useState<'orgs' | 'logs'>('orgs')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logs, setLogs] = useState<string | null>(null)
  const [logsError, setLogsError] = useState('')

  const { data: orgs = [], isLoading, refetch, isFetching } = useQuery<OrgRecord[]>({
    queryKey: ['platform-orgs'],
    queryFn: async () => {
      const res = await fetch('/api/platform/orgs')
      if (!res.ok) throw new Error('Forbidden')
      const json = await res.json()
      return json.data ?? []
    },
    retry: false,
  })

  async function fetchLogs() {
    setLogsLoading(true)
    setLogsError('')
    try {
      const res = await fetch('/api/platform/logs')
      const json = await res.json()
      if (!res.ok) { setLogsError(json.error ?? 'Ошибка'); return }
      setLogs(json.data)
    } catch {
      setLogsError('Ошибка сети')
    } finally {
      setLogsLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-500" />
            Панель управления платформой
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Управление всеми организациями и мониторинг сервера</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 border hover:bg-accent px-3 py-2 rounded-lg text-sm transition"
        >
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          Обновить
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg"><Building2 className="w-5 h-5 text-purple-600" /></div>
          <div>
            <div className="text-2xl font-bold">{orgs.length}</div>
            <div className="text-xs text-muted-foreground">Организаций</div>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div>
          <div>
            <div className="text-2xl font-bold">{orgs.reduce((s, o) => s + o.userCount, 0)}</div>
            <div className="text-xs text-muted-foreground">Пользователей</div>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
          <div>
            <div className="text-2xl font-bold">{orgs.filter(o => o.isActive).length}</div>
            <div className="text-xs text-muted-foreground">Активных</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-5 w-fit">
        {(['orgs', 'logs'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === 'logs' && !logs) fetchLogs() }}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition',
              tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'orgs' ? 'Организации' : 'Логи сервера'}
          </button>
        ))}
      </div>

      {tab === 'orgs' && (
        <div>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>
          ) : orgs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Организации не найдены</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orgs.map(org => (
                <div key={org._id} className="bg-card border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0',
                        org.isActive ? 'bg-purple-600' : 'bg-gray-400'
                      )}>
                        {org.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{org.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{org.slug}</span>
                          <span className="text-xs">БД: {org.dbName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {org.isActive ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />Активна
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                          <XCircle className="w-3 h-3" />Неактивна
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{org.userCount} пользователей</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Создана: {new Date(org.createdAt).toLocaleDateString('ru-RU')}</span>
                    <span className="flex items-center gap-1.5 font-mono text-xs">ID: {org._id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">PM2 / системные логи</span>
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              className="ml-auto flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg hover:bg-accent transition"
            >
              <RefreshCw className={cn('w-3 h-3', logsLoading && 'animate-spin')} />
              Обновить логи
            </button>
          </div>
          {logsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : logsError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{logsError}</div>
          ) : logs ? (
            <pre className="bg-gray-950 text-green-400 p-4 rounded-xl text-xs font-mono overflow-auto max-h-[60vh] leading-relaxed whitespace-pre-wrap">
              {logs}
            </pre>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Нажмите «Обновить логи» для загрузки</div>
          )}
        </div>
      )}
    </div>
  )
}
