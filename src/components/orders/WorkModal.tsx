'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Search, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'

interface ServiceHit {
  _id: string
  name: string
  category?: string
  price: number
  cost?: number
  duration?: number
  warrantyDays?: number
}

export interface WorkEntry {
  name: string
  price: number
  discount?: number
  duration?: number
  cost?: number
  masterName?: string
}

interface WorkModalProps {
  onAdd: (work: WorkEntry, addMore: boolean) => void
  onClose: () => void
  masters?: { id: string; name: string }[]
  deviceType?: string
  defaultMasterName?: string
  initialValues?: Partial<WorkEntry>
  editMode?: boolean
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function WorkModal({
  onAdd, onClose, masters = [], deviceType,
  defaultMasterName, initialValues, editMode = false,
}: WorkModalProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [price, setPrice] = useState(initialValues?.price != null ? String(initialValues.price) : '')
  const [discount, setDiscount] = useState(initialValues?.discount != null ? String(initialValues.discount) : '')
  const [duration, setDuration] = useState(initialValues?.duration != null ? String(initialValues.duration) : '')
  const [cost, setCost] = useState(initialValues?.cost != null ? String(initialValues.cost) : '')
  const [masterName, setMasterName] = useState(
    initialValues?.masterName ?? defaultMasterName ?? ''
  )
  const [error, setError] = useState('')

  // Service catalog search
  const [searchQuery, setSearchQuery] = useState(initialValues?.name ?? '')
  const [showDropdown, setShowDropdown] = useState(false)
  const debouncedSearch = useDebounce(searchQuery, 300)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: services = [], isFetching } = useQuery<ServiceHit[]>({
    queryKey: ['service-search', debouncedSearch, deviceType],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (deviceType) params.set('deviceType', deviceType)
      const res = await fetch(`/api/services?${params}`)
      const json = await res.json()
      return json.data ?? []
    },
    enabled: debouncedSearch.length >= 1 || showDropdown,
    staleTime: 30_000,
  })

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function fillFromService(svc: ServiceHit) {
    setName(svc.name)
    setPrice(String(svc.price))
    if (svc.cost) setCost(String(svc.cost))
    if (svc.duration) setDuration(String(svc.duration))
    setSearchQuery(svc.name)
    setShowDropdown(false)
  }

  function validate(): WorkEntry | null {
    if (!name.trim()) { setError('Укажите наименование'); return null }
    const priceNum = parseFloat(price)
    if (!price || isNaN(priceNum) || priceNum < 0) { setError('Укажите корректную цену'); return null }
    setError('')
    return {
      name: name.trim(),
      price: priceNum,
      discount: discount ? parseFloat(discount) : undefined,
      duration: duration ? parseInt(duration) : undefined,
      cost: cost ? parseFloat(cost) : undefined,
      masterName: masterName || undefined,
    }
  }

  function handleSave(addMore: boolean) {
    const entry = validate()
    if (!entry) return
    onAdd(entry, addMore)
    if (addMore) {
      setName(''); setPrice(''); setDiscount(''); setDuration(''); setCost('')
      setSearchQuery('')
    }
  }

  const filteredServices = services.slice(0, 8)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">
            {editMode ? 'Редактировать работу' : 'Добавить работу'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          {/* Service catalog search */}
          <div ref={dropdownRef} className="relative">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Поиск по каталогу услуг</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Замена стекла, диагностика..."
                className="w-full pl-8 pr-8 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-xl shadow-lg overflow-hidden">
                {isFetching && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Поиск...</div>
                )}
                {!isFetching && filteredServices.length === 0 && debouncedSearch.length >= 1 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Ничего не найдено</div>
                )}
                {!isFetching && filteredServices.length === 0 && debouncedSearch.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Введите название услуги</div>
                )}
                {filteredServices.map(svc => (
                  <button
                    key={svc._id}
                    type="button"
                    onClick={() => fillFromService(svc)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent transition text-left border-b last:border-b-0"
                  >
                    <div>
                      <div className="text-sm font-medium">{svc.name}</div>
                      {svc.category && <div className="text-xs text-muted-foreground">{svc.category}</div>}
                    </div>
                    <span className="text-sm font-semibold text-blue-600 ml-3 shrink-0">
                      {formatCurrency(svc.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Наименование *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Или введите вручную"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Цена ₽ *</label>
              <input
                value={price}
                onChange={e => setPrice(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Скидка ₽</label>
              <input
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Длительность (мин)</label>
              <input
                value={duration}
                onChange={e => setDuration(e.target.value)}
                type="number"
                min="0"
                placeholder="30"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Себестоимость ₽
                <span className="ml-1 text-muted-foreground/60 font-normal" title="Снижает прибыль, не выставляется клиенту">ⓘ</span>
              </label>
              <input
                value={cost}
                onChange={e => setCost(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Исполнитель</label>
            {masters.length > 0 ? (
              <select
                value={masterName}
                onChange={e => setMasterName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              >
                <option value="">— не назначен —</option>
                {masters.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={masterName}
                onChange={e => setMasterName(e.target.value)}
                placeholder="Имя мастера"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t">
          {!editMode && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="flex-1 py-2 text-sm font-medium border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Сохранить и ещё
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {editMode ? 'Сохранить' : 'Готово'}
          </button>
        </div>
      </div>
    </div>
  )
}
