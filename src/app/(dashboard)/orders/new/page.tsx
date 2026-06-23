'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, User, Smartphone, Wrench, CreditCard, Plus, X, Loader2, SlidersHorizontal, CheckCircle, Printer } from 'lucide-react'
import Link from 'next/link'
import { DEVICE_TYPES, DEFECT_TEMPLATES, SOURCES, ACCESSORY_TEMPLATES, CONDITION_TEMPLATES } from '@/constants/orders'
import { cn } from '@/lib/utils'

type ChecklistValue = 'ok' | 'defect' | 'na'
type OrderType = 'repair' | 'service'

const DEFAULT_CHECKLIST_ITEMS = [
  { id: 'screen', label: 'Экран / стекло' },
  { id: 'body', label: 'Корпус / царапины' },
  { id: 'back', label: 'Задняя крышка' },
  { id: 'cameras', label: 'Камеры' },
  { id: 'buttons', label: 'Кнопки / качелька' },
  { id: 'speakers', label: 'Динамики / микрофон' },
  { id: 'charge', label: 'Разъём зарядки' },
  { id: 'sim', label: 'SIM / сеть' },
  { id: 'wifi', label: 'Wi-Fi / Bluetooth' },
  { id: 'battery', label: 'Аккумулятор' },
  { id: 'moisture', label: 'Следы влаги / коррозии' },
  { id: 'completeness', label: 'Комплектность' },
]

