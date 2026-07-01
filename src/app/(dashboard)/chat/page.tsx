'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Send, Loader2, Globe, Lock, MessageCircle, AlertCircle, X, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import MessageBubble, { type Message } from '@/components/chat/MessageBubble'
import RoomList from '@/components/chat/RoomList'
import { useChatSounds } from '@/hooks/useChatSounds'

interface ChatRoom {
  _id: string
  slug: string
  name: string
  scope: 'global' | 'internal'
}

export default function ChatPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [activeRoom, setActiveRoom] = useState(() => searchParams.get('room') ?? 'general')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // false = chat panel visible (good for mobile — user sees messages + input immediately)
  const [showSidebar, setShowSidebar] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isPrivileged = session?.user?.role === 'owner' || session?.user?.role === 'admin'
  const { isMuted, toggleMute, playSend, playReceived } = useChatSounds()

  // Track seen message IDs to play sound only for genuinely new incoming messages
  const seenMsgIdsRef = useRef<Set<string>>(new Set())
  const isInitialLoadRef = useRef(true)

  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat', activeRoom],
    queryFn: async () => {
      const res = await fetch(`/api/chat?room=${activeRoom}`)
      const json = await res.json()
      return json.data as Message[]
    },
    staleTime: 0,
    refetchInterval: 5000,
  })

  // SSE for real-time updates
  useEffect(() => {
    const es = new EventSource(`/api/chat/stream?room=${activeRoom}`)
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as Message
        queryClient.setQueryData(['chat', activeRoom], (prev: Message[] = []) => {
          if (prev.some(m => m._id === msg._id)) return prev
          return [...prev, msg]
        })
      } catch { /* malformed SSE frame */ }
    }
    es.onerror = () => {}
    return () => es.close()
  }, [activeRoom, queryClient])

  // Mark messages as read when entering a room
  useEffect(() => {
    fetch('/api/chat/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: activeRoom }),
    }).catch(() => {})
  }, [activeRoom])

  const { data: rooms } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/chat/rooms')
      const json = await res.json()
      return json.data as ChatRoom[]
    },
    staleTime: 60000,
  })

  const currentRoom = rooms?.find(r => r.slug === activeRoom)

  const handleRoomSelect = useCallback((slug: string) => {
    setActiveRoom(slug)
    setText('')
    setReplyTo(null)
    setSendError(null)
    setShowSidebar(false)
    // Reset seen IDs for new room so initial load doesn't play sounds
    seenMsgIdsRef.current = new Set()
    isInitialLoadRef.current = true
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }, 100)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Play received sound when new messages from others arrive
  useEffect(() => {
    if (!messages || !session?.user?.id) return
    if (isInitialLoadRef.current) {
      messages.forEach(m => seenMsgIdsRef.current.add(m._id))
      isInitialLoadRef.current = false
      return
    }
    const hasNew = messages.some(
      m => !seenMsgIdsRef.current.has(m._id) && m.userId !== session.user!.id
    )
    messages.forEach(m => seenMsgIdsRef.current.add(m._id))
    if (hasNew) playReceived()
  }, [messages, session?.user?.id, playReceived])

  const handleReply = useCallback((msg: Message) => {
    setReplyTo(msg)
    inputRef.current?.focus()
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    const draft = text.trim()
    const currentReply = replyTo
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: draft,
          room: activeRoom,
          ...(currentReply ? {
            replyTo: {
              messageId: currentReply._id,
              userName: currentReply.userName,
              text: currentReply.text.slice(0, 500),
            }
          } : {}),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      const msg = json.data as Message
      queryClient.setQueryData(['chat', activeRoom], (prev: Message[] = []) => {
        if (prev.some(m => m._id === msg._id)) return prev
        return [...prev, msg]
      })
      setText('')
      setReplyTo(null)
      playSend()
      inputRef.current?.focus()
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  const msgs = messages ?? []

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar overlay on mobile */}
      <aside className={cn(
        'w-64 border-r flex-shrink-0 flex flex-col bg-background',
        'md:flex',
        showSidebar ? 'flex absolute inset-0 z-10 w-full md:relative md:w-64' : 'hidden'
      )}>
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">Чат</h2>
            <p className="text-xs text-muted-foreground">Комнаты и каналы</p>
          </div>
          <button
            onClick={() => setShowSidebar(false)}
            className="md:hidden p-1.5 hover:bg-accent rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <RoomList
            activeRoom={activeRoom}
            onSelect={handleRoomSelect}
            canCreate={isPrivileged}
          />
        </div>
      </aside>

      {/* Main chat panel */}
      <div className={cn('flex-1 flex flex-col min-w-0', showSidebar && 'hidden md:flex')}>
        {/* Header */}
        <div className="px-3 py-3 border-b flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSidebar(true)}
            className="p-1.5 hover:bg-accent rounded-lg shrink-0 md:hidden"
            title="Комнаты"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          {currentRoom?.scope === 'global'
            ? <Globe className="w-4 h-4 text-blue-500 shrink-0" />
            : <Lock className="w-4 h-4 text-emerald-500 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate">
              {currentRoom?.name ?? activeRoom}
            </h1>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              {currentRoom?.scope === 'global' ? 'Общий · виден всем' : 'Внутренний · только для команды'}
            </p>
          </div>
          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            className="p-1.5 hover:bg-accent rounded-lg transition"
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
            aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {isMuted
              ? <VolumeX className="w-4 h-4 text-muted-foreground/50" />
              : <Volume2 className="w-4 h-4 text-muted-foreground" />
            }
          </button>
          {/* Rooms button for desktop */}
          <button
            onClick={() => setShowSidebar(v => !v)}
            className="hidden md:flex p-1.5 hover:bg-accent rounded-lg"
            title="Показать комнаты"
          >
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : msgs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Сообщений пока нет. Напишите первым!</p>
            </div>
          ) : (
            msgs.map((msg, i) => (
              <MessageBubble
                key={msg._id}
                msg={msg}
                prevMsg={msgs[i - 1]}
                currentUserId={session?.user?.id ?? ''}
                onReply={handleReply}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Send error */}
        {sendError && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950 border-t border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {sendError}
          </div>
        )}

        {/* Reply preview bar */}
        {replyTo && (
          <div className="px-3 py-2 border-t bg-muted/40 flex items-center gap-2 shrink-0">
            <div className="flex-1 min-w-0 border-l-2 border-blue-500 pl-2">
              <div className="text-[11px] font-semibold text-blue-600 truncate">{replyTo.userName}</div>
              <div className="text-[11px] text-muted-foreground truncate">{replyTo.text}</div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="p-1 hover:bg-accent rounded transition shrink-0"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 border-t flex gap-2 shrink-0">
          <input
            ref={inputRef}
            value={text}
            onChange={e => { setText(e.target.value); setSendError(null) }}
            placeholder={replyTo ? `Ответить ${replyTo.userName}...` : 'Написать сообщение...'}
            className="flex-1 px-4 py-2.5 border rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center text-white transition shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
