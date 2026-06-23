'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Loader2, X, Edit2 } from 'lucide-react'

interface Location {
  _id: string
  name: string
  address?: string
  phone?: string
  isDefault: boolean
  isActive: boolean
}

const EMPTY_FORM = { name: '', address: '', phone: '', isDefault: false }

export default function LocationsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Location | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await fetch('/api/locations')
      const json = await res.json()
      return json.data as Location[]
    },
  })

  function openCreate() { setEditItem(null); setForm(EMPTY_FORM); setShowForm(true) }
  function openEdit(l: Location) { setEditItem(l); setForm({ name: l.name, address: l.address ?? '', phone: l.phone ?? '', isDefault: l.isDefault }); setShowForm(true) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const url = editItem ? `/api/locations/${editItem._id}` : '/api/locations'
    const method = editItem ? 'PATCH' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    queryClient.invalidateQueries({ queryKey: ['locations'] })
    setShowForm(false)
    setSaving(false)
  }

  const list = locations ?? []

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Локации / Филиалы</h1>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition">
          <Plus className="w-4 h-4" />
          Добавить локацию
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(loc => (
            <div key={loc._id} className="bg-card border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {loc.name}
                    {loc.isDefault && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Основная</span>}
                  </div>
                  {loc.address && <div className="text-sm text-muted-foreground mt-0.5">{loc.address}</div>}
                  {loc.phone && <div className="text-sm text-muted-foreground">{loc.phone}</div>}
                </div>
                <button onClick={() => openEdit(loc)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Локаций пока нет</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">{editItem ? 'Редактировать локацию' : 'Новая локация'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-accent rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Название <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Адрес</label>
                <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Телефон</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} className="rounded" />
                Основная локация
              </label>
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
