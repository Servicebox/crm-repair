'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, BookOpen, Smartphone, ShieldCheck, Package, Wrench } from 'lucide-react'

type DictionaryType = 'deviceType' | 'condition' | 'accessories' | 'defect'

interface DictionaryItem {
  _id: string
  type: DictionaryType
  value: string
  sortOrder: number
  isActive: boolean
}

const TABS: { type: DictionaryType; label: string; icon: React.ReactNode; hint: string }[] = [
  { type: 'deviceType', label: 'Устройства', icon: <Smartphone className="w-4 h-4" />, hint: 'Смартфон, Ноутбук, Планшет...' },
  { type: 'condition', label: 'Внешнее состояние', icon: <ShieldCheck className="w-4 h-4" />, hint: 'Царапины, Потёртости, Трещина экрана...' },
  { type: 'accessories', label: 'Комплектация', icon: <Package className="w-4 h-4" />, hint: 'Зарядка, Чехол, Коробка...' },
  { type: 'defect', label: 'Неисправности', icon: <Wrench className="w-4 h-4" />, hint: 'Не включается, Разбит экран...' },
]

export default function DictionaryPage() {
  const [activeType, setActiveType] = useState<DictionaryType>('deviceType')
  const [newValue, setNewValue] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const { data: items = [], isLoading } = useQuery<DictionaryItem[]>({
    queryKey: ['dictionary', activeType],
    queryFn: async () => {
      const res = await fetch(`/api/dictionary?type=${activeType}`)
      const json = await res.json()
      return json.data ?? []
    },
  })

  const addMutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeType, value: value.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dictionary', activeType] })
      setNewValue('')
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dictionary/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dictionary', activeType] }),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/dictionary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dictionary', activeType] }),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newValue.trim()) return
    addMutation.mutate(newValue)
  }

  const activeTab = TABS.find(t => t.type === activeType)!

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-blue-500" />
        <div>
          <h1 className="text-xl font-bold">Библиотека данных</h1>
          <p className="text-sm text-muted-foreground">
            Подсказки для формы нового заказа
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.type}
            onClick={() => { setActiveType(tab.type); setNewValue(''); setError('') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border ${
              activeType === tab.type
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-background hover:bg-accent border-border'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder={`Добавить: ${activeTab.hint}`}
          className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
        />
        <button
          type="submit"
          disabled={!newValue.trim() || addMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Добавить
        </button>
      </form>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-3">
          {error}
        </div>
      )}

      {/* List */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <p>Список пуст. Добавьте первое значение выше.</p>
            <p className="text-xs mt-1 opacity-70">
              Значения появятся в форме заказа как подсказки
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map(item => (
              <li
                key={item._id}
                className={`flex items-center justify-between px-4 py-3 ${!item.isActive ? 'opacity-40' : ''}`}
              >
                <span className="text-sm font-medium">{item.value}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: item._id, isActive: !item.isActive })}
                    className={`text-xs px-2 py-0.5 rounded-full border transition ${
                      item.isActive
                        ? 'border-green-200 text-green-700 bg-green-50 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                        : 'border-slate-200 text-slate-500 bg-slate-50 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                    }`}
                  >
                    {item.isActive ? 'Активно' : 'Скрыто'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Удалить «${item.value}»?`)) deleteMutation.mutate(item._id)
                    }}
                    className="p-1.5 text-muted-foreground hover:text-red-500 transition rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Всего: {items.length} · Активных: {items.filter(i => i.isActive).length}
      </p>
    </div>
  )
}
