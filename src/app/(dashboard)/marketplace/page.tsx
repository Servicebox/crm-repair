'use client'
import { useState } from 'react'
import { Store, Search, Filter, ShoppingCart, Star, ExternalLink, Package, TrendingDown, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

type Category = 'all' | 'screens' | 'batteries' | 'charging' | 'cameras' | 'tools'

const CATEGORIES = [
  { key: 'all', label: 'Все' },
  { key: 'screens', label: 'Дисплеи' },
  { key: 'batteries', label: 'Аккумуляторы' },
  { key: 'charging', label: 'Зарядка' },
  { key: 'cameras', label: 'Камеры' },
  { key: 'tools', label: 'Инструменты' },
]

const PARTS = [
  { id: 1, name: 'Дисплей iPhone 14 Pro Max OLED', category: 'screens', price: 4200, oldPrice: 5800, supplier: 'Опт ФМ (Иваново)', rating: 4.8, reviews: 124, inStock: true, delivery: '2-3 дня', badge: 'Хит' },
  { id: 2, name: 'Аккумулятор iPhone 13 3227mAh', category: 'batteries', price: 890, oldPrice: 1200, supplier: 'Green Spark (Вологда)', rating: 4.6, reviews: 87, inStock: true, delivery: '1-2 дня', badge: 'Оригинал' },
  { id: 3, name: 'Дисплей Samsung Galaxy S23 AMOLED', category: 'screens', price: 5600, supplier: 'Моба (Архангельск)', rating: 4.7, reviews: 56, inStock: true, delivery: '3-4 дня' },
  { id: 4, name: 'Разъём зарядки iPhone 15 USB-C', category: 'charging', price: 320, supplier: '05gsm', rating: 4.5, reviews: 34, inStock: true, delivery: '1-2 дня' },
  { id: 5, name: 'Аккумулятор Samsung S21 5000mAh', category: 'batteries', price: 1100, supplier: 'Опт ФМ (Иваново)', rating: 4.4, reviews: 41, inStock: false, delivery: '3-5 дней' },
  { id: 6, name: 'Дисплей Xiaomi Redmi Note 12', category: 'screens', price: 1800, supplier: 'Green Spark (Вологда)', rating: 4.3, reviews: 28, inStock: true, delivery: '2-3 дня' },
  { id: 7, name: 'Набор отвёрток iFixit Pro Tech', category: 'tools', price: 3400, supplier: 'Моба (Архангельск)', rating: 4.9, reviews: 203, inStock: true, delivery: '4-5 дней', badge: 'Топ' },
  { id: 8, name: 'Камера основная iPhone 14', category: 'cameras', price: 2800, supplier: 'Опт ФМ (Иваново)', rating: 4.6, reviews: 19, inStock: true, delivery: '2-3 дня' },
  { id: 9, name: 'Разъём зарядки Samsung Type-C', category: 'charging', price: 280, supplier: '05gsm', rating: 4.2, reviews: 67, inStock: true, delivery: '1 день' },
  { id: 10, name: 'Аккумулятор MacBook Pro 13" A2338', category: 'batteries', price: 4900, oldPrice: 6200, supplier: 'Green Spark (Вологда)', rating: 4.7, reviews: 45, inStock: true, delivery: '2-3 дня', badge: 'Скидка' },
  { id: 11, name: 'Термопаста Arctic MX-4 4г', category: 'tools', price: 280, supplier: '05gsm', rating: 4.8, reviews: 312, inStock: true, delivery: '1 день' },
  { id: 12, name: 'Дисплей Huawei P50 Pro', category: 'screens', price: 6800, supplier: 'Моба (Архангельск)', rating: 4.5, reviews: 12, inStock: false, delivery: '5-7 дней' },
]

const SUPPLIERS = [
  { name: 'Опт ФМ', city: 'Иваново', rating: 4.8, orders: 0, delivery: '2-3 дня', url: 'https://optfm.ru' },
  { name: 'Green Spark', city: 'Вологда', rating: 4.6, orders: 0, delivery: '1-2 дня', url: '' },
  { name: 'Моба', city: 'Архангельск', rating: 4.5, orders: 0, delivery: '3-5 дней', url: '' },
  { name: '05gsm', city: '', rating: 4.7, orders: 0, delivery: '1-2 дня', url: 'https://05gsm.ru' },
]

export default function MarketplacePage() {
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('popular')
  const [cart, setCart] = useState<number[]>([])

  const filtered = PARTS.filter(p => {
    const matchCat = category === 'all' || p.category === category
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.supplier.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  }).sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price
    if (sort === 'price_desc') return b.price - a.price
    if (sort === 'rating') return b.rating - a.rating
    return b.reviews - a.reviews
  })

  function toggleCart(id: number) {
    setCart(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id])
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
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition relative">
          <ShoppingCart className="w-4 h-4" />
          Корзина
          {cart.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Package, label: 'Позиций', value: '12 400+' },
          { icon: Truck, label: 'Поставщиков', value: '38' },
          { icon: TrendingDown, label: 'Ср. экономия', value: '23%' },
          { icon: Star, label: 'Ср. рейтинг', value: '4.7' },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl px-3 py-3 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <s.icon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-48 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Дисплей iPhone 14, аккумулятор..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="popular">По популярности</option>
          <option value="rating">По рейтингу</option>
          <option value="price_asc">Дешевле</option>
          <option value="price_desc">Дороже</option>
        </select>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key as Category)}
            className={cn(
              'shrink-0 px-4 py-1.5 text-sm font-medium rounded-full border transition',
              category === c.key ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-accent'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {filtered.map(part => (
          <div key={part.id} className="bg-card border rounded-xl overflow-hidden hover:shadow-md transition group">
            <div className="h-36 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative">
              <Package className="w-12 h-12 text-slate-400" />
              {part.badge && (
                <span className={cn(
                  'absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full',
                  part.badge === 'Хит' ? 'bg-orange-500 text-white' :
                  part.badge === 'Топ' ? 'bg-purple-500 text-white' :
                  part.badge === 'Оригинал' ? 'bg-green-500 text-white' :
                  'bg-red-500 text-white'
                )}>
                  {part.badge}
                </span>
              )}
              {!part.inStock && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                  <span className="text-sm font-medium text-slate-500 bg-white px-2 py-1 rounded">Нет в наличии</span>
                </div>
              )}
            </div>
            <div className="p-3">
              <div className="text-xs text-muted-foreground mb-1">{part.supplier}</div>
              <div className="text-sm font-medium leading-tight mb-2 line-clamp-2">{part.name}</div>
              <div className="flex items-center gap-1 mb-2">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-xs font-medium">{part.rating}</span>
                <span className="text-xs text-muted-foreground">({part.reviews})</span>
                <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                  <Truck className="w-3 h-3" />{part.delivery}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <span className="font-bold text-base">{part.price.toLocaleString('ru')} ₽</span>
                  {part.oldPrice && (
                    <span className="text-xs text-muted-foreground line-through ml-1.5">{part.oldPrice.toLocaleString('ru')} ₽</span>
                  )}
                </div>
                <button
                  onClick={() => toggleCart(part.id)}
                  disabled={!part.inStock}
                  className={cn(
                    'text-xs font-medium px-3 py-1.5 rounded-lg transition',
                    cart.includes(part.id)
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : part.inStock
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {cart.includes(part.id) ? '✓ В корзине' : 'Купить'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Suppliers */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold">Рекомендуемые поставщики</h3>
        </div>
        <div className="divide-y">
          {SUPPLIERS.map(s => (
            <div key={s.name} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Store className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-sm">{s.name}{s.city && <span className="text-muted-foreground font-normal"> · {s.city}</span>}</div>
                  <div className="text-xs text-muted-foreground">Доставка: {s.delivery}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-sm">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="font-medium">{s.rating}</span>
                </div>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs border px-3 py-1.5 rounded-lg hover:bg-accent transition flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Открыть
                  </a>
                ) : (
                  <button className="text-xs border px-3 py-1.5 rounded-lg opacity-40 cursor-not-allowed flex items-center gap-1" disabled>
                    <ExternalLink className="w-3 h-3" />
                    Скоро
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
