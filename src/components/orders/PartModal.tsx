'use client'
import { useState, useRef } from 'react'
import { X, Search, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

interface PartEntry {
  productId?: string
  name: string
  quantity: number
  cost: number
  price: number
}

interface PartModalProps {
  onAdd: (part: PartEntry, addMore: boolean) => void
  onClose: () => void
}

interface ProductResult {
  _id: string
  name: string
  sku?: string
  quantity: number
  cost: number
  price: number
}

export default function PartModal({ onAdd, onClose }: PartModalProps) {
  const [tab, setTab] = useState<'warehouse' | 'manual'>('warehouse')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  // Manual form
  const [manualName, setManualName] = useState('')
  const [manualQty, setManualQty] = useState('1')
  const [manualCost, setManualCost] = useState('')
  const [manualPrice, setManualPrice] = useState('')

  const searchRef = useRef<HTMLInputElement>(null)

  const { data: products = [], isFetching } = useQuery<ProductResult[]>({
    queryKey: ['warehouse-search', search],
    queryFn: async () => {
      if (!search.trim()) return []
      const res = await fetch(`/api/warehouse?search=${encodeURIComponent(search)}&productType=part`)
      const json = await res.json()
      return json.data ?? []
    },
    enabled: search.trim().length > 0,
  })

  function addFromWarehouse(product: ProductResult, addMore: boolean) {
    onAdd({
      productId: product._id,
      name: product.name,
      quantity: 1,
      cost: product.cost,
      price: product.price,
    }, addMore)
    if (addMore) {
      setSearch('')
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }

  function addManual(addMore: boolean) {
    if (!manualName.trim()) { setError('Укажите название'); return }
    const qty = parseInt(manualQty) || 1
    const price = parseFloat(manualPrice)
    if (!manualPrice || isNaN(price) || price < 0) { setError('Укажите корректную цену'); return }
    setError('')
    onAdd({
      name: manualName.trim(),
      quantity: qty,
      cost: parseFloat(manualCost) || 0,
      price,
    }, addMore)
    if (addMore) {
      setManualName(''); setManualQty('1'); setManualCost(''); setManualPrice('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">Добавить запчасть</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-5">
          <button
            type="button"
            onClick={() => setTab('warehouse')}
            className={`py-2.5 px-1 mr-4 text-sm font-medium border-b-2 transition-colors ${tab === 'warehouse' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Со склада
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`py-2.5 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Вручную
          </button>
        </div>

        <div className="p-5">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}

          {tab === 'warehouse' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по названию, артикулу, штрихкоду..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
                {isFetching && (
                  <div className="py-6 text-center text-sm text-muted-foreground">Поиск...</div>
                )}
                {!isFetching && search.trim() && products.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Ничего не найдено
                    <button type="button" onClick={() => setTab('manual')} className="block mx-auto mt-2 text-blue-600 hover:underline">
                      Добавить вручную
                    </button>
                  </div>
                )}
                {!isFetching && !search.trim() && (
                  <div className="py-6 text-center text-sm text-muted-foreground">Начните вводить для поиска</div>
                )}
                {products.map(p => (
                  <div key={p._id} className="flex items-center justify-between px-3 py-2.5 hover:bg-accent/50">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku && <span className="mr-2">арт. {p.sku}</span>}
                        <span className={p.quantity <= 0 ? 'text-red-500' : 'text-green-600'}>
                          {p.quantity <= 0 ? 'Нет в наличии' : `${p.quantity} шт.`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <span className="text-sm font-medium">{p.price.toLocaleString('ru-RU')} ₽</span>
                      <button
                        type="button"
                        onClick={() => addFromWarehouse(p, true)}
                        className="p-1.5 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-blue-600"
                        title="Добавить ещё"
                      >
                        <Package className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => addFromWarehouse(p, false)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Готово
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Название *</label>
                <input
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="Дисплей в сборе, Аккумулятор..."
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Кол-во</label>
                  <input
                    value={manualQty}
                    onChange={e => setManualQty(e.target.value)}
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Себест. ₽</label>
                  <input
                    value={manualCost}
                    onChange={e => setManualCost(e.target.value)}
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Цена ₽ *</label>
                  <input
                    value={manualPrice}
                    onChange={e => setManualPrice(e.target.value)}
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {tab === 'manual' && (
          <div className="flex gap-2 px-5 py-4 border-t">
            <button
              type="button"
              onClick={() => addManual(true)}
              className="flex-1 py-2 text-sm font-medium border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Сохранить и ещё
            </button>
            <button
              type="button"
              onClick={() => addManual(false)}
              className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Готово
            </button>
          </div>
        )}
        {tab === 'warehouse' && (
          <div className="px-5 py-4 border-t">
            <button type="button" onClick={onClose} className="w-full py-2 text-sm font-medium border rounded-lg hover:bg-accent transition-colors">
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
