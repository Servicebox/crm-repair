'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X, Send, Loader2, ChevronDown, AlertCircle, Reply, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import MessageBubble, { type Message } from '@/components/chat/MessageBubble'
import { useChatSounds } from '@/hooks/useChatSounds'
import { useNotifications } from '@/hooks/useNotifications'

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
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track seen message IDs to detect incoming messages for sound
  const seenMsgIdsRef = useRef<Set<string>>(new Set())
  const isInitialLoadRef = useRef(true)

  const { isMuted, toggleMute, playSend, playReceived } = useChatSounds()
  const { showNotification } = useNotifications()

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

  // Play sound + show OS notification when new messages from others arrive (SSE or polling)
  useEffect(() => {
    if (!messages || !session?.user?.id) return
    if (isInitialLoadRef.current) {
      messages.forEach(m => seenMsgIdsRef.current.add(m._id))
      isInitialLoadRef.current = false
      return
    }
    const newMsgs = messages.filter(
      m => !seenMsgIdsRef.current.has(m._id) && m.userId !== session.user!.id
    )
    messages.forEach(m => seenMsgIdsRef.current.add(m._id))
    if (newMsgs.length > 0) {
      playReceived()
      if (!isMuted) {
        const last = newMsgs[newMsgs.length - 1]
        showNotification(
          `${last.userName} — Внутренний чат`,
          last.text.slice(0, 120),
          'chat-internal',
        )
      }
    }
  }, [messages, session?.user?.id, playReceived, isMuted, showNotification])

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

  const handleReply = (msg: Message) => {
    setReplyTo(msg)
    inputRef.current?.focus()
  }

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
          room: ROOM,
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
      queryClient.setQueryData(['chat', ROOM], (prev: Message[] = []) => {
        if (prev.some(m => m._id === msg._id)) return prev
        return [...prev, msg]
      })
      setText('')
      setReplyTo(null)
      playSend()
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
          'fixed z-50 right-4 flex flex-col overflow-hidden',
          'animate-in slide-in-from-bottom-4 duration-200',
          'w-[calc(100vw-32px)] sm:w-80',
          'bottom-[76px]',
          'max-h-[calc(100svh-110px)]',
          'rounded-2xl border border-white/10 shadow-2xl shadow-black/40',
          'bg-slate-900/95 backdrop-blur-xl',
        )}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2 shrink-0 border-b border-white/10 bg-gradient-to-r from-blue-600/20 to-slate-800/20">
            <div className="w-7 h-7 rounded-full bg-blue-500/30 border border-blue-400/40 flex items-center justify-center shrink-0">
              <MessageCircle className="w-3.5 h-3.5 text-blue-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-white">Внутренний чат</div>
              <div className="text-[10px] text-slate-400">Только для команды</div>
            </div>
            <button
              onClick={toggleMute}
              className="p-1.5 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
              aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
              title={isMuted ? 'Включить звук' : 'Выключить звук'}
            >
              {isMuted
                ? <VolumeX className="w-3.5 h-3.5" />
                : <Volume2 className="w-3.5 h-3.5" />
              }
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
              aria-label="Свернуть чат"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 overscroll-contain scrollbar-thin">
            {msgs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
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
                  onReply={handleReply}
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error */}
          {sendError && (
            <div className="px-3 py-1.5 bg-red-950/60 border-t border-red-800/50 flex items-center gap-1.5 text-xs text-red-400 shrink-0">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {sendError}
            </div>
          )}

          {/* Reply preview bar */}
          {replyTo && (
            <div className="px-3 py-2 border-t border-white/10 bg-white/5 flex items-center gap-2 shrink-0">
              <Reply className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0 border-l-2 border-blue-500 pl-2">
                <div className="text-[11px] font-semibold text-blue-400 truncate">{replyTo.userName}</div>
                <div className="text-[11px] text-slate-400 truncate">{replyTo.text}</div>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="p-1 hover:bg-white/10 rounded transition shrink-0"
                aria-label="Отменить ответ"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSend} className="p-2.5 border-t border-white/10 flex gap-1.5 shrink-0 bg-slate-950/30">
            <input
              ref={inputRef}
              value={text}
              onChange={e => { setText(e.target.value); setSendError(null) }}
              placeholder={replyTo ? `Ответить ${replyTo.userName}...` : 'Написать команде...'}
              className="flex-1 px-3 py-2 text-sm rounded-full outline-none bg-white/8 border border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 disabled:opacity-40 flex items-center justify-center text-white transition shadow-lg shadow-blue-600/30 shrink-0"
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
