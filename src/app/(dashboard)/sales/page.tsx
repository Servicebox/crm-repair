'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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

type CatalogItem = {
  _id: string
  name: string
  price: number
  category?: string
  quantity?: number
}

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Наличные', icon: Banknote },
  { key: 'card', label: 'Карта', icon: CreditCard },
  { key: 'qr', label: 'QR / СБП', icon: QrCode },
] as const

export default function SalesPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'products' | 'services'>('products')
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [clientName, setClientName] = useState('')
  const [globalDiscount, setGlobalDiscount] = useState<number | ''>('')
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const [saleError, setSaleError] = useState('')
  const [lastSaleId, setLastSaleId] = useState(`S-${String(Math.floor(Math.random() * 9000) + 1000)}`)
  const queryClient = useQueryClient()

  const { data: products = [], isLoading: productsLoading } = useQuery<CatalogItem[]>({
    queryKey: ['warehouse-products-sale'],
    queryFn: async () => {
      const res = await fetch('/api/warehouse?productType=product')
      const json = await res.json()
      return json.data ?? []
    },
  })

  const { data: services = [], isLoading: servicesLoading } = useQuery<CatalogItem[]>({
    queryKey: ['services-sale'],
    queryFn: async () => {
      const res = await fetch('/api/services')
      const json = await res.json()
      return json.data ?? []
    },
  })

  const catalog: CatalogItem[] = tab === 'products' ? products : services
  const isLoading = tab === 'products' ? productsLoading : servicesLoading

  const filtered = catalog.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  function addToCart(item: CatalogItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item._id)
      if (existing) return prev.map(c => c.id === item._id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { id: item._id, name: item.name, price: item.price, qty: 1, type: tab === 'products' ? 'product' : 'service', discount: 0 }]
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

  const gDiscount = Number(globalDiscount) || 0
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty * (1 - c.discount / 100), 0)
  const total = subtotal * (1 - gDiscount / 100)

  async function handleSale() {
    if (cart.length === 0) return
    setProcessing(true)
    setSaleError('')
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          payMethod,
          clientName: clientName || undefined,
          globalDiscount: Number(globalDiscount) || 0,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSaleError(json.error ?? 'Ошибка оформления продажи')
        return
      }
      setLastSaleId(json.data?.saleNumber ?? lastSaleId)
      queryClient.invalidateQueries({ queryKey: ['warehouse-products-sale'] })
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      setDone(true)
    } catch {
      setSaleError('Ошибка сети. Попробуйте ещё раз.')
    } finally {
      setProcessing(false)
    }
  }

  function resetSale() {
    setCart([])
    setClientName('')
    setGlobalDiscount('')
    setDone(false)
    setPayMethod('cash')
  }

  function printReceipt() {
    const payLabel = payMethod === 'cash' ? 'Наличные' : payMethod === 'card' ? 'Карта' : 'QR/СБП'
    const receiptHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Чек #${lastSaleId}</title>
<style>
body{font-family:monospace;font-size:12px;width:300px;margin:0 auto;padding:10px}
h2{text-align:center;font-size:14px;margin:0 0 4px}
.dv{border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between;margin:3px 0}
.tot{font-weight:bold;font-size:14px}
.c{text-align:center}
.sm{font-size:10px;color:#555}
</style></head><body>
<h2>SERVICE BOX</h2>
<div class="c sm">Сервисный центр</div>
<div class="dv"></div>
<div class="row"><span>Чек #${lastSaleId}</span><span>${new Date().toLocaleString('ru')}</span></div>
${clientName ? `<div class="sm">Клиент: ${clientName}</div>` : ''}
<div class="dv"></div>
${cart.map(item => `<div class="row"><span>${item.name} x${item.qty}</span><span>${Math.round(item.price * item.qty * (1 - item.discount / 100)).toLocaleString('ru')} ₽</span></div>${item.discount > 0 ? `<div class="sm row"><span>  скидка ${item.discount}%</span></div>` : ''}`).join('')}
<div class="dv"></div>
${gDiscount > 0 ? `<div class="row"><span>Скидка на чек:</span><span>-${gDiscount}%</span></div>` : ''}
<div class="row tot"><span>ИТОГО:</span><span>${Math.round(total).toLocaleString('ru')} ₽</span></div>
<div class="row"><span>Оплата:</span><span>${payLabel}</span></div>
<div class="dv"></div>
<div class="c sm">Спасибо за покупку!</div>
</body></html>`
    const win = window.open('', '_blank', 'width=420,height=600')
    if (!win) return
    win.document.write(receiptHtml)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

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
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
              {search ? 'Ничего не найдено' : tab === 'products' ? 'Нет товаров на складе' : 'Нет услуг'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(item => {
                const inCart = cart.find(c => c.id === item._id)
                return (
                  <button
                    key={item._id}
                    onClick={() => addToCart(item)}
                    className={cn(
                      'relative text-left border rounded-xl p-3 transition hover:shadow-sm active:scale-95',
                      inCart ? 'border-blue-400 bg-blue-50' : 'bg-card hover:border-blue-200'
                    )}
                  >
                    <div className="text-sm font-medium leading-tight mb-1">{item.name}</div>
                    <div className="text-base font-bold text-blue-600">{item.price.toLocaleString('ru')} ₽</div>
                    {tab === 'products' && item.quantity !== undefined && (
                      <div className="text-xs text-muted-foreground mt-0.5">В наличии: {item.quantity}</div>
                    )}
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {inCart.qty}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
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
                  {Math.round(item.price * item.qty * (1 - item.discount / 100)).toLocaleString('ru')} ₽
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
                value={globalDiscount}
                onChange={e => setGlobalDiscount(e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value))))}
                placeholder="0"
                className="w-16 px-2 py-1 border rounded text-sm text-center outline-none focus:ring-1 focus:ring-blue-400"
                min={0} max={100}
              />
            </div>
          )}

          <div className="flex justify-between text-lg font-bold">
            <span>Итого:</span>
            <span className="text-blue-600">{Math.round(total).toLocaleString('ru')} ₽</span>
          </div>

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

          {saleError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs mb-2">
              {saleError}
            </div>
          )}

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
                <button onClick={printReceipt} className="flex-1 text-xs border py-2 rounded-lg hover:bg-accent transition">
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
