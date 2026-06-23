'use client'
import { useState } from 'react'
import { ShoppingBag, Plus, Search, Trash2, CreditCard, Banknote, QrCode, Loader2, CheckCircle, X, Package, Wrench, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'

type PayMethod = 'cash' | 'card' | 'qr'

type CartItem = {
  id: string
  name: string
  price: number
  qty: number
  type: 'product' | 'service'
  discount: number
}

const CATALOG_PRODUCTS = [
  { id: 'p1', name: 'Защитное стекло iPhone 14/15', price: 350, type: 'product' as const },
  { id: 'p2', name: 'Чехол силиконовый Samsung S23', price: 450, type: 'product' as const },
  { id: 'p3', name: 'Кабель USB-C 1м', price: 290, type: 'product' as const },
  { id: 'p4', name: 'Зарядное устройство 20W', price: 890, type: 'product' as const },
  { id: 'p5', name: 'Беспроводное зарядное 15W', price: 1200, type: 'product' as const },
  { id: 'p6', name: 'Защитная плёнка универсальная', price: 150, type: 'product' as const },
  { id: 'p7', name: 'Power Bank 10000mAh', price: 1800, type: 'product' as const },
  { id: 'p8', name: 'Наушники TWS', price: 1500, type: 'product' as const },
]

const CATALOG_SERVICES = [
  { id: 's1', name: 'Чистка от пыли (ноутбук)', price: 800, type: 'service' as const },
  { id: 's2', name: 'Замена термопасты', price: 500, type: 'service' as const },
  { id: 's3', name: 'Диагностика устройства', price: 300, type: 'service' as const },
  { id: 's4', name: 'Установка ПО / Windows', price: 1200, type: 'service' as const },
  { id: 's5', name: 'Настройка роутера', price: 600, type: 'service' as const },
  { id: 's6', name: 'Восстановление данных', price: 2000, type: 'service' as const },
  { id: 's7', name: 'Полировка экрана', price: 400, type: 'service' as const },
  { id: 's8', name: 'Настройка смартфона', price: 350, type: 'service' as const },
]

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Наличные', icon: Banknote },
  { key: 'card', label: 'Карта', icon: CreditCard },
  { key: 'qr', label: 'QR / СБП', icon: QrCode },
] as const

const RECENT_SALES = [
  { id: 'S-0041', client: 'Иванов И.', items: 3, total: 1890, method: 'card', time: '14:32' },
  { id: 'S-0040', client: 'Петрова М.', items: 1, total: 800, method: 'cash', time: '13:15' },
  { id: 'S-0039', client: '', items: 2, total: 640, method: 'qr', time: '11:48' },
  { id: 'S-0038', client: 'Сидоров А.', items: 4, total: 4200, method: 'card', time: '11:02' },
]

