import { cn } from '@/lib/utils'

interface Message {
  _id: string
  userId: string
  userName: string
  text: string
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

export default function MessageBubble({ msg, prevMsg, currentUserId, compact }: Props) {
  const isOwn = msg.userId === currentUserId
  const showName = !prevMsg || prevMsg.userId !== msg.userId

  return (
    <div className={cn('flex gap-1.5', isOwn && 'flex-row-reverse')}>
      {!isOwn && (
        <div className={cn(
          'rounded-full flex items-center justify-center font-semibold shrink-0 mt-0.5 bg-blue-100 text-blue-600',
          compact ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm',
          !showName && 'opacity-0'
        )}>
          {msg.userName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className={cn('max-w-[72%]', isOwn && 'items-end flex flex-col')}>
        {showName && !isOwn && (
          <div className="text-[10px] font-medium text-muted-foreground mb-0.5">{msg.userName}</div>
        )}
        <div className={cn(
          'rounded-2xl text-sm leading-snug',
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
          isOwn ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-muted rounded-tl-sm'
        )}>
          {msg.text}
        </div>
        <div className="text-[9px] text-muted-foreground mt-0.5">
          {formatTime(msg.createdAt, compact)}
        </div>
      </div>
    </div>
  )
}
