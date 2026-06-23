'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Wrench, Loader2, X, Edit2, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { DEVICE_TYPES } from '@/constants/orders'

interface Service {
  _id: string
  name: string
  description?: string
  category?: string
  deviceTypes: string[]
  price: number
  cost: number
  warrantyDays: number
  isActive: boolean
}

const EMPTY_FORM = { name: '', description: '', category: '', deviceTypes: [] as string[], price: 0, cost: 0, warrantyDays: 30 }

export default function ServicesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Service | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', search],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (search) p.set('search', search)
      const res = await fetch(`/api/services?${p}`)
      const json = await res.json()
      return json.data as Service[]
    },
  })

  function openCreate() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(s: Service) {
    setEditItem(s)
    setForm({ name: s.name, description: s.description ?? '', category: s.category ?? '', deviceTypes: s.deviceTypes, price: s.price, cost: s.cost, warrantyDays: s.warrantyDays ?? 30 })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (editItem) {
      await fetch(`/api/services/${editItem._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch('/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    queryClient.invalidateQueries({ queryKey: ['services'] })
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Деактивировать услугу?')) return
    await fetch(`/api/services/${id}`, { method: 'DELETE' })
    queryClient.invalidateQueries({ queryKey: ['services'] })
  }

  function toggleDeviceType(dt: string) {
    setForm(p => ({
      ...p,
      deviceTypes: p.deviceTypes.includes(dt) ? p.deviceTypes.filter(d => d !== dt) : [...p.deviceTypes, dt],
    }))
  }

  const list = services ?? []
  const categories = [...new Set(list.map(s => s.category).filter(Boolean))]

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Услуги</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{list.length} услуг</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition">
          <Plus className="w-4 h-4" />
          Добавить услугу
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск услуг..."
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Услуга</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Категория</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Типы устройств</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Себест.</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Цена</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Гарантия</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Wrench className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Услуг пока нет</p>
                </td></tr>
              ) : list.map(s => (
                <tr key={s._id} className="border-b hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.category ?? '—'}</td>
                  <td className="px-4 py-3">
                    {s.deviceTypes.length === 0 ? (
                      <span className="text-muted-foreground text-xs">Все</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {s.deviceTypes.map(dt => (
                          <span key={dt} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{dt}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(s.cost)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(s.price)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{s.warrantyDays} дн.</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s._id)} className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition"><X className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">{editItem ? 'Редактировать услугу' : 'Новая услуга'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-accent rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Название <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Категория</label>
                  <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Экраны, Аккумуляторы..." list="categories-list" />
                  <datalist id="categories-list">
                    {categories.map(c => <option key={c} value={c!} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Гарантия (дней)</label>
                  <input type="number" value={form.warrantyDays} onChange={e => setForm(p => ({ ...p, warrantyDays: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Себестоимость, ₽</label>
                  <input type="number" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Цена продажи, ₽</label>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Описание</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Типы устройств (пусто = все)</label>
                <div className="flex flex-wrap gap-1">
                  {DEVICE_TYPES.map(dt => (
                    <button key={dt} type="button" onClick={() => toggleDeviceType(dt)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition ${form.deviceTypes.includes(dt) ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-accent'}`}>
                      {dt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition">Отмена</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
