'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  Clock, Play, Square, Loader2, Calendar, User, Timer, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface Employee {
  _id: string
  name: string
  email: string
  role: string
  isActive: boolean
  salary?: { type: string; value: number; hourlyRate?: number }
}

interface Shift {
  _id: string
  userId: { _id: string; name: string; email: string } | string
  openedBy: { _id: string; name: string } | string
  openedAt: string
  closedAt?: string
  durationMinutes?: number
  status: 'open' | 'closed'
  notes?: string
}

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} мин`
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

function elapsedMinutes(openedAt: string): number {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ShiftsPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const isPrivileged = session?.user?.role === 'owner' || session?.user?.role === 'admin'

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      const json = await res.json()
      return (json.data as Employee[]).filter(e => e.isActive)
    },
    enabled: isPrivileged,
  })

  const { data: allShifts, isLoading } = useQuery({
    queryKey: ['shifts', month],
    queryFn: async () => {
      const res = await fetch(`/api/shifts?month=${month}`)
      const json = await res.json()
      return json.data as Shift[]
    },
    refetchInterval: 30000,
  })

  const openMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      return json.data as Shift
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })

  const closeMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const res = await fetch(`/api/shifts/${shiftId}/close`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      return json.data as Shift
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })

  const openShifts = (allShifts ?? []).filter(s => s.status === 'open')
  const closedShifts = (allShifts ?? []).filter(s => s.status === 'closed')

  const openShiftByUserId = new Map<string, Shift>()
  for (const s of openShifts) {
    const uid = typeof s.userId === 'string' ? s.userId : s.userId?._id
    if (!uid) continue
    openShiftByUserId.set(uid, s)
  }

  const shiftsByUserId = new Map<string, Shift[]>()
  for (const s of closedShifts) {
    const uid = typeof s.userId === 'string' ? s.userId : s.userId?._id
    if (!uid) continue
    if (!shiftsByUserId.has(uid)) shiftsByUserId.set(uid, [])
    shiftsByUserId.get(uid)!.push(s)
  }

  const totalHoursByUser = new Map<string, number>()
  for (const [uid, shifts] of shiftsByUserId) {
    const minutes = shifts.reduce((s, sh) => s + (sh.durationMinutes ?? 0), 0)
    totalHoursByUser.set(uid, Math.round((minutes / 60) * 100) / 100)
  }

  if (!isPrivileged) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Доступ только для администраторов.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Управление сменами</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {openShifts.length > 0
              ? `${openShifts.length} открытых смен`
              : 'Нет открытых смен'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {(employees ?? []).map(emp => {
            const openShift = openShiftByUserId.get(emp._id)
            const history = shiftsByUserId.get(emp._id) ?? []
            const totalHours = totalHoursByUser.get(emp._id) ?? 0
            const isExpanded = expandedUser === emp._id
            const isOpening = openMutation.isPending && openMutation.variables === emp._id
            const closingId = openShift ? openShift._id : null
            const isClosing = closeMutation.isPending && closeMutation.variables === closingId

            return (
              <div key={emp._id} className="border rounded-xl bg-card overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm shrink-0">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{emp.name}</span>
                      {openShift && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          В смене · {durationLabel(elapsedMinutes(openShift.openedAt))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        {totalHours} ч за период
                      </span>
                      {history.length > 0 && (
                        <span>{history.length} смен закрыто</span>
                      )}
                      {emp.salary?.type === 'hourly' && (
                        <span className="text-blue-600">
                          {formatCurrency(emp.salary.hourlyRate ?? emp.salary.value)}/ч
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {openShift ? (
                      <button
                        onClick={() => closeMutation.mutate(openShift._id)}
                        disabled={isClosing}
                        className="flex items-center gap-1.5 text-sm bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-60 px-3 py-1.5 rounded-lg font-medium transition"
                      >
                        {isClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                        Закрыть смену
                      </button>
                    ) : (
                      <button
                        onClick={() => openMutation.mutate(emp._id)}
                        disabled={isOpening}
                        className="flex items-center gap-1.5 text-sm bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-60 px-3 py-1.5 rounded-lg font-medium transition"
                      >
                        {isOpening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Открыть смену
                      </button>
                    )}
                    {history.length > 0 && (
                      <button
                        onClick={() => setExpandedUser(isExpanded ? null : emp._id)}
                        className="p-1.5 hover:bg-accent rounded-lg transition text-muted-foreground"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && history.length > 0 && (
                  <div className="border-t bg-muted/30">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b">
                          <th className="px-4 py-2 font-medium">Начало</th>
                          <th className="px-4 py-2 font-medium">Конец</th>
                          <th className="px-4 py-2 font-medium">Длительность</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {history.map(s => (
                          <tr key={s._id} className="hover:bg-muted/50">
                            <td className="px-4 py-2">
                              {new Date(s.openedAt).toLocaleString('ru-RU', {
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                              })}
                            </td>
                            <td className="px-4 py-2">
                              {s.closedAt ? new Date(s.closedAt).toLocaleString('ru-RU', {
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                              }) : '—'}
                            </td>
                            <td className="px-4 py-2 font-medium">
                              {s.durationMinutes !== undefined ? durationLabel(s.durationMinutes) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {(employees ?? []).length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Нет активных сотрудников</p>
            </div>
          )}
        </div>
      )}

      {(openMutation.isError || closeMutation.isError) && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm shadow-lg">
          {((openMutation.error || closeMutation.error) as Error)?.message}
        </div>
      )}
    </div>
  )
}
