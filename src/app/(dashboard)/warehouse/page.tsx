'use client'
import { useState, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Package, AlertTriangle, Loader2, X, Edit2,
  ScanLine, Truck, ArrowLeftRight, Folder, Barcode, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Product {
  _id: string
  name: string
  sku?: string
  barcode?: string
  category?: string
  description?: string
  productType: 'part' | 'product'
  condition?: 'new' | 'used'
  location?: string
  serialTracking: boolean
  quantity: number
  minQuantity: number
  cost: number
  price: number
  supplier?: string
  isActive: boolean
}

const EMPTY_FORM = {
  name: '', sku: '', barcode: '', category: '', description: '',
  productType: 'part' as 'part' | 'product',
  condition: 'new' as 'new' | 'used',
  location: '', serialTracking: false,
  quantity: 0, minQuantity: 1, cost: 0, price: 0, supplier: '',
}

export default function WarehousePage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'part' | 'product'>('part')
  const [search, setSearch] = useState('')
  const [stock, setStock] = useState<'all' | 'low' | 'out'>('all')
  const [category, setCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showReceiving, setShowReceiving] = useState(false)
  const [editItem, setEditItem] = useState<Product | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const [receivingItem, setReceivingItem] = useState<Product | null>(null)
  const [receivingQty, setReceivingQty] = useState('')
  const [receivingSupplier, setReceivingSupplier] = useState('')
  const [receivingCost, setReceivingCost] = useState('')
  const scanRef = useRef<HTMLInputElement>(null)

  const { data: products, isLoading } = useQuery({
    queryKey: ['warehouse', search, stock, tab],
    queryFn: async () => {
      const p = new URLSearchParams({ productType: tab })
      if (search) p.set('search', search)
      if (stock !== 'all') p.set('stock', stock)
      const res = await fetch(`/api/warehouse?${p}`)
      const json = await res.json()
      return json.data as Product[]
    },
  })

  const list = products ?? []

  // Stats
  const totalQty = list.reduce((s, p) => s + p.quantity, 0)
  const lowCount = list.filter(p => p.quantity > 0 && p.quantity <= p.minQuantity).length
  const outCount = list.filter(p => p.quantity === 0).length
  const totalCost = list.reduce((s, p) => s + p.cost * p.quantity, 0)

  // Categories from current list
  const categories = Array.from(new Set(list.map(p => p.category).filter(Boolean))) as string[]

  const filteredList = category ? list.filter(p => p.category === category) : list

  function openCreate() {
    setEditItem(null)
    setForm({ ...EMPTY_FORM, productType: tab })
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditItem(p)
    setForm({
      name: p.name, sku: p.sku ?? '', barcode: p.barcode ?? '',
      category: p.category ?? '', description: p.description ?? '',
      productType: p.productType, condition: p.condition ?? 'new',
      location: p.location ?? '', serialTracking: p.serialTracking,
      quantity: p.quantity, minQuantity: p.minQuantity,
      cost: p.cost, price: p.price, supplier: p.supplier ?? '',
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const url = editItem ? `/api/warehouse/${editItem._id}` : '/api/warehouse'
    await fetch(url, {
      method: editItem ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    queryClient.invalidateQueries({ queryKey: ['warehouse'] })
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить товар?')) return
    await fetch(`/api/warehouse/${id}`, { method: 'DELETE' })
    queryClient.invalidateQueries({ queryKey: ['warehouse'] })
  }

  async function handleReceiving(e: React.FormEvent) {
    e.preventDefault()
    if (!receivingItem) return
    const qty = parseInt(receivingQty) || 0
    await fetch(`/api/warehouse/${receivingItem._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: receivingItem.quantity + qty,
        cost: receivingCost ? parseFloat(receivingCost) : receivingItem.cost,
        supplier: receivingSupplier || receivingItem.supplier,
      }),
    })
    queryClient.invalidateQueries({ queryKey: ['warehouse'] })
    setShowReceiving(false)
    setReceivingItem(null)
    setReceivingQty('')
    setReceivingSupplier('')
    setReceivingCost('')
  }

  function openReceiving(p: Product) {
    setReceivingItem(p)
    setReceivingSupplier(p.supplier ?? '')
    setReceivingCost(p.cost ? String(p.cost) : '')
    setShowReceiving(true)
  }

  const handleScannerInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value.trim()
      if (val) {
        setSearch(val)
        setScannerActive(false)
      }
    }
  }, [])

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <aside className="w-52 shrink-0 border-r bg-card hidden lg:flex flex-col p-3 gap-1">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">Фильтр</div>
        {([['all', 'Все'], ['low', 'Мало'], ['out', 'Нет']] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setStock(val)}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left',
              stock === val ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-accent text-foreground'
            )}
          >
            <span>{label}</span>
            {val === 'low' && lowCount > 0 && <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5">{lowCount}</span>}
            {val === 'out' && outCount > 0 && <span className="text-xs bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">{outCount}</span>}
          </button>
        ))}

        {categories.length > 0 && (
          <>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4 mb-2 px-2 flex items-center gap-1.5">
              <Folder className="w-3 h-3" /> Категории
            </div>
            <button
              type="button"
              onClick={() => setCategory('')}
              className={cn('px-3 py-2 rounded-lg text-sm transition-colors text-left', !category ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-accent')}
            >
              Все категории
            </button>
            {categories.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn('px-3 py-2 rounded-lg text-sm transition-colors text-left truncate', category === c ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-accent')}
              >
                {c}
              </button>
            ))}
          </>
        )}

        {/* Scanner indicator */}
        <div className="mt-auto pt-3 border-t">
          <div className={cn('flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg', scannerActive ? 'text-green-700 bg-green-50' : 'text-muted-foreground')}>
            <Barcode className="w-3.5 h-3.5" />
            {scannerActive ? 'Сканер активен' : 'Сканер выкл.'}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold">Запасные части</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Управление складскими запасами</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => { setScannerActive(v => !v); setTimeout(() => scanRef.current?.focus(), 50) }}
                className={cn('flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition', scannerActive ? 'bg-green-50 border-green-300 text-green-700' : 'hover:bg-accent')}
              >
                <ScanLine className="w-4 h-4" /> Сканировать
              </button>
              <button
                type="button"
                onClick={() => setShowReceiving(true)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border hover:bg-accent transition"
              >
                <Truck className="w-4 h-4" /> Приёмка
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
              >
                <Plus className="w-4 h-4" /> Новый товар
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b mb-5">
            {([['part', 'Запчасти'], ['product', 'Товары']] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => { setTab(val); setCategory('') }}
                className={cn('py-2.5 px-4 text-sm font-medium border-b-2 transition-colors -mb-px',
                  tab === val ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            {[
              { label: 'Позиций', value: list.length, },
              { label: 'Единиц', value: totalQty, },
              { label: 'Мало', value: lowCount, color: lowCount > 0 ? 'text-orange-600' : undefined },
              { label: 'Нет', value: outCount, color: outCount > 0 ? 'text-red-600' : undefined },
              { label: 'Себестоимость', value: formatCurrency(totalCost) },
            ].map(s => (
              <div key={s.label} className="bg-card border rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
                <div className={cn('text-lg font-bold', s.color ?? '')}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Search row */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-md">
              {scannerActive ? (
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                  <input
                    ref={scanRef}
                    placeholder="Поднесите штрихкод к сканеру..."
                    onKeyDown={handleScannerInput}
                    className="w-full pl-9 pr-3 py-2 border-2 border-green-400 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск по названию, артикулу, штрихкоду..."
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Наименование</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Артикул</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Категория</th>
                    {tab === 'part' && <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Место</th>}
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Кол-во</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Себест.</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Цена</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Поставщик</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredList.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-16 text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>{search ? 'Ничего не найдено' : 'Склад пуст'}</p>
                      <button type="button" onClick={openCreate} className="mt-3 text-sm text-blue-600 hover:underline">
                        Добавить первый товар
                      </button>
                    </td></tr>
                  ) : filteredList.map(p => (
                    <tr key={p._id} className="border-b hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.name}</div>
                        {p.quantity === 0 && (
                          <div className="flex items-center gap-1 text-xs text-red-500 mt-0.5"><AlertTriangle className="w-3 h-3" />Нет в наличии</div>
                        )}
                        {p.quantity > 0 && p.quantity <= p.minQuantity && (
                          <div className="flex items-center gap-1 text-xs text-orange-600 mt-0.5"><AlertTriangle className="w-3 h-3" />Заканчивается</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">{p.sku ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.category ?? '—'}</td>
                      {tab === 'part' && <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{p.location ?? '—'}</td>}
                      <td className={cn('px-4 py-3 text-right font-semibold', p.quantity === 0 ? 'text-red-500' : p.quantity <= p.minQuantity ? 'text-orange-600' : '')}>
                        {p.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{formatCurrency(p.cost)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.price)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">{p.supplier ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button type="button" onClick={() => openReceiving(p)} title="Приёмка" className="p-1.5 hover:bg-green-100 text-green-600 rounded-lg transition">
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => openEdit(p)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDelete(p._id)} className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-background">
              <h2 className="font-semibold">{editItem ? 'Редактировать' : `Новая ${form.productType === 'part' ? 'запчасть' : 'товар'}`}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 hover:bg-accent rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Type selector */}
              {!editItem && (
                <div className="flex rounded-lg border overflow-hidden">
                  {([['part', 'Запчасть'], ['product', 'Товар магазина']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setForm(f => ({ ...f, productType: val }))}
                      className={cn('flex-1 py-2 text-sm font-medium transition-colors', form.productType === val ? 'bg-blue-600 text-white' : 'hover:bg-accent')}
                    >{label}</button>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Наименование <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Артикул</label>
                  <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Barcode className="w-3.5 h-3.5" /> Штрихкод</label>
                  <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Сканируйте или введите" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Категория</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    list="categories-list"
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <datalist id="categories-list">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Место хранения</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Полка A3" />
                </div>
              </div>

              {form.productType === 'part' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Состояние</label>
                    <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value as 'new' | 'used' }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background">
                      <option value="new">Новая</option>
                      <option value="used">Б/У</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-0.5">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <button type="button" onClick={() => setForm(f => ({ ...f, serialTracking: !f.serialTracking }))}
                        className={cn('transition-colors', form.serialTracking ? 'text-blue-600' : 'text-muted-foreground')}>
                        {form.serialTracking ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                      Серийные номера
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Количество</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Мин. остаток</label>
                  <input type="number" value={form.minQuantity} onChange={e => setForm(f => ({ ...f, minQuantity: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Себестоимость ₽</label>
                  <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Цена продажи ₽</label>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Поставщик / Контрагент</label>
                <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Описание</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border rounded-lg text-sm hover:bg-accent transition">Отмена</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receiving modal */}
      {showReceiving && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold flex items-center gap-2"><Truck className="w-4 h-4" /> Приёмка</h2>
              <button type="button" onClick={() => { setShowReceiving(false); setReceivingItem(null) }} className="p-1.5 hover:bg-accent rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleReceiving} className="p-5 space-y-3">
              {!receivingItem ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Выберите товар из таблицы или найдите ниже</p>
                  <button type="button" onClick={() => setShowReceiving(false)} className="w-full py-2 border rounded-lg text-sm hover:bg-accent">Закрыть</button>
                </div>
              ) : (
                <>
                  <div className="bg-accent/50 rounded-lg px-3 py-2 text-sm font-medium">{receivingItem.name}</div>
                  <div className="text-xs text-muted-foreground">Текущий остаток: {receivingItem.quantity} шт.</div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Количество к приёмке *</label>
                    <input type="number" value={receivingQty} onChange={e => setReceivingQty(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={1} required autoFocus />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Поставщик / Контрагент</label>
                    <input value={receivingSupplier} onChange={e => setReceivingSupplier(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Закупочная цена ₽</label>
                    <input type="number" value={receivingCost} onChange={e => setReceivingCost(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowReceiving(false); setReceivingItem(null) }} className="flex-1 py-2.5 border rounded-lg text-sm hover:bg-accent transition">Отмена</button>
                    <button type="submit" className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">Принять</button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
