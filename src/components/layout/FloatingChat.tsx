'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { MessageCircle, X, Send, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  _id: string
  userId: string
  userName: string
  text: string
  createdAt: string
}

export default function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(0)
  const [lastSeenCount, setLastSeenCount] = useState(0)
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: messages } = useQuery({
    queryKey: ['chat', 'general'],
    queryFn: async () => {
      const res = await fetch('/api/chat?room=general')
      const json = await res.json()
      return json.data as Message[]
    },
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (!messages) return
    if (open) {
      setLastSeenCount(messages.length)
      setUnread(0)
    } else {
      const newMessages = messages.length - lastSeenCount
      setUnread(Math.max(0, newMessages))
    }
  }, [messages, open])

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        inputRef.current?.focus()
      }, 100)
      setUnread(0)
      setLastSeenCount(messages?.length ?? 0)
    }
  }, [open])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), room: 'general' }),
    })
    setText('')
    queryClient.invalidateQueries({ queryKey: ['chat', 'general'] })
    setSending(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const msgs = messages ?? []

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div className="w-80 h-[420px] bg-white border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-blue-600 text-white flex items-center gap-2 shrink-0">
            <MessageCircle className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Общий чат</div>
              <div className="text-xs text-blue-200">Команда сервиса</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-blue-700 rounded-lg transition"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {msgs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                Сообщений пока нет
              </div>
            ) : (
              msgs.map((msg, i) => {
                const isOwn = msg.userId === session?.user?.id
                const showName = i === 0 || msgs[i - 1].userId !== msg.userId

                return (
                  <div key={msg._id} className={cn('flex gap-1.5', isOwn && 'flex-row-reverse')}>
                    {!isOwn && (
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5', showName ? 'bg-blue-100 text-blue-600' : 'opacity-0')}>
                        {msg.userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={cn('max-w-[75%]', isOwn && 'items-end flex flex-col')}>
                      {showName && !isOwn && (
                        <div className="text-[10px] font-medium text-muted-foreground mb-0.5">{msg.userName}</div>
                      )}
                      <div className={cn(
                        'px-2.5 py-1.5 rounded-2xl text-sm leading-snug',
                        isOwn ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-muted rounded-tl-sm'
                      )}>
                        {msg.text}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{formatTime(msg.createdAt)}</div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-2.5 border-t flex gap-1.5 shrink-0">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Сообщение..."
              className="flex-1 px-3 py-2 text-sm border rounded-full outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center text-white transition shrink-0"
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
          open ? 'bg-blue-700 scale-95' : 'bg-blue-600 hover:bg-blue-700 hover:scale-110'
        )}
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-white" />
            {unread > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
        )}
      </button>
    </div>
  )
}