export default function SalesPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'products' | 'services'>('products')
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [clientName, setClientName] = useState('')
  const [globalDiscount, setGlobalDiscount] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)

  const catalog = tab === 'products' ? CATALOG_PRODUCTS : CATALOG_SERVICES

  const filtered = catalog.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  function addToCart(item: typeof CATALOG_PRODUCTS[0] | typeof CATALOG_SERVICES[0]) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1, discount: 0 }]
    })
  }

  function removeFromCart(id: string) {
    setCart(p => p.filter(c => c.id !== id))
  }

  function updateQty(id: string, qty: number) {
    if (qty < 1) { removeFromCart(id); return }
    setCart(p => p.map(c => c.id === id ? { ...c, qty } : c))
  }

  function updateItemDiscount(id: string, discount: number) {
    setCart(p => p.map(c => c.id === id ? { ...c, discount: Math.max(0, Math.min(100, discount)) } : c))
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty * (1 - c.discount / 100), 0)
  const total = subtotal * (1 - globalDiscount / 100)

  async function handleSale() {
    if (cart.length === 0) return
    setProcessing(true)
    await new Promise(r => setTimeout(r, 1200))
    setProcessing(false)
    setDone(true)
    setShowReceipt(true)
  }

  function resetSale() {
    setCart([])
    setClientName('')
    setGlobalDiscount(0)
    setDone(false)
    setShowReceipt(false)
    setPayMethod('cash')
  }

  const lastSaleId = `S-${String(42).padStart(4, '0')}`

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: catalog */}
      <div className="flex-1 flex flex-col min-w-0 border-r overflow-hidden">
        <div className="p-4 border-b shrink-0">
          <h1 className="text-lg font-bold flex items-center gap-2 mb-3">
            <ShoppingBag className="w-5 h-5 text-blue-500" />
            Касса / Продажи
          </h1>

          <div className="flex gap-2 mb-3">
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setTab('products')}
                className={cn('px-4 py-1.5 text-sm font-medium transition', tab === 'products' ? 'bg-blue-600 text-white' : 'hover:bg-accent')}
              >
                <Package className="w-4 h-4 inline mr-1" />
                Товары
              </button>
              <button
                onClick={() => setTab('services')}
                className={cn('px-4 py-1.5 text-sm font-medium transition', tab === 'services' ? 'bg-blue-600 text-white' : 'hover:bg-accent')}
              >
                <Wrench className="w-4 h-4 inline mr-1" />
                Услуги
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(item => {
              const inCart = cart.find(c => c.id === item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={cn(
                    'relative text-left border rounded-xl p-3 transition hover:shadow-sm active:scale-95',
                    inCart ? 'border-blue-400 bg-blue-50' : 'bg-card hover:border-blue-200'
                  )}
                >
                  <div className="text-sm font-medium leading-tight mb-1">{item.name}</div>
                  <div className="text-base font-bold text-blue-600">{item.price.toLocaleString('ru')} ₽</div>
                  {inCart && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {inCart.qty}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Recent sales */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Последние продажи сегодня</h3>
            <div className="space-y-1.5">
              {RECENT_SALES.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-card border rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{s.id}</span>
                    <span className="text-muted-foreground">{s.client || 'Анонимный'}</span>
                    <span className="text-xs text-muted-foreground">{s.items} поз.</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{s.total.toLocaleString('ru')} ₽</span>
                    <span className="text-muted-foreground">{s.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: cart */}
      <div className="w-80 shrink-0 flex flex-col bg-background">
        <div className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Чек</h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-muted-foreground hover:text-red-500 transition">
                Очистить
              </button>
            )}
          </div>
          <input
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="Имя клиента (необязательно)"
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-20" />
              Добавьте товар или услугу
            </div>
          )}
          {cart.map(item => (
            <div key={item.id} className="bg-card border rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 text-sm font-medium leading-tight">{item.name}</div>
                <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-red-500 transition shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-2 py-1 hover:bg-accent text-sm">−</button>
                  <span className="px-2 text-sm font-medium">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-2 py-1 hover:bg-accent text-sm">+</button>
                </div>
                <div className="flex items-center gap-1">
                  <Percent className="w-3 h-3 text-muted-foreground" />
                  <input
                    type="number"
                    value={item.discount || ''}
                    onChange={e => updateItemDiscount(item.id, Number(e.target.value))}
                    placeholder="0"
                    className="w-12 px-2 py-1 border rounded text-sm text-center outline-none focus:ring-1 focus:ring-blue-400"
                    min={0} max={100}
                  />
                </div>
                <div className="text-sm font-bold">
                  {(item.price * item.qty * (1 - item.discount / 100)).toLocaleString('ru')} ₽
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t shrink-0 space-y-3">
          {cart.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground shrink-0">Скидка на чек, %:</label>
              <input
                type="number"
                value={globalDiscount || ''}
                onChange={e => setGlobalDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                placeholder="0"
                className="w-16 px-2 py-1 border rounded text-sm text-center outline-none focus:ring-1 focus:ring-blue-400"
                min={0} max={100}
              />
            </div>
          )}

          <div className="flex justify-between text-lg font-bold">
            <span>Итого:</span>
            <span className="text-blue-600">{total.toLocaleString('ru', { maximumFractionDigits: 0 })} ₽</span>
          </div>

          {/* Payment method */}
          <div className="flex gap-2">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.key}
                onClick={() => setPayMethod(m.key)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-2 border rounded-xl text-xs font-medium transition',
                  payMethod === m.key ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-accent'
                )}
              >
                <m.icon className="w-4 h-4" />
                {m.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSale}
            disabled={cart.length === 0 || processing || done}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition',
              done ? 'bg-green-600 text-white' :
              cart.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' :
              'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {processing && <Loader2 className="w-4 h-4 animate-spin" />}
            {done ? <><CheckCircle className="w-4 h-4" />Продажа оформлена!</> : processing ? 'Обрабатываем...' : 'Оформить продажу'}
          </button>

          {done && (
            <div className="space-y-2">
              <div className="text-xs text-center text-muted-foreground">Чек #{lastSaleId} сформирован</div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="flex-1 text-xs border py-2 rounded-lg hover:bg-accent transition">
                  Печать чека
                </button>
                <button onClick={resetSale} className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 py-2 rounded-lg transition">
                  Новая продажа
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
