'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X, Send, Loader2, ChevronDown, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import MessageBubble from '@/components/chat/MessageBubble'

interface Message {
  _id: string
  userId: string
  userName: string
  companyName?: string | null
  text: string
  createdAt: string
}

// FloatingChat uses the INTERNAL room — exclusive to org employees
const ROOM = 'internal'

export default function FloatingChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [lastSeenCount, setLastSeenCount] = useState(0)
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // All hooks must be called before any conditional return
  const isOnChatPage = pathname === '/chat'

  const { data: messages } = useQuery({
    queryKey: ['chat', ROOM],
    queryFn: async () => {
      const res = await fetch(`/api/chat?room=${ROOM}`)
      const json = await res.json()
      return json.data as Message[]
    },
    staleTime: 0,
    enabled: !isOnChatPage,
    // Polling fallback — guarantees delivery even if SSE fails
    refetchInterval: isOnChatPage ? false : 5000,
  })

  // SSE subscription — disabled on /chat page to avoid duplicate connections
  useEffect(() => {
    if (isOnChatPage) return
    const es = new EventSource(`/api/chat/stream?room=${ROOM}`)
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as Message
        queryClient.setQueryData(['chat', ROOM], (prev: Message[] = []) => {
          if (prev.some(m => m._id === msg._id)) return prev
          return [...prev, msg]
        })
      } catch { /* malformed SSE frame */ }
    }
    es.onerror = () => { /* browser auto-reconnects with Last-Event-ID */ }
    return () => es.close()
  }, [isOnChatPage, queryClient])

  useEffect(() => {
    if (!messages) return
    if (open) {
      setLastSeenCount(messages.length)
      setUnread(0)
    } else {
      setUnread(Math.max(0, messages.length - lastSeenCount))
    }
  }, [messages, open, lastSeenCount])

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }, 100)
    setUnread(0)
    setLastSeenCount(messages?.length ?? 0)
    return () => clearTimeout(id)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render on the full /chat page
  if (isOnChatPage) return null

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    const draft = text.trim()
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft, room: ROOM }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      const msg = json.data as Message
      queryClient.setQueryData(['chat', ROOM], (prev: Message[] = []) => {
        if (prev.some(m => m._id === msg._id)) return prev
        return [...prev, msg]
      })
      setText('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  const msgs = messages ?? []

  return (
    <>
      {/* Chat window — rendered separately from button to avoid layout issues on small screens */}
      {open && (
        <div className={cn(
          'fixed z-50 right-4 bg-white dark:bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden',
          'animate-in slide-in-from-bottom-4 duration-200',
          // Responsive height: takes 80% of viewport on small screens, fixed on large
          'w-[calc(100vw-32px)] sm:w-80',
          'bottom-[76px]',
          'max-h-[calc(100svh-110px)]',
        )}>
          {/* Header */}
          <div className="px-4 py-3 bg-blue-600 text-white flex items-center gap-2 shrink-0">
            <MessageCircle className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Внутренний чат</div>
              <div className="text-xs text-blue-200">Только для команды</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-blue-700 rounded-lg transition"
              aria-label="Свернуть чат"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 overscroll-contain">
            {msgs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                Сообщений пока нет
              </div>
            ) : (
              msgs.map((msg, i) => (
                <MessageBubble
                  key={msg._id}
                  msg={msg}
                  prevMsg={msgs[i - 1]}
                  currentUserId={session?.user?.id ?? ''}
                  compact
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error */}
          {sendError && (
            <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950 border-t border-red-200 dark:border-red-800 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 shrink-0">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {sendError}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSend} className="p-2.5 border-t flex gap-1.5 shrink-0">
            <input
              ref={inputRef}
              value={text}
              onChange={e => { setText(e.target.value); setSendError(null) }}
              placeholder="Сообщение команде..."
              className="flex-1 px-3 py-2 text-sm border rounded-full outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center text-white transition shrink-0"
              aria-label="Отправить"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      )}

      {/* Toggle button — always at fixed position, separate from window */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg',
          'flex items-center justify-center transition-all duration-200 print:hidden',
          open ? 'bg-blue-700 scale-95' : 'bg-blue-600 hover:bg-blue-700 hover:scale-110'
        )}
        aria-label={open ? 'Закрыть чат' : 'Открыть чат'}
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-white" />
            {unread > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
        )}
      </button>
    </>
  )
}
