'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface Props {
  orderNumber: string
  estimatedCost?: number
  approvalMessage?: string
}

export default function ApprovalButtons({ orderNumber, estimatedCost, approvalMessage }: Props) {
  const [loading, setLoading] = useState<'approve' | 'decline' | null>(null)
  const [done, setDone] = useState<'approve' | 'decline' | null>(null)
  const [comment, setComment] = useState('')
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false)

  async function handleAction(action: 'approve' | 'decline') {
    setLoading(action)
    try {
      const res = await fetch(`/api/tracking/${orderNumber}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      })
      if (res.ok) setDone(action)
    } finally {
      setLoading(null)
    }
  }

  if (done === 'approve') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
        <p className="font-semibold text-green-800">Ремонт согласован!</p>
        <p className="text-sm text-green-600 mt-1">Мастер приступит к работе в ближайшее время.</p>
        {comment && (
          <p className="text-xs text-green-600 mt-2 italic">&laquo;{comment}&raquo;</p>
        )}
      </div>
    )
  }

  if (done === 'decline') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
        <XCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <p className="font-semibold text-slate-700">Вы отказались от ремонта</p>
        <p className="text-sm text-slate-500 mt-1">Свяжитесь с сервисом для получения устройства.</p>
        {comment && (
          <p className="text-xs text-slate-500 mt-2 italic">&laquo;{comment}&raquo;</p>
        )}
      </div>
    )
  }

  // Decline confirmation step
  if (showDeclineConfirm) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
        <h3 className="font-semibold text-red-800 mb-1">Отказ от ремонта</h3>
        <p className="text-sm text-red-700 mb-3">
          Устройство будет возвращено без ремонта. Укажите причину (необязательно):
        </p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Причина отказа..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-red-200 rounded-xl resize-none outline-none focus:ring-2 focus:ring-red-400 bg-white mb-3"
          maxLength={500}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeclineConfirm(false)}
            className="flex-1 py-2.5 border border-slate-300 text-slate-600 font-medium rounded-xl text-sm hover:bg-slate-50 transition"
          >
            Назад
          </button>
          <button
            onClick={() => handleAction('decline')}
            disabled={loading !== null}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2.5 rounded-xl text-sm transition"
          >
            {loading === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Подтвердить отказ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
      <h3 className="font-semibold text-yellow-800 mb-1">Требуется ваше решение</h3>
      {approvalMessage && (
        <div className="text-sm text-yellow-800 bg-yellow-100 rounded-lg px-3 py-2 mb-3">
          {approvalMessage}
        </div>
      )}
      {estimatedCost != null && estimatedCost > 0 && (
        <p className="text-sm text-yellow-700 mb-3">
          Стоимость ремонта: <span className="font-bold">{estimatedCost.toLocaleString('ru-RU')} ₽</span>
        </p>
      )}

      {/* Optional comment for approval */}
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)..."
        rows={2}
        className="w-full px-3 py-2 text-sm border border-yellow-200 rounded-xl resize-none outline-none focus:ring-2 focus:ring-yellow-400 bg-white mb-3"
        maxLength={500}
      />

      <div className="flex gap-3">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2.5 rounded-xl transition text-sm"
        >
          {loading === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Согласовать
        </button>
        <button
          onClick={() => setShowDeclineConfirm(true)}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 font-semibold py-2.5 rounded-xl transition text-sm"
        >
          <XCircle className="w-4 h-4" />
          Отказаться
        </button>
      </div>
    </div>
  )
}
