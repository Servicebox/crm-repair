'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Store, Search, ShoppingCart, Star, Package, Truck, Plus, X,
  Loader2, CheckCircle, ExternalLink, Minus, ChevronRight, Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface MarketItem {
  _id: string
  name: string
  category: string
  price: number
  oldPrice?: number
  supplier: string
  supplierUrl?: string
  sku?: string
  brand?: string
  description?: string
  quantity: number
  delivery?: string
  imageUrl?: string
}

interface CartItem {
  item: MarketItem
  qty: number
}

const CATEGORIES = [
  { key: '', label: 'Все категории' },
  { key: 'screens', label: 'Дисплеи' },
  { key: 'batteries', label: 'Аккумуляторы' },
  { key: 'charging', label: 'Зарядка' },
  { key: 'cameras', label: 'Камеры' },
  { key: 'tools', label: 'Инструменты' },
  { key: 'housings', label: 'Корпуса' },
  { key: 'other', label: 'Другое' },
]

const EMPTY_FORM = {
  name: '', category: 'screens', price: 0, oldPrice: 0,
  supplier: '', supplierUrl: '', sku: '', brand: '', description: '',
  delivery: '', inStock: true,
}

export default function MarketplacePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('name')
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [addingSaving, setAddingSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [checkoutDone, setCheckoutDone] = useState<{ orderNumber: string; total: number } | null>(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [comment, setComment] = useState('')

  const { data: items = [], isLoading } = useQuery<MarketItem[]>({
    queryKey: ['marketplace', search, category],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (search) p.set('search', search)
      if (category) p.set('category', category)
      const res = await fetch(`/api/marketplace?${p}`)
      const json = await res.json()
      return json.data ?? []
    },
  })

  const sorted = [...items].sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price
    if (sort === 'price_desc') return b.price - a.price
    return a.name.localeCompare(b.name)
  })

  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  function addToCart(item: MarketItem) {
    setCart(prev => {
      const ex = prev.find(c => c.item._id === item._id)
      if (ex) return prev.map(c => c.item._id === item._id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { item, qty: 1 }]
    })
  }

  function updateQty(id: string, qty: number) {
    if (qty < 1) { setCart(p => p.filter(c => c.item._id !== id)); return }
    setCart(p => p.map(c => c.item._id === id ? { ...c, qty } : c))
  }

  async function handleCheckout() {
    if (cart.length === 0) return
    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      const res = await fetch('/api/marketplace/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(c => ({ id: c.item._id, name: c.item.name, price: c.item.price, qty: c.qty, supplier: c.item.supplier })),
          comment: comment || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setCheckoutError(json.error ?? 'Ошибка заявки'); return }
      setCheckoutDone({ orderNumber: json.data.orderNumber, total: json.data.total })
      setCart([])
    } catch {
      setCheckoutError('Ошибка сети')
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    setAddingSaving(true)
    setAddError('')
    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, oldPrice: form.oldPrice || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error ?? 'Ошибка'); return }
      queryClient.invalidateQueries({ queryKey: ['marketplace'] })
      setShowAddForm(false)
      setForm({ ...EMPTY_FORM })
    } catch {
      setAddError('Ошибка сети')
    } finally {
      setAddingSaving(false)
    }
  }

  if (showCart) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setShowCart(false)} className="p-2 hover:bg-accent rounded-lg transition">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <h1 className="text-xl font-bold">Корзина закупки</h1>
        </div>

        {checkoutDone ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-green-800 mb-1">Заявка создана</h2>
            <p className="text-green-700 text-sm mb-1">№ {checkoutDone.orderNumber}</p>
            <p className="text-green-700 text-sm mb-4">Сумма: {formatCurrency(checkoutDone.total)}</p>
            <button
              onClick={() => { setCheckoutDone(null); setShowCart(false); setComment('') }}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition"
            >
              Продолжить закупки
            </button>
          </div>
        ) : cart.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Корзина пуста</p>
            <button onClick={() => setShowCart(false)} className="mt-3 text-blue-600 text-sm hover:underline">Вернуться к каталогу</button>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map(({ item, qty }) => (
              <div key={item._id} className="bg-card border rounded-xl p-4 flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.supplier}</div>
                  {item.delivery && <div className="text-xs text-blue-600 mt-0.5 flex items-center gap-1"><Truck className="w-3 h-3" />{item.delivery}</div>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="font-bold text-sm">{formatCurrency(item.price * qty)}</div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item._id, qty - 1)} className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-accent transition">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{qty}</span>
                    <button onClick={() => updateQty(item._id, qty + 1)} className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-accent transition">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => setCart(p => p.filter(c => c.item._id !== item._id))} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center transition ml-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex justify-between font-semibold text-lg">
                <span>Итого:</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Комментарий к заявке (необязательно)"
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {checkoutError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{checkoutError}</div>}
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
              >
                {checkoutLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Оформить заявку на закупку
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-500" />
            Маркетплейс запчастей
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Закупайте запчасти напрямую у поставщиков</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 border hover:bg-accent text-sm font-medium px-3 py-2 rounded-lg transition"
          >
            <Settings className="w-4 h-4" />
            Добавить позицию
          </button>
          <button
            onClick={() => setShowCart(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition relative"
          >
            <ShoppingCart className="w-4 h-4" />
            Корзина
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-48 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Название, поставщик..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
        >
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
        >
          <option value="name">По названию</option>
          <option value="price_asc">Цена ↑</option>
          <option value="price_desc">Цена ↓</option>
        </select>
      </div>

      {/* Categories scroll */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={cn(
              'whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition shrink-0',
              category === c.key ? 'bg-blue-600 text-white' : 'border hover:bg-accent'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium mb-1">Каталог пуст</p>
          <p className="text-sm">Добавьте первую позицию через кнопку «Добавить позицию»</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(item => {
            const inCart = cart.find(c => c.item._id === item._id)
            const outOfStock = item.quantity === 0
            return (
              <div key={item._id} className={cn('bg-card border rounded-xl overflow-hidden flex flex-col transition hover:shadow-md', outOfStock && 'opacity-60')}>
                <div className="p-4 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{item.category}</div>
                    {outOfStock && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full whitespace-nowrap">Нет в наличии</span>}
                  </div>
                  <div className="font-semibold text-sm leading-snug mb-1">{item.name}</div>
                  {item.brand && <div className="text-xs text-muted-foreground mb-1">{item.brand}</div>}
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                    <Truck className="w-3 h-3 shrink-0" />
                    {item.supplier}
                    {item.supplierUrl && (
                      <a href={item.supplierUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 ml-auto">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {item.delivery && (
                    <div className="text-xs text-blue-600 mb-3">Доставка: {item.delivery}</div>
                  )}
                  <div className="flex items-baseline gap-2 mt-auto">
                    <span className="text-lg font-bold">{formatCurrency(item.price)}</span>
                    {item.oldPrice && item.oldPrice > item.price && (
                      <span className="text-sm text-muted-foreground line-through">{formatCurrency(item.oldPrice)}</span>
                    )}
                  </div>
                </div>
                <div className="p-3 border-t">
                  {inCart ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item._id, inCart.qty - 1)} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-accent transition">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="flex-1 text-center text-sm font-semibold">{inCart.qty} в корзине</span>
                      <button onClick={() => updateQty(item._id, inCart.qty + 1)} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-accent transition">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      disabled={outOfStock}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white rounded-lg text-sm font-medium transition"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      В корзину
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add item modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-background">
              <h2 className="font-semibold">Добавить позицию в маркетплейс</h2>
              <button onClick={() => { setShowAddForm(false); setAddError('') }} className="p-1.5 hover:bg-accent rounded-lg transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Название *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Дисплей iPhone 14 Pro OLED" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Категория *</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background">
                    {CATEGORIES.filter(c => c.key).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Артикул</label>
                  <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="APL-14P-DISP" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Цена (₽) *</label>
                  <input type="number" min="0" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="4200" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Старая цена (₽)</label>
                  <input type="number" min="0" value={form.oldPrice || ''} onChange={e => setForm(f => ({ ...f, oldPrice: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="5800" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Поставщик *</label>
                <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Опт ФМ (Иваново)" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Сайт поставщика</label>
                <input type="url" value={form.supplierUrl} onChange={e => setForm(f => ({ ...f, supplierUrl: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://optfm.ru" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Бренд</label>
                  <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Apple" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Срок доставки</label>
                  <input value={form.delivery} onChange={e => setForm(f => ({ ...f, delivery: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="2-3 дня" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="inStock" checked={form.inStock} onChange={e => setForm(f => ({ ...f, inStock: e.target.checked }))} className="w-4 h-4 text-blue-600" />
                <label htmlFor="inStock" className="text-sm">В наличии у поставщика</label>
              </div>
              {addError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{addError}</div>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowAddForm(false); setAddError('') }} className="flex-1 py-2.5 border rounded-lg text-sm hover:bg-accent transition">Отмена</button>
                <button type="submit" disabled={addingSaving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
                  {addingSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