export default function NewOrderPage() {
  const router = useRouter()
  const [orderType, setOrderType] = useState<OrderType>('repair')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [source, setSource] = useState('')
  const [clientSearch, setClientSearch] = useState('')

  const [deviceType, setDeviceType] = useState('')
  const [deviceBrand, setDeviceBrand] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [deviceColor, setDeviceColor] = useState('')
  const [deviceSerial, setDeviceSerial] = useState('')
  const [deviceImei, setDeviceImei] = useState('')
  const [devicePassword, setDevicePassword] = useState('')
  const [deviceCondition, setDeviceCondition] = useState('')
  const [deviceAccessories, setDeviceAccessories] = useState('')

  const [defect, setDefect] = useState('')
  const [priority, setPriority] = useState('normal')
  const [clientType, setClientType] = useState('b2c')
  const [dueDate, setDueDate] = useState('')
  const [warrantyDays, setWarrantyDays] = useState(30)
  const [prepayment, setPrepayment] = useState(0)
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [adminComment, setAdminComment] = useState('')
  const [masterId, setMasterId] = useState('')
  const [masterName, setMasterName] = useState('')

  const [checklist, setChecklist] = useState<Record<string, ChecklistValue>>(() =>
    Object.fromEntries(DEFAULT_CHECKLIST_ITEMS.map(i => [i.id, 'ok']))
  )
  const [checklistSkipped, setChecklistSkipped] = useState(false)
  const [customItems, setCustomItems] = useState<{ id: string; label: string }[]>([])
  const [newCustomItem, setNewCustomItem] = useState('')

  const [customFields, setCustomFields] = useState<{label: string; value: string}[]>([])
  const [createdOrder, setCreatedOrder] = useState<{_id: string; number: string} | null>(null)

  const [prepaymentReceived, setPrepaymentReceived] = useState(false)
  const [printReceipt, setPrintReceipt] = useState(false)
  const [printAct, setPrintAct] = useState(false)
  const [printLabel, setPrintLabel] = useState(false)

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      const json = await res.json()
      return json.data ?? []
    },
  })

  const { data: clientResults } = useQuery({
    queryKey: ['client-search', clientPhone],
    queryFn: async () => {
      if (!clientPhone || clientPhone.length < 5) return []
      const res = await fetch(`/api/clients?search=${clientPhone}`)
      const json = await res.json()
      return json.data?.clients ?? []
    },
    enabled: clientPhone.length >= 5,
  })

  function setChecklistAll(val: ChecklistValue) {
    const newVal: Record<string, ChecklistValue> = {}
    DEFAULT_CHECKLIST_ITEMS.forEach(i => { newVal[i.id] = val })
    customItems.forEach(i => { newVal[i.id] = val })
    setChecklist(newVal)
  }

  function addCondition(text: string) {
    setDeviceCondition(prev => prev ? `${prev}, ${text}` : text)
  }

  function addAccessory(text: string) {
    setDeviceAccessories(prev => prev ? `${prev}, ${text}` : text)
  }

  function addCustomChecklistItem() {
    if (!newCustomItem.trim()) return
    const id = `custom_${Date.now()}`
    const item = { id, label: newCustomItem.trim() }
    setCustomItems(prev => [...prev, item])
    setChecklist(prev => ({ ...prev, [id]: 'ok' }))
    setNewCustomItem('')
  }

  function addCustomField() { setCustomFields(p => [...p, { label: '', value: '' }]) }
  function updateCustomField(idx: number, key: 'label'|'value', val: string) {
    setCustomFields(p => p.map((f, i) => i === idx ? { ...f, [key]: val } : f))
  }
  function removeCustomField(idx: number) { setCustomFields(p => p.filter((_, i) => i !== idx)) }

  function selectMaster(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    const emp = employees?.find((m: { _id: string; name: string }) => m._id === id)
    setMasterId(id)
    setMasterName(emp?.name ?? '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName || !deviceType || !defect) {
      setError('Заполните обязательные поля: клиент, тип устройства, неисправность')
      return
    }
    setLoading(true)
    setError('')

    const payload = {
      type: orderType,
      clientName, clientPhone, clientEmail, source,
      deviceType, deviceBrand, deviceModel, deviceColor,
      deviceSerial, deviceImei, devicePassword, deviceCondition, deviceAccessories,
      defectDescription: defect,
      priority, clientType,
      masterId: masterId || undefined,
      masterName: masterName || undefined,
      dueDate: dueDate || undefined,
      warrantyDays,
      estimatedCost: estimatedCost || undefined,
      prepayment,
      prepaymentReceived,
      adminComment,
      checklist: checklistSkipped ? {} : checklist,
      customChecklistItems: customItems,
      customFields: customFields.filter(f => f.label.trim() && f.value.trim()),
    }

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Ошибка создания заказа')
      setLoading(false)
      return
    }

    setCreatedOrder({ _id: json.data._id, number: json.data.number ?? 'новый' })
    setLoading(false)
    return
  }

  const allItems = [...DEFAULT_CHECKLIST_ITEMS, ...customItems]

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/orders" className="p-2 hover:bg-accent rounded-lg transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Новый заказ</h1>
          <p className="text-sm text-muted-foreground">
            Заполните данные клиента, устройства и описание неисправности.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Order type */}
      <div className="flex border rounded-lg overflow-hidden mb-6 w-fit">
        {(['repair', 'service'] as OrderType[]).map(t => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={cn(
              'px-6 py-2 text-sm font-medium transition',
              orderType === t ? 'bg-blue-600 text-white' : 'hover:bg-accent'
            )}
          >
            {t === 'repair' ? 'Ремонт' : 'Услуга'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client */}
        <section className="bg-card border rounded-xl p-4 md:p-6">
          <h2 className="flex items-center gap-2 font-semibold mb-4">
            <User className="w-5 h-5 text-blue-500" />
            Клиент
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ФИО клиента <span className="text-red-500">*</span></label>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Иванов Иван Иванович"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Телефон</label>
              <input
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="+7 999 ..."
              />
              {clientResults && clientResults.length > 0 && (
                <div className="mt-1 border rounded-lg bg-background shadow-sm text-sm">
                  <div className="px-3 py-1.5 text-xs text-muted-foreground border-b">Существующие клиенты:</div>
                  {clientResults.map((c: { _id: string; name: string; phone?: string; totalOrders: number }) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => { setClientName(c.name); setClientPhone(c.phone ?? clientPhone) }}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition"
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone} · {c.totalOrders} заказов</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="client@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Источник</label>
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-background"
              >
                <option value="">Не указано</option>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Device */}
        <section className="bg-card border rounded-xl p-4 md:p-6">
          <h2 className="flex items-center gap-2 font-semibold mb-4">
            <Smartphone className="w-5 h-5 text-blue-500" />
            Устройство
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Тип устройства <span className="text-red-500">*</span></label>
              <select
                value={deviceType}
                onChange={e => setDeviceType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-background"
                required
              >
                <option value="">Выберите</option>
                {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Бренд</label>
              <input
                value={deviceBrand}
                onChange={e => setDeviceBrand(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Apple, Samsung, Infinix..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Модель</label>
              <input
                value={deviceModel}
                onChange={e => setDeviceModel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="iPhone 14 Pro Max"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Цвет</label>
              <input
                value={deviceColor}
                onChange={e => setDeviceColor(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Чёрный"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Серийный номер</label>
              <input
                value={deviceSerial}
                onChange={e => setDeviceSerial(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="F2L..., R58..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IMEI</label>
              <input
                value={deviceImei}
                onChange={e => setDeviceImei(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="350..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Пароль устройства</label>
              <input
                value={devicePassword}
                onChange={e => setDevicePassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Если нужен для диагностики"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Внешнее состояние</label>
            <textarea
              value={deviceCondition}
              onChange={e => setDeviceCondition(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={2}
              placeholder="Царапины, сколы, трещины..."
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {CONDITION_TEMPLATES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addCondition(t)}
                  className="px-2 py-0.5 text-xs border rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Комплектация</label>
            <input
              value={deviceAccessories}
              onChange={e => setDeviceAccessories(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Чехол, зарядка, коробка..."
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {ACCESSORY_TEMPLATES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addAccessory(t)}
                  className="px-2 py-0.5 text-xs border rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Defect */}
        <section className="bg-card border rounded-xl p-4 md:p-6">
          <h2 className="flex items-center gap-2 font-semibold mb-4">
            <Wrench className="w-5 h-5 text-blue-500" />
            Неисправность
          </h2>

          <div className="mb-4">
            <div className="flex flex-wrap gap-1 mb-2">
              {DEFECT_TEMPLATES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDefect(t)}
                  className={cn(
                    'px-2 py-0.5 text-xs border rounded-full transition',
                    defect === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="block text-sm font-medium mb-1">Описание неисправности <span className="text-red-500">*</span></label>
            <textarea
              value={defect}
              onChange={e => setDefect(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={3}
              placeholder="Не включается, разбит экран, не заряжается..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Приоритет</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-background"
              >
                <option value="low">Низкий</option>
                <option value="normal">Обычный</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочный</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Тип заказа</label>
              <select
                value={clientType}
                onChange={e => setClientType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-background"
              >
                <option value="b2c">Клиент (B2C)</option>
                <option value="b2b">Компания (B2B)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Мастер</label>
              <select
                value={masterId}
                onChange={selectMaster}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-background"
              >
                <option value="">Не назначен</option>
                {(employees ?? []).filter((e: { role: string; isActive: boolean }) => e.role === 'master' && e.isActive).map((e: { _id: string; name: string }) => (
                  <option key={e._id} value={e._id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Дата готовности</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Гарантия (дней)</label>
              <input
                type="number"
                value={warrantyDays}
                onChange={e => setWarrantyDays(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Предоплата, ₽</label>
              <input
                type="number"
                value={prepayment}
                onChange={e => setPrepayment(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                min={0}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Заметки</label>
            <textarea
              value={adminComment}
              onChange={e => setAdminComment(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={2}
              placeholder="Дополнительная информация..."
            />
          </div>

          {prepayment > 0 && (
            <div className="mt-4">
              <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-accent/50 transition bg-amber-50 border-amber-200">
                <input
                  type="checkbox"
                  checked={prepaymentReceived}
                  onChange={e => setPrepaymentReceived(e.target.checked)}
                  className="mt-0.5 rounded accent-amber-500"
                />
                <div>
                  <div className="text-sm font-medium text-amber-800">Подтвердить приём предоплаты</div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    Клиент внёс {prepayment.toLocaleString('ru')} ₽ наличными / переводом — деньги приняты
                  </div>
                </div>
              </label>
            </div>
          )}
        </section>

        {/* Checklist */}
        <section className="bg-card border rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Осмотр при приёмке</h2>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={checklistSkipped}
                onChange={e => setChecklistSkipped(e.target.checked)}
                className="rounded"
              />
              Осмотр не проводился — не включать в акт
            </label>
          </div>

          {!checklistSkipped && (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                По умолчанию всё исправно: ✗ — дефект, «Н/П» — невозможно проверить.
              </p>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setChecklistAll('ok')} className="text-xs px-2 py-1 border rounded hover:bg-green-50 hover:border-green-300 transition">
                  ✓ Отметить все исправными
                </button>
                <button type="button" onClick={() => setChecklistAll('na')} className="text-xs px-2 py-1 border rounded hover:bg-slate-50 transition">
                  Н/П — не проверить
                </button>
              </div>

              <div className="space-y-1.5">
                {allItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                    <span className="flex-1 text-sm">{item.label}</span>
                    <div className="flex gap-1">
                      {([['ok', '✓', 'bg-green-100 text-green-700 border-green-200'], ['defect', '✗', 'bg-red-100 text-red-700 border-red-200'], ['na', 'Н/П', 'bg-slate-100 text-slate-600 border-slate-200']] as [ChecklistValue, string, string][]).map(([val, label, cls]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setChecklist(prev => ({ ...prev, [item.id]: val }))}
                          className={cn(
                            'px-2 py-0.5 text-xs rounded border transition',
                            checklist[item.id] === val ? cls : 'border-transparent hover:bg-accent'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={newCustomItem}
                  onChange={e => setNewCustomItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomChecklistItem())}
                  className="flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Свой пункт: например, не работает кнопка R2"
                />
                <button
                  type="button"
                  onClick={addCustomChecklistItem}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition"
                >
                  + добавить
                </button>
              </div>
            </>
          )}
        </section>

        {/* Custom Fields */}
        <section className="bg-card border rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <SlidersHorizontal className="w-5 h-5 text-blue-500" />
              Свои поля
            </h2>
            <button
              type="button"
              onClick={addCustomField}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Добавить поле
            </button>
          </div>
          {customFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Добавьте произвольные поля — они будут напечатаны в акте приёмки и квитанции.
              <br/>
              <span className="text-xs">Например: «Серийный номер поставщика», «Артикул запчасти», «Источник заказа»</span>
            </p>
          ) : (
            <div className="space-y-2">
              {customFields.map((field, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    value={field.label}
                    onChange={e => updateCustomField(idx, 'label', e.target.value)}
                    className="w-44 shrink-0 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Название поля"
                  />
                  <input
                    value={field.value}
                    onChange={e => updateCustomField(idx, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Значение"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomField(idx)}
                    className="p-2 text-muted-foreground hover:text-red-500 transition shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Print */}
        <section className="bg-card border rounded-xl p-4 md:p-6">
          <h2 className="font-semibold mb-3">
            <span>Печать после сохранения</span>
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Отмеченные документы откроются на печать автоматически сразу после создания заказа.
          </p>
          <div className="space-y-2">
            {[
              [printReceipt, setPrintReceipt, 'Квитанция клиенту', 'полный документ на руки'],
              [printAct, setPrintAct, 'Акт приёмки', 'копия сервиса с отрывным талоном'],
              [printLabel, setPrintLabel, 'Этикетка 40×30', 'наклейка на устройство, термопринтер'],
            ].map(([checked, setter, label, hint]) => (
              <label key={label as string} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked as boolean}
                  onChange={e => (setter as (v: boolean) => void)(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <div>
                  <div className="text-sm font-medium">{label as string}</div>
                  <div className="text-xs text-muted-foreground">— {hint as string}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/orders"
            className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition"
          >
            Отмена
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-6 py-2 rounded-lg transition"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Создаём...' : 'Создать заказ'}
          </button>
        </div>
      </form>

      {createdOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-1">Заказ принят!</h2>
              <p className="text-muted-foreground text-sm">Заказ <span className="font-semibold text-foreground">{createdOrder.number}</span> успешно создан</p>
            </div>
            <div className="space-y-2 mb-5">
              <p className="text-sm font-medium mb-2">Распечатать документы:</p>
              {([
                ['receipt', 'Квитанция клиенту', 'Полный документ с условиями приёмки'],
                ['act', 'Акт приёмки', 'Копия сервиса с отрывным талоном'],
              ] as const).map(([doc, label, desc]) => (
                <button
                  key={doc}
                  type="button"
                  onClick={() => window.open(`/orders/${createdOrder._id}/print?doc=${doc}`, '_blank')}
                  className="w-full flex items-center gap-3 px-4 py-3 border rounded-xl hover:bg-blue-50 hover:border-blue-200 text-left transition"
                >
                  <Printer className="w-5 h-5 text-blue-500 shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push(`/orders/${createdOrder._id}`)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition"
              >
                Открыть заказ
              </button>
              <button
                type="button"
                onClick={() => { setCreatedOrder(null); router.push('/orders/new') }}
                className="flex-1 border text-sm font-medium py-2.5 rounded-xl hover:bg-accent transition"
              >
                Новый заказ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
