'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface Props {
  orderNumber: string
  estimatedCost?: number
}

export default function ApprovalButtons({ orderNumber, estimatedCost }: Props) {
  const [loading, setLoading] = useState<'approve' | 'decline' | null>(null)
  const [done, setDone] = useState<'approve' | 'decline' | null>(null)

  async function handleAction(action: 'approve' | 'decline') {
    setLoading(action)
    try {
      const res = await fetch(`/api/tracking/${orderNumber}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
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
      </div>
    )
  }

  if (done === 'decline') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
        <XCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <p className="font-semibold text-slate-700">Вы отказались от ремонта</p>
        <p className="text-sm text-slate-500 mt-1">Свяжитесь с сервисом для получения устройства.</p>
      </div>
    )
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
      <h3 className="font-semibold text-yellow-800 mb-1">Требуется ваше решение</h3>
      {estimatedCost != null && (
        <p className="text-sm text-yellow-700 mb-3">
          Стоимость ремонта: <span className="font-bold">{estimatedCost.toLocaleString('ru-RU')} ₽</span>
        </p>
      )}
      <p className="text-sm text-yellow-700 mb-4">
        Мастер завершил диагностику. Подтвердите или отмените ремонт.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2.5 rounded-xl transition"
        >
          {loading === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Согласовать
        </button>
        <button
          onClick={() => handleAction('decline')}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 font-semibold py-2.5 rounded-xl transition"
        >
          {loading === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          Отказаться
        </button>
      </div>
    </div>
  )
}
