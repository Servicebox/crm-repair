'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Send, MessageCircle, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Message {
  _id: string
  userId: string
  userName: string
  text: string
  createdAt: string
}

export default function ChatPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: messages, isLoading } = useQuery({
    queryKey: ['chat', 'general'],
    queryFn: async () => {
      const res = await fetch('/api/chat?room=general')
      const json = await res.json()
      return json.data as Message[]
    },
    refetchInterval: 5000,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    inputRef.current?.focus()
  }

  const msgs = messages ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-blue-600" />
        <div>
          <h1 className="font-semibold">Общий чат</h1>
          <p className="text-xs text-muted-foreground">Внутренний чат команды</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">онлайн</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : msgs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Сообщений пока нет. Напишите первым!</p>
          </div>
        ) : (
          msgs.map((msg, i) => {
            const isOwn = msg.userId === session?.user?.id
            const showAvatar = i === 0 || msgs[i - 1].userId !== msg.userId

            return (
              <div key={msg._id} className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
                {!isOwn && (
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0', showAvatar ? 'bg-blue-100 text-blue-600' : 'opacity-0')}>
                    {msg.userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={cn('max-w-[70%]', isOwn && 'items-end flex flex-col')}>
                  {showAvatar && !isOwn && (
                    <div className="text-xs font-medium text-muted-foreground mb-1">{msg.userName}</div>
                  )}
                  <div className={cn(
                    'px-3 py-2 rounded-2xl text-sm',
                    isOwn
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-muted rounded-tl-sm'
                  )}>
                    {msg.text}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(msg.createdAt)}</div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Написать сообщение..."
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
  )
}
