'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package, AlertTriangle, Loader2, X, Edit2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Product {
  _id: string
  name: string
  sku?: string
  category?: string
  quantity: number
  minQuantity: number
  cost: number
  price: number
  supplier?: string
  isActive: boolean
}

const EMPTY_FORM = { name: '', sku: '', category: '', quantity: 0, minQuantity: 1, cost: 0, price: 0, supplier: '' }

export default function WarehousePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [lowStock, setLowStock] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: products, isLoading } = useQuery({
    queryKey: ['warehouse', search, lowStock],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (search) p.set('search', search)
      if (lowStock) p.set('lowStock', 'true')
      const res = await fetch(`/api/warehouse?${p}`)
      const json = await res.json()
      return json.data as Product[]
    },
  })

  function openCreate() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditItem(p)
    setForm({ name: p.name, sku: p.sku ?? '', category: p.category ?? '', quantity: p.quantity, minQuantity: p.minQuantity, cost: p.cost, price: p.price, supplier: p.supplier ?? '' })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (editItem) {
      await fetch(`/api/warehouse/${editItem._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/warehouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    queryClient.invalidateQueries({ queryKey: ['warehouse'] })
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить товар?')) return
    await fetch(`/api/warehouse/${id}`, { method: 'DELETE' })
    queryClient.invalidateQueries({ queryKey: ['warehouse'] })
  }

  const list = products ?? []
  const lowStockCount = list.filter(p => p.quantity <= p.minQuantity).length

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Склад</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {list.length} позиций
            {lowStockCount > 0 && <span className="text-orange-600 ml-2">· {lowStockCount} заканчиваются</span>}
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition">
          <Plus className="w-4 h-4" />
          Добавить товар
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию, артикулу..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} className="rounded" />
          Заканчиваются
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Наименование</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Артикул</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Категория</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Кол-во</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Себест.</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Цена</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Поставщик</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Склад пуст</p>
                </td></tr>
              ) : list.map(p => (
                <tr key={p._id} className="border-b hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.quantity <= p.minQuantity && (
                      <div className="flex items-center gap-1 text-xs text-orange-600 mt-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        Заканчивается
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category ?? '—'}</td>
                  <td className={cn('px-4 py-3 text-right font-semibold', p.quantity <= p.minQuantity ? 'text-orange-600' : '')}>
                    {p.quantity}
                    <span className="text-xs text-muted-foreground font-normal"> / min {p.minQuantity}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.cost)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.price)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.supplier ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p._id)} className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">{editItem ? 'Редактировать товар' : 'Новый товар'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-accent rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Наименование <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Артикул (SKU)</label>
                  <input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Категория</label>
                  <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Кол-во</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Мин. остаток</label>
                  <input type="number" value={form.minQuantity} onChange={e => setForm(p => ({ ...p, minQuantity: +e.target.value }))}
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
                <label className="block text-sm font-medium mb-1">Поставщик</label>
                <input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
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
