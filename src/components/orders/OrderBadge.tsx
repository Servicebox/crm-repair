import { cn } from '@/lib/utils'
import { ORDER_STATUSES, PRIORITY_CONFIG } from '@/constants/orders'

export function StatusBadge({ status }: { status: string }) {
  const cfg = ORDER_STATUSES.find(s => s.value === status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        cfg?.color ?? 'bg-slate-100 text-slate-600 border-slate-200'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg?.dot ?? 'bg-slate-400')} />
      {cfg?.label ?? status}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG]
  return (
    <span className={cn('text-xs font-medium', cfg?.color ?? 'text-slate-500')}>
      {cfg?.label ?? priority}
    </span>
  )
}
