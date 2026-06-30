'use client'
import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShoppingBag, Plus, Search, Trash2, CreditCard, Banknote, QrCode,
  Loader2, CheckCircle, X, Package, Wrench, Percent, ArrowDownLeft,
  Play, Square, AlertTriangle, Clock, ShoppingCart, ChevronLeft,
  ArrowUpRight, Receipt, Minus, Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

type PayMethod = 'cash' | 'card' | 'qr'
type CatalogTab = 'products' | 'services'
type MobileView = 'catalog' | 'cart'
type ModalType = 'open-shift' | 'close-shift' | 'withdraw' | null

interface CartItem {
  id: string
  name: string
  price: number
  cost: number
  qty: number
  type: 'product' | 'service'
  discount: number
  vatRate: '0' | '10' | '20' | 'no_vat'
}

interface CatalogItem {
  _id: string
  name: string
  price: number
  cost?: number
  category?: string
  quantity?: number
  sku?: string
}

interface CashWithdrawal {
  _id: string
  amount: number
  reason: string
  withdrawnAt: string
}

interface ActiveShift {
  _id: string
  openedAt: string
  status: 'open' | 'closed'
  openCashAmount: number
  closeCashAmount?: number
  cashDiscrepancy?: number
  cashWithdrawals: CashWithdrawal[]
  notes?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { key: 'cash' as PayMethod, label: 'Наличные', icon: Banknote },
  { key: 'card' as PayMethod, label: 'Карта', icon: CreditCard },
  { key: 'qr' as PayMethod, label: 'QR/СБП', icon: QrCode },
]

