'use client'
import { useState } from 'react'
import { X } from 'lucide-react'

interface WorkEntry {
  name: string
  price: number
  discount?: number
  duration?: number
  cost?: number
  masterName?: string
}

interface WorkModalProps {
  onAdd: (work: WorkEntry, addMore: boolean) => void
  onClose: () => void
  masters?: { id: string; name: string }[]
}

export default function WorkModal({ onAdd, onClose, masters = [] }: WorkModalProps) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [discount, setDiscount] = useState('')
  const [duration, setDuration] = useState('')
  const [cost, setCost] = useState('')
  const [masterName, setMasterName] = useState('')
  const [error, setError] = useState('')

  function validate(): WorkEntry | null {
    if (!name.trim()) { setError('Укажите наименование'); return null }
    const priceNum = parseFloat(price)
    if (!price || isNaN(priceNum) || priceNum < 0) { setError('Укажите корректную цену'); return null }
    setError('')
    return {
      name: name.trim(),
      price: priceNum,
      discount: discount ? parseFloat(discount) : undefined,
      duration: duration ? parseInt(duration) : undefined,
      cost: cost ? parseFloat(cost) : undefined,
      masterName: masterName || undefined,
    }
  }

  function handleSave(addMore: boolean) {
    const entry = validate()
    if (!entry) return
    onAdd(entry, addMore)
    if (addMore) {
      setName(''); setPrice(''); setDiscount(''); setDuration(''); setCost(''); setMasterName('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">Добавить работу</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Наименование *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Замена стекла, Диагностика..."
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Цена ₽ *</label>
              <input
                value={price}
                onChange={e => setPrice(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Скидка ₽</label>
              <input
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Длительность (мин)</label>
              <input
                value={duration}
                onChange={e => setDuration(e.target.value)}
                type="number"
                min="0"
                placeholder="30"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Себестоимость ₽
                <span className="ml-1 text-muted-foreground/60 font-normal" title="ФРП, лицензии, субподряд — снижает прибыль, не выставляется клиенту">ⓘ</span>
              </label>
              <input
                value={cost}
                onChange={e => setCost(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Исполнитель</label>
            {masters.length > 0 ? (
              <select
                value={masterName}
                onChange={e => setMasterName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              >
                <option value="">— не назначен —</option>
                {masters.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={masterName}
                onChange={e => setMasterName(e.target.value)}
                placeholder="Имя мастера"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t">
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="flex-1 py-2 text-sm font-medium border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Сохранить и ещё
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  )
}
