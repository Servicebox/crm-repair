'use client'
import { Check, CheckCheck, Reply } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReplyInfo {
  messageId: string
  userName: string
  text: string
}

export interface Message {
  _id: string
  userId: string
  userName: string
  userAvatar?: string
  companyName?: string | null
  text: string
  scope?: 'global' | 'internal'
  createdAt: string
  replyTo?: ReplyInfo
  readBy?: string[]
}

interface Props {
  msg: Message
  prevMsg?: Message
  currentUserId: string
  compact?: boolean
  onReply?: (msg: Message) => void
}

function formatTime(iso: string, compact?: boolean): string {
  try {
    const d = new Date(iso)
    if (compact) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function MessageBubble({ msg, prevMsg, currentUserId, compact, onReply }: Props) {
  const isOwn = msg.userId === currentUserId
  const showName = !prevMsg || prevMsg.userId !== msg.userId

  const senderLabel = isOwn
    ? null
    : msg.companyName
      ? `${msg.userName} · ${msg.companyName}`
      : msg.userName

  const readByOthers = (msg.readBy ?? []).some(id => id !== currentUserId)
  const avatarSize = compact ? 'w-7 h-7' : 'w-8 h-8'
  const avatarText = compact ? 'text-[10px]' : 'text-xs'

  return (
    <div className={cn('flex gap-1.5 items-end group', isOwn && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'relative shrink-0 mt-0.5',
        avatarSize,
        !showName && !isOwn && 'invisible'
      )}>
        {/* Initials fallback */}
        <div className={cn(
          'w-full h-full rounded-full flex items-center justify-center font-semibold select-none',
          avatarText,
          isOwn
            ? 'bg-blue-600 text-white'
            : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
        )}>
          {getInitials(msg.userName)}
        </div>
        {/* Real photo overlay */}
        {msg.userAvatar && (
          <img
            src={msg.userAvatar}
            alt={msg.userName}
            className="absolute inset-0 w-full h-full rounded-full object-cover ring-1 ring-white/20 dark:ring-white/10"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
      </div>

      {/* Reply button */}
      {onReply && (
        <button
          onClick={() => onReply(msg)}
          title="Ответить"
          className="p-1.5 rounded-full transition-all shrink-0 self-center mb-4 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-accent active:opacity-100"
        >
          <Reply className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}

      <div className={cn('max-w-[72%]', isOwn && 'items-end flex flex-col')}>
        {/* Sender label */}
        {showName && senderLabel && (
          <div className="text-[10px] font-medium text-muted-foreground mb-0.5 leading-tight ml-1">
            {senderLabel}
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          'rounded-2xl text-sm leading-snug break-words',
          compact ? 'px-2.5 py-1.5' : 'px-3.5 py-2',
          isOwn
            ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-tr-sm shadow-md shadow-blue-600/20'
            : 'bg-slate-100 dark:bg-slate-700/80 rounded-tl-sm'
        )}>
          {/* Reply preview */}
          {msg.replyTo && (
            <div className={cn(
              'mb-2 px-2 py-1 rounded-lg text-[11px] border-l-2 cursor-pointer',
              isOwn
                ? 'border-white/50 bg-white/10 text-white/80'
                : 'border-blue-400 bg-background/50 text-muted-foreground'
            )}>
              <div className="font-semibold truncate">{msg.replyTo.userName}</div>
              <div className="truncate opacity-80">{msg.replyTo.text}</div>
            </div>
          )}
          {msg.text}
        </div>

        {/* Timestamp + read */}
        <div className={cn('flex items-center gap-0.5 mt-0.5', isOwn && 'flex-row-reverse')}>
          <span className="text-[9px] text-muted-foreground">
            {formatTime(msg.createdAt, compact)}
          </span>
          {isOwn && (
            readByOthers
              ? <CheckCheck className="w-3 h-3 text-blue-500 ml-0.5" />
              : <Check className="w-3 h-3 text-muted-foreground/50 ml-0.5" />
          )}
        </div>
      </div>
    </div>
  )
}