const VAT_OPTIONS = [
  { value: 'no_vat', label: 'Без НДС' },
  { value: '0', label: 'НДС 0%' },
  { value: '10', label: 'НДС 10%' },
  { value: '20', label: 'НДС 20%' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsedLabel(openedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} мин`
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

function fmt(n: number) { return Math.round(n).toLocaleString('ru') }

// ── Main component ────────────────────────────────────────────────────────────

export default function SalesPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  // Layout state
  const [mobileView, setMobileView] = useState<MobileView>('catalog')
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('products')
  const [search, setSearch] = useState('')

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [clientName, setClientName] = useState('')
  const [globalDiscount, setGlobalDiscount] = useState<number | ''>('')
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [processing, setProcessing] = useState(false)
  const [saleError, setSaleError] = useState('')
  const [lastSaleId, setLastSaleId] = useState('')
  const [saleDone, setSaleDone] = useState(false)

  // Shift / modal state
  const [modal, setModal] = useState<ModalType>(null)
  const [openCash, setOpenCash] = useState<number | ''>('')
  const [openNotes, setOpenNotes] = useState('')
  const [closeCash, setCloseCash] = useState<number | ''>('')
  const [closeNotes, setCloseNotes] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState<number | ''>('')
  const [withdrawReason, setWithdrawReason] = useState('')
  const [shiftError, setShiftError] = useState('')

  const role = session?.user?.role ?? ''
  const canManageCash = role === 'owner' || role === 'admin' || role === 'manager'

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: activeShift, isLoading: shiftLoading } = useQuery<ActiveShift | null>({
    queryKey: ['active-shift'],
    queryFn: async () => {
      const res = await fetch('/api/shifts/active')
      const json = await res.json()
      return json.data ?? null
    },
    refetchInterval: 60000,
    enabled: !!session,
  })

  const { data: products = [], isLoading: productsLoading } = useQuery<CatalogItem[]>({
    queryKey: ['catalog-products'],
    queryFn: async () => {
      const res = await fetch('/api/warehouse?productType=product&isActive=true')
      const json = await res.json()
      return (json.data ?? []).filter((p: CatalogItem & { quantity?: number }) => (p.quantity ?? 0) > 0)
    },
  })

  const { data: services = [], isLoading: servicesLoading } = useQuery<CatalogItem[]>({
    queryKey: ['catalog-services'],
    queryFn: async () => {
      const res = await fetch('/api/services')
      const json = await res.json()
      return json.data ?? []
    },
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const openShiftMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/shifts/my', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openCashAmount: Number(openCash) || 0, notes: openNotes || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка открытия смены')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-shift'] })
      setModal(null)
      setOpenCash('')
      setOpenNotes('')
      setShiftError('')
    },
    onError: (e: Error) => setShiftError(e.message),
  })

  const closeShiftMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/shifts/my', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closeCashAmount: Number(closeCash) || 0,
          notes: closeNotes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка закрытия смены')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-shift'] })
      setModal(null)
      setCloseCash('')
      setCloseNotes('')
      setShiftError('')
    },
    onError: (e: Error) => setShiftError(e.message),
  })

  const withdrawMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/shifts/my/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(withdrawAmount), reason: withdrawReason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка изъятия')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-shift'] })
      setModal(null)
      setWithdrawAmount('')
      setWithdrawReason('')
      setShiftError('')
    },
    onError: (e: Error) => setShiftError(e.message),
  })

  // ── Cart logic ─────────────────────────────────────────────────────────────

  const catalog = catalogTab === 'products' ? products : services
  const isLoading = catalogTab === 'products' ? productsLoading : servicesLoading
  const filtered = catalog.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
      || (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function addToCart(item: CatalogItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item._id)
      if (existing) return prev.map(c => c.id === item._id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, {
        id: item._id,
        name: item.name,
        price: item.price,
        cost: item.cost ?? 0,
        qty: 1,
        type: catalogTab === 'products' ? 'product' : 'service',
        discount: 0,
        vatRate: 'no_vat',
      }]
    })
  }

  function removeFromCart(id: string) {
    setCart(p => p.filter(c => c.id !== id))
  }

  function updateQty(id: string, qty: number) {
    if (qty < 1) { removeFromCart(id); return }
    setCart(p => p.map(c => c.id === id ? { ...c, qty } : c))
  }

  function updateDiscount(id: string, val: number) {
    setCart(p => p.map(c => c.id === id ? { ...c, discount: Math.max(0, Math.min(100, val)) } : c))
  }

  function updateVat(id: string, vatRate: CartItem['vatRate']) {
    setCart(p => p.map(c => c.id === id ? { ...c, vatRate } : c))
  }

  const gDiscount = Number(globalDiscount) || 0
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty * (1 - c.discount / 100), 0)
  const total = subtotal * (1 - gDiscount / 100)

  // VAT breakdown
  const vatBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of cart) {
      const lineTotal = c.price * c.qty * (1 - c.discount / 100) * (1 - gDiscount / 100)
      if (c.vatRate === 'no_vat' || c.vatRate === '0') continue
      const rate = Number(c.vatRate)
      const vatAmt = lineTotal * rate / (100 + rate)
      map[c.vatRate] = (map[c.vatRate] ?? 0) + vatAmt
    }
    return map
  }, [cart, gDiscount])

  async function handleSale() {
    if (cart.length === 0) return
    setProcessing(true)
    setSaleError('')
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(c => ({
            id: c.id, name: c.name, price: c.price, qty: c.qty,
            type: c.type, discount: c.discount, vatRate: c.vatRate,
          })),
          payMethod,
          clientName: clientName || undefined,
          globalDiscount: gDiscount,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setSaleError(json.error ?? 'Ошибка оформления'); return }
      setLastSaleId(json.data?.saleNumber ?? '')
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] })
      setSaleDone(true)
    } catch { setSaleError('Ошибка сети. Повторите попытку.') }
    finally { setProcessing(false) }
  }

  function resetSale() {
    setCart([]); setClientName(''); setGlobalDiscount(''); setSaleDone(false); setSaleError('')
  }

  function printReceipt() {
    const payLabel = payMethod === 'cash' ? 'Наличные' : payMethod === 'card' ? 'Банковская карта' : 'QR / СБП'
    const now = new Date().toLocaleString('ru')
    const vatLines = Object.entries(vatBreakdown).map(([rate, amt]) =>
      `<div class="row"><span>В т.ч. НДС ${rate}%:</span><span>${fmt(amt)} ₽</span></div>`
    ).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Чек #${lastSaleId}</title>
<style>body{font-family:monospace;font-size:12px;max-width:320px;margin:0 auto;padding:12px}
h2{text-align:center;margin:0 0 2px;font-size:13px}
.dv{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;margin:2px 0}
.tot{font-weight:bold;font-size:14px}.c{text-align:center}.sm{font-size:10px;color:#555}
.item{margin:3px 0}.item-name{font-weight:500}
</style></head><body>
<h2>SERVICE BOX</h2>
<div class="c sm">Сервисный центр</div>
<div class="dv"></div>
<div class="row"><span>Чек #${lastSaleId}</span><span>${now}</span></div>
${clientName ? `<div class="sm">Клиент: ${clientName}</div>` : ''}
<div class="dv"></div>
${cart.map(i => {
  const lineTotal = i.price * i.qty * (1 - i.discount / 100) * (1 - gDiscount / 100)
  const vatLbl = i.vatRate === 'no_vat' ? 'Без НДС' : `НДС ${i.vatRate}%`
  return `<div class="item">
  <div class="item-name">${i.name}</div>
  <div class="row sm"><span>${i.price.toLocaleString('ru')} ₽ × ${i.qty}${i.discount > 0 ? `, скидка ${i.discount}%` : ''}</span><span>${vatLbl}</span></div>
  <div class="row"><span></span><span>${fmt(lineTotal)} ₽</span></div>
</div>`}).join('')}
<div class="dv"></div>
${gDiscount > 0 ? `<div class="row"><span>Скидка на чек:</span><span>-${gDiscount}%</span></div>` : ''}
${vatLines}
<div class="row tot"><span>ИТОГО:</span><span>${fmt(total)} ₽</span></div>
<div class="row"><span>Оплата:</span><span>${payLabel}</span></div>
<div class="dv"></div>
<div class="c sm">Спасибо за покупку!</div>
<div class="c sm">Товарный чек (не является фискальным)</div>
</body></html>`
    const win = window.open('', '_blank', 'width=420,height=700')
    if (!win) return
    win.document.write(html); win.document.close(); win.focus(); win.print(); win.close()
  }

  // ── Shift calculations for close modal ────────────────────────────────────

  const totalWithdrawals = (activeShift?.cashWithdrawals ?? []).reduce((s, w) => s + w.amount, 0)

  const expectedClose = activeShift
    ? (activeShift.openCashAmount ?? 0) - totalWithdrawals // без учёта продаж (неизвестны на клиенте)
    : 0

  const discrepancy = closeCash !== '' ? Number(closeCash) - expectedClose : null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Shift bar ── */}
      <div className={cn(
        'shrink-0 border-b px-3 py-2 flex items-center gap-3 flex-wrap',
        activeShift ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      )}>
        {shiftLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : activeShift ? (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 border border-green-300 px-2 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Смена открыта
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                {elapsedLabel(activeShift.openedAt)}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                <Banknote className="w-3 h-3" />
                Открытие: {formatCurrency(activeShift.openCashAmount ?? 0)}
              </span>
              {totalWithdrawals > 0 && (
                <span className="text-xs text-orange-600 hidden sm:flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  Изъято: {formatCurrency(totalWithdrawals)}
                </span>
              )}
            </div>
            {canManageCash && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setModal('withdraw'); setShiftError('') }}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-100 transition font-medium"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Изъятие
                </button>
                <button
                  onClick={() => { setModal('close-shift'); setShiftError('') }}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-red-100 border border-red-300 text-red-700 hover:bg-red-200 transition font-medium"
                >
                  <Square className="w-3.5 h-3.5" />
                  Закрыть смену
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs text-amber-800 font-medium">Смена не открыта</span>
              <span className="text-xs text-muted-foreground hidden sm:block">
                — откройте смену, чтобы вести учёт кассы
              </span>
            </div>
            {canManageCash && (
              <button
                onClick={() => { setModal('open-shift'); setShiftError('') }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition font-medium shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                Открыть смену
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Mobile tab bar ── */}
      <div className="md:hidden shrink-0 flex border-b bg-background">
        <button
          onClick={() => setMobileView('catalog')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition',
            mobileView === 'catalog' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-muted-foreground'
          )}
        >
          <Package className="w-4 h-4" />
          Каталог
        </button>
        <button
          onClick={() => setMobileView('cart')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition relative',
            mobileView === 'cart' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-muted-foreground'
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          Чек
          {cart.length > 0 && (
            <span className="absolute top-1.5 right-6 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {cart.reduce((s, c) => s + c.qty, 0)}
            </span>
          )}
        </button>
      </div>

      {/* ── Main panels ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Catalog panel */}
        <div className={cn(
          'flex flex-col overflow-hidden',
          'flex-1 min-w-0',
          mobileView === 'cart' ? 'hidden md:flex' : 'flex'
        )}>
          {/* Catalog header */}
          <div className="shrink-0 p-3 border-b space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => { setCatalogTab('products'); setSearch('') }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition border',
                  catalogTab === 'products'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-border hover:bg-accent'
                )}
              >
                <Package className="w-4 h-4" />
                Товары
                {products.length > 0 && (
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    catalogTab === 'products' ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                  )}>{products.length}</span>
                )}
              </button>
              <button
                onClick={() => { setCatalogTab('services'); setSearch('') }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition border',
                  catalogTab === 'services'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-border hover:bg-accent'
                )}
              >
                <Wrench className="w-4 h-4" />
                Услуги
                {services.length > 0 && (
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    catalogTab === 'services' ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                  )}>{services.length}</span>
                )}
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={catalogTab === 'products' ? 'Поиск по названию, артикулу...' : 'Поиск услуги...'}
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Catalog grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                {search ? `Ничего не найдено по «${search}»` : catalogTab === 'products' ? 'Нет товаров в наличии' : 'Нет услуг'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {filtered.map(item => {
                  const inCart = cart.find(c => c.id === item._id)
                  const outOfStock = catalogTab === 'products' && (item.quantity ?? 0) === 0
                  return (
                    <button
                      key={item._id}
                      onClick={() => !outOfStock && addToCart(item)}
                      disabled={outOfStock}
                      className={cn(
                        'relative text-left border rounded-xl p-3 transition active:scale-95 flex flex-col',
                        outOfStock ? 'opacity-40 cursor-not-allowed' :
                        inCart ? 'border-blue-400 bg-blue-50 shadow-sm' :
                        'bg-card hover:border-blue-200 hover:shadow-sm'
                      )}
                    >
                      <div className="text-sm font-medium leading-tight mb-1 flex-1">{item.name}</div>
                      {item.sku && <div className="text-[10px] text-muted-foreground mb-1">{item.sku}</div>}
                      <div className="text-base font-bold text-blue-600">{formatCurrency(item.price)}</div>
                      {catalogTab === 'products' && item.quantity !== undefined && (
                        <div className={cn('text-[10px] mt-0.5', item.quantity <= 3 ? 'text-amber-600' : 'text-muted-foreground')}>
                          {item.quantity <= 0 ? 'Нет в наличии' : `В наличии: ${item.quantity}`}
                        </div>
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

        {/* Cart panel */}
        <div className={cn(
          'flex flex-col bg-background border-l',
          'w-full md:w-80 lg:w-96 shrink-0',
          mobileView === 'catalog' ? 'hidden md:flex' : 'flex'
        )}>
          {/* Cart header */}
          <div className="shrink-0 p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                Чек
                {cart.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                    {cart.reduce((s, c) => s + c.qty, 0)} поз.
                  </span>
                )}
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-muted-foreground hover:text-red-500 transition flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Очистить
                </button>
              )}
            </div>
            <input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Имя / телефон клиента"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            />
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>Добавьте товар или услугу</p>
                <p className="text-xs mt-1">Нажмите на карточку в каталоге</p>
              </div>
            ) : (
              cart.map(item => {
                const lineTotal = item.price * item.qty * (1 - item.discount / 100)
                return (
                  <div key={item.id} className="border rounded-xl p-3 bg-card">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(item.price)} × {item.qty} шт.
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-muted-foreground hover:text-red-500 transition shrink-0 mt-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Qty */}
                      <div className="flex items-center border rounded-lg overflow-hidden shrink-0">
                        <button
                          onClick={() => updateQty(item.id, item.qty - 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-accent text-sm"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.id, item.qty + 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-accent text-sm"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Discount */}
                      <div className="flex items-center gap-1 border rounded-lg px-2 py-1 shrink-0">
                        <Percent className="w-3 h-3 text-muted-foreground" />
                        <input
                          type="number"
                          value={item.discount || ''}
                          onChange={e => updateDiscount(item.id, Number(e.target.value))}
                          placeholder="0"
                          className="w-10 text-sm text-center outline-none bg-transparent"
                          min={0} max={100}
                        />
                      </div>

                      {/* VAT */}
                      <select
                        value={item.vatRate}
                        onChange={e => updateVat(item.id, e.target.value as CartItem['vatRate'])}
                        className="flex-1 min-w-0 px-2 py-1 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400 bg-background"
                      >
                        {VAT_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-muted-foreground">
                        {item.discount > 0 ? `скидка ${item.discount}%` : ''}
                      </span>
                      <span className="text-sm font-bold">
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Cart footer */}
          <div className="shrink-0 border-t p-3 space-y-3">
            {/* Global discount */}
            {cart.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  Скидка на чек
                </span>
                <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
                  <input
                    type="number"
                    value={globalDiscount}
                    onChange={e => setGlobalDiscount(e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value))))}
                    placeholder="0"
                    className="w-12 text-sm text-center outline-none bg-transparent"
                    min={0} max={100}
                  />
                  <Percent className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* VAT breakdown */}
            {Object.keys(vatBreakdown).length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                {Object.entries(vatBreakdown).map(([rate, amt]) => (
                  <div key={rate} className="flex justify-between">
                    <span>В т.ч. НДС {rate}%</span>
                    <span>{formatCurrency(amt)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-base font-semibold">Итого</span>
              <span className="text-xl font-bold text-blue-600">{formatCurrency(total)}</span>
            </div>

            {/* Payment methods */}
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setPayMethod(m.key)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 border rounded-xl text-xs font-medium transition',
                    payMethod === m.key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'hover:bg-accent'
                  )}
                >
                  <m.icon className="w-4 h-4" />
                  {m.label}
                </button>
              ))}
            </div>

            {/* Error */}
            {saleError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                {saleError}
              </div>
            )}

            {/* Checkout */}
            {!saleDone ? (
              <button
                onClick={handleSale}
                disabled={cart.length === 0 || processing}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition',
                  cart.length > 0
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                {processing ? 'Оформляем...' : `Принять оплату · ${formatCurrency(total)}`}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-2 text-green-600 font-semibold text-sm">
                  <CheckCircle className="w-5 h-5" />
                  Продажа оформлена!
                </div>
                {lastSaleId && (
                  <div className="text-xs text-center text-muted-foreground">Чек № {lastSaleId}</div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={printReceipt}
                    className="flex items-center justify-center gap-1.5 text-xs border py-2 rounded-lg hover:bg-accent transition"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Печать чека
                  </button>
                  <button
                    onClick={resetSale}
                    className="flex items-center justify-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Новая продажа
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setModal(null); setShiftError('') } }}
        >
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md">

            {/* Open shift modal */}
            {modal === 'open-shift' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Play className="w-5 h-5 text-green-600" />
                    Открытие смены
                  </h3>
                  <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      Наличных в кассе при открытии, ₽
                    </label>
                    <input
                      type="number"
                      value={openCash}
                      onChange={e => setOpenCash(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      min={0}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Пересчитайте наличные и введите сумму. Это остаток от прошлой смены или первоначальный капитал.
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Примечание (необязательно)</label>
                    <input
                      type="text"
                      value={openNotes}
                      onChange={e => setOpenNotes(e.target.value)}
                      placeholder="Комментарий к открытию"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {shiftError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {shiftError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setModal(null); setShiftError('') }}
                    className="flex-1 py-2.5 border rounded-lg text-sm hover:bg-accent transition"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => openShiftMut.mutate()}
                    disabled={openShiftMut.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                  >
                    {openShiftMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Открыть смену
                  </button>
                </div>
              </div>
            )}

            {/* Close shift modal */}
            {modal === 'close-shift' && activeShift && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Square className="w-5 h-5 text-red-600" />
                    Закрытие смены
                  </h3>
                  <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Shift summary */}
                <div className="bg-muted/50 rounded-xl p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Смена открыта</span>
                    <span>{new Date(activeShift.openedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Наличных при открытии</span>
                    <span className="font-medium">{formatCurrency(activeShift.openCashAmount ?? 0)}</span>
                  </div>
                  {totalWithdrawals > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Изъято за смену ({activeShift.cashWithdrawals.length} оп.)</span>
                      <span className="font-medium">− {formatCurrency(totalWithdrawals)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span className="text-muted-foreground">Должно быть в кассе (без продаж)</span>
                    <span>{formatCurrency(expectedClose)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      Фактически наличных в кассе, ₽
                    </label>
                    <input
                      type="number"
                      value={closeCash}
                      onChange={e => setCloseCash(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      min={0}
                      autoFocus
                    />
                  </div>

                  {/* Discrepancy indicator */}
                  {discrepancy !== null && (
                    <div className={cn(
                      'rounded-lg px-3 py-2.5 text-sm font-medium flex items-center justify-between',
                      Math.abs(discrepancy) < 1 ? 'bg-green-50 text-green-700 border border-green-200' :
                      discrepancy > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-red-50 text-red-700 border border-red-200'
                    )}>
                      <span>Расхождение</span>
                      <span className="font-bold">
                        {discrepancy > 0 ? '+' : ''}{formatCurrency(discrepancy)}
                        {Math.abs(discrepancy) < 1 && ' ✓'}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium block mb-1">Примечание</label>
                    <input
                      type="text"
                      value={closeNotes}
                      onChange={e => setCloseNotes(e.target.value)}
                      placeholder="Итоги смены, комментарии..."
                      className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Withdrawal history */}
                {activeShift.cashWithdrawals.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Изъятия за смену</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {activeShift.cashWithdrawals.map(w => (
                        <div key={w._id} className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate">{w.reason}</span>
                          <span className="font-medium text-orange-600 shrink-0 ml-2">− {formatCurrency(w.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {shiftError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {shiftError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setModal(null); setShiftError('') }}
                    className="flex-1 py-2.5 border rounded-lg text-sm hover:bg-accent transition"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => closeShiftMut.mutate()}
                    disabled={closeShiftMut.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                  >
                    {closeShiftMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Закрыть смену
                  </button>
                </div>
              </div>
            )}

            {/* Withdraw cash modal */}
            {modal === 'withdraw' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <ArrowDownLeft className="w-5 h-5 text-orange-600" />
                    Изъятие из кассы
                  </h3>
                  <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {activeShift && (
                  <div className="bg-muted/50 rounded-xl p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Наличных при открытии</span>
                      <span className="font-medium">{formatCurrency(activeShift.openCashAmount ?? 0)}</span>
                    </div>
                    {totalWithdrawals > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Ранее изъято</span>
                        <span>− {formatCurrency(totalWithdrawals)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Сумма изъятия, ₽ *</label>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      min={1}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Причина / назначение *</label>
                    <input
                      type="text"
                      value={withdrawReason}
                      onChange={e => setWithdrawReason(e.target.value)}
                      placeholder="Напр.: оплата поставщику, хозяйственные нужды..."
                      className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {shiftError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {shiftError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setModal(null); setShiftError('') }}
                    className="flex-1 py-2.5 border rounded-lg text-sm hover:bg-accent transition"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => withdrawMut.mutate()}
                    disabled={withdrawMut.isPending || !withdrawAmount || !withdrawReason.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                  >
                    {withdrawMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Изъять {withdrawAmount ? formatCurrency(Number(withdrawAmount)) : ''}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
