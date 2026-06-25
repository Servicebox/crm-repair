import { cn } from '@/lib/utils'

interface Message {
  _id: string
  userId: string
  userName: string
  companyName?: string | null
  text: string
  scope?: 'global' | 'internal'
  createdAt: string
}

interface Props {
  msg: Message
  prevMsg?: Message
  currentUserId: string
  compact?: boolean
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

export default function MessageBubble({ msg, prevMsg, currentUserId, compact }: Props) {
  const isOwn = msg.userId === currentUserId
  // Show name/avatar when first message or sender changes
  const showName = !prevMsg || prevMsg.userId !== msg.userId

  // Label shown above bubble: for others show "Name · Org", for own show "Вы"
  const senderLabel = isOwn
    ? null
    : msg.companyName
      ? `${msg.userName} · ${msg.companyName}`
      : msg.userName

  return (
    <div className={cn('flex gap-1.5', isOwn && 'flex-row-reverse')}>
      {/* Avatar — only for other users */}
      {!isOwn && (
        <div className={cn(
          'rounded-full flex items-center justify-center font-semibold shrink-0 mt-0.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300',
          compact ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs',
          !showName && 'opacity-0 pointer-events-none'
        )}>
          {getInitials(msg.userName)}
        </div>
      )}

      <div className={cn('max-w-[72%]', isOwn && 'items-end flex flex-col')}>
        {/* Sender label */}
        {showName && senderLabel && (
          <div className="text-[10px] font-medium text-muted-foreground mb-0.5 leading-tight">
            {senderLabel}
          </div>
        )}

        {/* Message bubble */}
        <div className={cn(
          'rounded-2xl text-sm leading-snug break-words',
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
          isOwn
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-muted dark:bg-muted/60 rounded-tl-sm'
        )}>
          {msg.text}
        </div>

        {/* Timestamp */}
        <div className="text-[9px] text-muted-foreground mt-0.5">
          {formatTime(msg.createdAt, compact)}
        </div>
      </div>
    </div>
  )
}
