'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Lock, Plus, Loader2, X, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatRoom {
  _id: string
  slug: string
  name: string
  scope: 'global' | 'internal'
  lastMessage?: { text: string; userName: string; createdAt: string } | null
}

interface Props {
  activeRoom: string
  onSelect: (slug: string) => void
  canCreate?: boolean
}

export default function RoomList({ activeRoom, onSelect, canCreate }: Props) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScope, setNewScope] = useState<'global' | 'internal'>('internal')

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/chat/rooms')
      const json = await res.json()
      return json.data as ChatRoom[]
    },
    refetchInterval: 15000,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), scope: newScope }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      return json.data as ChatRoom
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] })
      setShowCreate(false)
      setNewName('')
      onSelect(room.slug)
    },
  })

  const globalRooms = (rooms ?? []).filter(r => r.scope === 'global')
  const internalRooms = (rooms ?? []).filter(r => r.scope === 'internal')

  function RoomItem({ room }: { room: ChatRoom }) {
    const isActive = room.slug === activeRoom
    return (
      <button
        onClick={() => onSelect(room.slug)}
        className={cn(
          'w-full text-left px-3 py-2.5 rounded-xl transition-colors',
          isActive
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'hover:bg-muted/60 text-foreground'
        )}
      >
        <div className="flex items-center gap-2">
          {room.scope === 'global'
            ? <Globe className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            : <Lock className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
          }
          <span className="text-sm font-medium truncate">{room.name}</span>
        </div>
        {room.lastMessage && (
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate pl-5">
            {room.lastMessage.userName}: {room.lastMessage.text}
          </div>
        )}
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center pt-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {/* Global section */}
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
        Общие
      </div>
      {globalRooms.map(r => <RoomItem key={r._id} room={r} />)}

      {/* Internal section */}
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2 flex items-center justify-between">
        <span>Внутренние</span>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="p-0.5 hover:bg-accent rounded transition"
            title="Создать канал"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
      {internalRooms.map(r => <RoomItem key={r._id} room={r} />)}

      {internalRooms.length === 0 && !showCreate && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Нет внутренних каналов
        </div>
      )}

      {/* Create room form */}
      {showCreate && (
        <div className="mt-2 p-2.5 border rounded-xl bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Новый канал</span>
            <button onClick={() => setShowCreate(false)} className="p-0.5 hover:bg-accent rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Название канала"
            className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            maxLength={60}
          />
          <div className="flex gap-1.5">
            {(['global', 'internal'] as const).map(s => (
              <button
                key={s}
                onClick={() => setNewScope(s)}
                className={cn(
                  'flex-1 text-xs py-1 rounded-lg border transition',
                  newScope === s ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-accent'
                )}
              >
                {s === 'global' ? '🌐 Общий' : '🔒 Внутренний'}
              </button>
            ))}
          </div>
          <button
            disabled={!newName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs rounded-lg font-medium transition flex items-center justify-center gap-1.5"
          >
            {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Создать
          </button>
          {createMutation.isError && (
            <p className="text-xs text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {(rooms ?? []).length === 0 && (
        <div className="text-center py-8">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-xs text-muted-foreground">Нет чат-комнат</p>
        </div>
      )}
    </div>
  )
}
