'use client'

import { useEffect, useRef, useState } from 'react'

interface ProgressState {
  status: string
  processed: number
  total: number
  successful: number
  failed: number
  duplicates_skipped: number
  percent: number
}

interface ImportProgressProps {
  jobId: string
  onComplete?: (state: ProgressState) => void
}

const STATUS_LABELS: Record<string, string> = {
  importing: 'Импортируется…',
  completed: 'Завершён',
  failed: 'Ошибка',
  cancelled: 'Отменён',
}

export function ImportProgress({ jobId, onComplete }: ImportProgressProps) {
  const [state, setState] = useState<ProgressState | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Keep onComplete in a ref so the EventSource effect doesn't need it as a dependency.
  // Without this, an inline arrow prop recreates the callback every render,
  // causing the effect to close and reopen the SSE connection on every re-render.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    if (!jobId) return

    const es = new EventSource(`/api/import/${jobId}/progress`)

    es.onmessage = (e) => {
      try {
        const data: ProgressState = JSON.parse(e.data)
        setState(data)
        if (['completed', 'failed', 'cancelled'].includes(data.status)) {
          es.close()
          onCompleteRef.current?.(data)
        }
      } catch { /* skip malformed frame */ }
    }

    es.onerror = () => {
      setError('Соединение прервано')
      es.close()
    }

    return () => es.close()
  }, [jobId]) // onComplete intentionally excluded — stable via ref

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    )
  }

  if (!state) {
    return (
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 text-sm py-4">
        <span className="animate-spin text-xl">⟳</span>
        Подключение к потоку прогресса…
      </div>
    )
  }

  const isDone = state.status === 'completed'
  const isFailed = state.status === 'failed'
  const isCancelled = state.status === 'cancelled'

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center gap-2">
        {isDone && <span className="text-green-500 text-xl">✓</span>}
        {isFailed && <span className="text-red-500 text-xl">✗</span>}
        {isCancelled && <span className="text-gray-400 text-xl">⊘</span>}
        {!isDone && !isFailed && !isCancelled && (
          <span className="text-blue-500 text-xl animate-spin">⟳</span>
        )}
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {STATUS_LABELS[state.status] ?? state.status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className={[
            'h-3 rounded-full transition-all duration-500',
            isFailed ? 'bg-red-500' : isCancelled ? 'bg-gray-400' : 'bg-blue-600',
          ].join(' ')}
          style={{ width: `${state.percent}%` }}
        />
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Обработано" value={state.processed} total={state.total} />
        <Stat label="Успешно" value={state.successful} color="text-green-600 dark:text-green-400" />
        <Stat label="Дубли пропущены" value={state.duplicates_skipped} color="text-yellow-600 dark:text-yellow-400" />
        <Stat label="Ошибки" value={state.failed} color="text-red-600 dark:text-red-400" />
      </div>

      {/* Download errors link */}
      {isDone && state.failed > 0 && (
        <a
          href={`/api/import/${jobId}/errors`}
          download
          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ⬇ Скачать CSV с ошибками ({state.failed} строк)
        </a>
      )}
    </div>
  )
}

function Stat({ label, value, total, color }: {
  label: string
  value: number
  total?: number
  color?: string
}) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
      <div className={['text-xl font-bold', color ?? 'text-gray-800 dark:text-gray-100'].join(' ')}>
        {value.toLocaleString('ru-RU')}
        {total != null && (
          <span className="text-sm font-normal text-gray-400"> / {total.toLocaleString('ru-RU')}</span>
        )}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}
