'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  ArrowLeft, Printer, Trash2, Loader2, ChevronRight,
  Check, Pencil, X, Plus, Minus, QrCode, Tag,
  Phone, Mail, User, Smartphone, Wrench, DollarSign,
  Calendar, Shield, MessageSquare, Camera, FileText,
  Clock, ChevronDown, Save, Receipt, AlertCircle,
} from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/components/orders/OrderBadge'
import { formatDateTime, formatDate, formatCurrency } from '@/lib/utils'
import { ORDER_STATUSES } from '@/constants/orders'

const STAGE_STATUSES = [
  'new', 'diagnostics', 'waiting_approval', 'waiting_parts',
  'in_repair', 'quality_check', 'ready',
] as const
const STAGE_LABELS: Record<string, string> = {
  new: 'Новый', diagnostics: 'Диагностика', waiting_approval: 'Ожидает согласования',
  waiting_parts: 'Ожидает запчасти', in_repair: 'В ремонте', quality_check: 'Проверка качества',
  ready: 'Готов к выдаче',
}
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Наличными', card: 'Картой', transfer: 'Переводом', online: 'Онлайн',
}

function EditableField({ label, value, onSave, type = 'text' }: {
  label: string
  value: string
  onSave: (val: string) => void
  type?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  function commit() { onSave(draft); setEditing(false) }
  function cancel() { setDraft(value); setEditing(false) }

  if (editing) return (
    <div className="flex items-center gap-1">
      <input
        ref={ref}
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        className="flex-1 px-2 py-0.5 text-sm border border-blue-400 rounded focus:ring-1 focus:ring-blue-500 outline-none"
      />
      <button onClick={commit} className="text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={cancel} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
    </div>
  )

  return (
    <div className="flex items-center gap-1 group cursor-pointer" onClick={() => setEditing(true)}>
      <span className="text-sm">{value || <span className="text-muted-foreground italic">не указано</span>}</span>
      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
    </div>
  )
}

function EditableTextarea({ label, value, onSave }: { label: string; value: string; onSave: (val: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => { setDraft(value) }, [value])

  function commit() { onSave(draft); setEditing(false) }

  if (editing) return (
    <div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={3}
        className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        autoFocus
      />
      <div className="flex gap-2 mt-1">
        <button onClick={commit} className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded transition">Сохранить</button>
        <button onClick={() => { setDraft(value); setEditing(false) }} className="text-xs text-slate-600 hover:text-slate-800">Отмена</button>
      </div>
    </div>
  )

  return (
    <div className="group cursor-pointer" onClick={() => setEditing(true)}>
      <p className="text-sm">{value || <span className="text-muted-foreground italic">не указано</span>}</p>
      <button className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 mt-0.5 transition">Редактировать</button>
    </div>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'device' | 'diagnostics' | 'work' | 'payment' | 'approve'>('device')
  const [newStatus, setNewStatus] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const [addWorkName, setAddWorkName] = useState('')
  const [addWorkPrice, setAddWorkPrice] = useState('')
  const [addPartName, setAddPartName] = useState('')
  const [addPartQty, setAddPartQty] = useState('1')
  const [addPartPrice, setAddPartPrice] = useState('')
  const [addPayAmount, setAddPayAmount] = useState('')
  const [addPayMethod, setAddPayMethod] = useState<'cash' | 'card' | 'transfer' | 'online'>('cash')

  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${id}`)
      const json = await res.json()
      return json.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => { await fetch(`/api/orders/${id}`, { method: 'DELETE' }) },
    onSuccess: () => router.push('/orders'),
  })

  // Generate QR code
  useEffect(() => {
    if (!data?.number) return
    const trackUrl = `${window.location.origin}/track/${data.number}`
    QRCode.toDataURL(trackUrl, { width: 180, margin: 1 }).then(setQrDataUrl)
  }, [data?.number])

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
  if (!data) return <div className="p-6 text-muted-foreground">Заказ не найден</div>

  const order = data
  const stageIdx = STAGE_STATUSES.indexOf(order.status as typeof STAGE_STATUSES[number])
  const totalPaid = (order.payments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0)
  const remaining = Math.max(0, (order.finalCost ?? 0) - totalPaid)
  const totalWorksPrice = (order.works ?? []).reduce((s: number, w: { price: number }) => s + w.price, 0)
  const totalPartsPrice = (order.parts ?? []).reduce((s: number, p: { price: number; quantity: number }) => s + p.price * p.quantity, 0)

  function patch(payload: Record<string, unknown>) { updateMutation.mutate(payload) }
  function patchField(field: string) { return (val: string) => patch({ [field]: val }) }

  function handleStatusChange() {
    if (!newStatus) return
    patch({ status: newStatus, statusComment })
    setNewStatus('')
    setStatusComment('')
  }

  function addWork() {
    if (!addWorkName || !addWorkPrice) return
    const works = [...(order.works ?? []), { name: addWorkName, price: parseFloat(addWorkPrice) }]
    const finalCost = works.reduce((s: number, w: { price: number }) => s + w.price, 0) +
      (order.parts ?? []).reduce((s: number, p: { price: number; quantity: number }) => s + p.price * p.quantity, 0) - (order.discount ?? 0)
    patch({ works, finalCost })
    setAddWorkName(''); setAddWorkPrice('')
  }

  function removeWork(i: number) {
    const works = order.works.filter((_: unknown, idx: number) => idx !== i)
    const finalCost = works.reduce((s: number, w: { price: number }) => s + w.price, 0) +
      (order.parts ?? []).reduce((s: number, p: { price: number; quantity: number }) => s + p.price * p.quantity, 0) - (order.discount ?? 0)
    patch({ works, finalCost })
  }

  function addPart() {
    if (!addPartName || !addPartPrice) return
    const parts = [...(order.parts ?? []), { name: addPartName, quantity: parseInt(addPartQty), price: parseFloat(addPartPrice), cost: parseFloat(addPartPrice) }]
    const finalCost = (order.works ?? []).reduce((s: number, w: { price: number }) => s + w.price, 0) +
      parts.reduce((s: number, p: { price: number; quantity: number }) => s + p.price * p.quantity, 0) - (order.discount ?? 0)
    patch({ parts, finalCost })
    setAddPartName(''); setAddPartQty('1'); setAddPartPrice('')
  }

  function removePart(i: number) {
    const parts = order.parts.filter((_: unknown, idx: number) => idx !== i)
    const finalCost = (order.works ?? []).reduce((s: number, w: { price: number }) => s + w.price, 0) +
      parts.reduce((s: number, p: { price: number; quantity: number }) => s + p.price * p.quantity, 0) - (order.discount ?? 0)
    patch({ parts, finalCost })
  }

  function addPayment() {
    if (!addPayAmount) return
    const payments = [...(order.payments ?? []), { amount: parseFloat(addPayAmount), method: addPayMethod, date: new Date() }]
    patch({ payments })
    setAddPayAmount('')
  }

  const trackUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/track/${order.number}`

  const TABS = [
    { key: 'device', label: 'Устройство' },
    { key: 'diagnostics', label: 'Диагностика' },
    { key: 'work', label: 'Работа / запчасть' },
    { key: 'payment', label: 'Оплата' },
    { key: 'approve', label: 'Согласовать с клиентом' },
  ] as const

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 pb-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
        <Link href="/orders" className="hover:text-foreground transition">Заказы</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-mono text-foreground font-medium">{order.number}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <Link href="/orders" className="p-1.5 hover:bg-accent rounded-lg transition mt-0.5">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold font-mono">{order.number}</h1>
              <StatusBadge status={order.status} />
              <PriorityBadge priority={order.priority} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {order.locationName || 'Основной филиал'} · Создан {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Print menu */}
          <div className="relative">
            <button
              onClick={() => setShowPrintMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-accent transition"
            >
              <Printer className="w-4 h-4" /> Печать <ChevronDown className="w-3 h-3" />
            </button>
            {showPrintMenu && (
              <div className="absolute right-0 top-9 bg-white border rounded-xl shadow-lg z-20 min-w-[180px] py-1">
                <Link href={`/orders/${id}/print?type=receipt`} target="_blank" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition">
                  <Receipt className="w-4 h-4 text-blue-500" /> Квитанция клиенту
                </Link>
                <Link href={`/orders/${id}/print?type=act`} target="_blank" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition">
                  <FileText className="w-4 h-4 text-green-500" /> Акт приёмки
                </Link>
                <Link href={`/orders/${id}/print?type=label`} target="_blank" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition">
                  <Tag className="w-4 h-4 text-orange-500" /> Этикетка 40×30
                </Link>
                <button onClick={() => { setShowQr(v => !v); setShowPrintMenu(false) }} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition w-full text-left">
                  <QrCode className="w-4 h-4 text-purple-500" /> QR-код
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => { if (confirm('Удалить заказ?')) deleteMutation.mutate() }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QR panel */}
      {showQr && qrDataUrl && (
        <div className="bg-white border rounded-xl p-4 mb-4 flex items-start gap-6">
          <img src={qrDataUrl} alt="QR код заказа" className="w-36 h-36 rounded-lg border" />
          <div>
            <p className="font-semibold mb-1">QR-код для отслеживания</p>
            <p className="text-sm text-muted-foreground mb-2">Клиент может отсканировать код и увидеть статус ремонта</p>
            <div className="bg-slate-50 border rounded-lg px-3 py-2 text-xs font-mono break-all text-blue-700 mb-3">{trackUrl}</div>
            <div className="flex gap-2">
              <Link href={`/orders/${id}/print?type=label`} target="_blank" className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
                Печать с QR
              </Link>
              <button onClick={() => { navigator.clipboard.writeText(trackUrl) }} className="text-xs border px-3 py-1.5 rounded-lg hover:bg-accent transition">
                Копировать ссылку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage progress */}
      <div className="bg-white border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground">
            Этап ремонта {Math.max(1, stageIdx + 1)} из {STAGE_STATUSES.length}
          </span>
        </div>
        <div className="flex items-center gap-0">
          {STAGE_STATUSES.map((s, i) => {
            const isActive = s === order.status
            const isDone = i < stageIdx
            const isLast = i === STAGE_STATUSES.length - 1
            return (
              <div key={s} className="flex items-center flex-1 min-w-0">
                <div className={`flex flex-col items-center flex-shrink-0 ${isActive ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-slate-300'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold
                    ${isActive ? 'bg-blue-600' : isDone ? 'bg-green-500' : 'bg-slate-200'}`}>
                    {isDone ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className="text-[10px] font-medium mt-1 text-center leading-tight hidden sm:block" style={{ maxWidth: 70 }}>
                    {STAGE_LABELS[s]}
                  </span>
                </div>
                {!isLast && (
                  <div className={`flex-1 h-0.5 mx-1 ${i < stageIdx ? 'bg-green-400' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Status change */}
        <div className="flex items-center gap-2 mt-4">
          <select
            value={newStatus}
            onChange={e => setNewStatus(e.target.value)}
            className="flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background"
          >
            <option value="">Сменить статус…</option>
            {ORDER_STATUSES.filter(s => s.value !== order.status).map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {newStatus && (
            <>
              <input
                value={statusComment}
                onChange={e => setStatusComment(e.target.value)}
                placeholder="Комментарий..."
                className="flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleStatusChange} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition flex items-center gap-1">
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Применить
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition
              ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — tab content */}
        <div className="lg:col-span-2 space-y-4">

          {/* DEVICE TAB */}
          {activeTab === 'device' && (
            <>
              <div className="bg-card border rounded-xl p-4">
                <h3 className="flex items-center gap-2 font-semibold mb-4 text-sm">
                  <Smartphone className="w-4 h-4 text-blue-500" /> Устройство
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Тип', field: 'deviceType', value: order.deviceType },
                    { label: 'Бренд', field: 'deviceBrand', value: order.deviceBrand ?? '' },
                    { label: 'Модель', field: 'deviceModel', value: order.deviceModel ?? '' },
                    { label: 'Цвет', field: 'deviceColor', value: order.deviceColor ?? '' },
                    { label: 'IMEI', field: 'deviceImei', value: order.deviceImei ?? '' },
                    { label: 'Серийный №', field: 'deviceSerial', value: order.deviceSerial ?? '' },
                    { label: 'Пароль', field: 'devicePassword', value: order.devicePassword ?? '' },
                  ].map(({ label, field, value }) => (
                    <div key={field}>
                      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                      <EditableField label={label} value={value} onSave={patchField(field)} />
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-0.5">Комплектация</div>
                  <EditableField label="Комплектация" value={order.deviceAccessories ?? ''} onSave={patchField('deviceAccessories')} />
                </div>
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-0.5">Внешнее состояние</div>
                  <EditableField label="Состояние" value={order.deviceCondition ?? ''} onSave={patchField('deviceCondition')} />
                </div>
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">Заявленная неисправность</div>
                  <EditableTextarea label="Неисправность" value={order.defectDescription ?? ''} onSave={patchField('defectDescription')} />
                </div>
              </div>

              {/* Client */}
              <div className="bg-card border rounded-xl p-4">
                <h3 className="flex items-center gap-2 font-semibold mb-4 text-sm">
                  <User className="w-4 h-4 text-blue-500" /> Клиент
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground w-20 flex-shrink-0">ФИО:</span>
                    <EditableField label="ФИО" value={order.clientName} onSave={patchField('clientName')} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground w-20 flex-shrink-0">Телефон:</span>
                    <EditableField label="Телефон" value={order.clientPhone ?? ''} onSave={patchField('clientPhone')} type="tel" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground w-20 flex-shrink-0">Email:</span>
                    <EditableField label="Email" value={order.clientEmail ?? ''} onSave={patchField('clientEmail')} type="email" />
                  </div>
                </div>
              </div>

              {/* Checklist */}
              {order.checklist && Object.keys(order.checklist).length > 0 && (
                <div className="bg-card border rounded-xl p-4">
                  <h3 className="font-semibold mb-3 text-sm">Чек-лист осмотра при приёмке</h3>
                  <div className="grid grid-cols-2 gap-1">
                    {[...(order.customChecklistItems ?? []).map((c: { id: string; label: string }) => ({ id: c.id, label: c.label })),
                      ...([
                        { id: 'screen', label: 'Экран / стекло' }, { id: 'body', label: 'Корпус' },
                        { id: 'back', label: 'Задняя крышка' }, { id: 'cameras', label: 'Камеры' },
                        { id: 'buttons', label: 'Кнопки' }, { id: 'speakers', label: 'Динамики' },
                        { id: 'charge', label: 'Разъём зарядки' }, { id: 'sim', label: 'SIM / сеть' },
                        { id: 'wifi', label: 'Wi-Fi / BT' }, { id: 'battery', label: 'Аккумулятор' },
                        { id: 'moisture', label: 'Следы влаги' }, { id: 'completeness', label: 'Комплектность' },
                      ]).filter(item => order.checklist[item.id] !== undefined)
                    ].map((item) => {
                      const val = order.checklist[item.id]
                      return (
                        <div key={item.id} className="flex items-center gap-2 py-0.5 text-xs">
                          <span className={val === 'ok' ? 'text-green-600' : val === 'defect' ? 'text-red-500' : 'text-slate-400'}>
                            {val === 'ok' ? '✓' : val === 'defect' ? '✗' : '—'}
                          </span>
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Custom fields */}
              {order.customFields && order.customFields.length > 0 && (
                <div className="bg-card border rounded-xl p-4">
                  <h3 className="font-semibold mb-3 text-sm">Дополнительные поля</h3>
                  <div className="space-y-2">
                    {order.customFields.map((f: { label: string; value: string }, i: number) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground min-w-[120px]">{f.label}:</span>
                        <EditableField label={f.label} value={f.value} onSave={val => {
                          const customFields = order.customFields.map((cf: { label: string; value: string }, idx: number) => idx === i ? { ...cf, value: val } : cf)
                          patch({ customFields })
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* DIAGNOSTICS TAB */}
          {activeTab === 'diagnostics' && (
            <div className="bg-card border rounded-xl p-4">
              <h3 className="flex items-center gap-2 font-semibold mb-4 text-sm">
                <Wrench className="w-4 h-4 text-blue-500" /> Диагностика
              </h3>
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1">Комментарий мастера</div>
                <EditableTextarea label="Комментарий мастера" value={order.masterComment ?? ''} onSave={patchField('masterComment')} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Комментарий администратора</div>
                <EditableTextarea label="Комментарий администратора" value={order.adminComment ?? ''} onSave={patchField('adminComment')} />
              </div>
            </div>
          )}

          {/* WORK TAB */}
          {activeTab === 'work' && (
            <div className="space-y-4">
              {/* Works */}
              <div className="bg-card border rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-500" /> Работы
                </h3>
                {(order.works ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Работы не добавлены</p>
                ) : (
                  <div className="divide-y">
                    {(order.works ?? []).map((w: { name: string; price: number }, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <span>{w.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{formatCurrency(w.price)}</span>
                          <button onClick={() => removeWork(i)} className="text-red-400 hover:text-red-600"><Minus className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <input value={addWorkName} onChange={e => setAddWorkName(e.target.value)} placeholder="Наименование" className="flex-1 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <input value={addWorkPrice} onChange={e => setAddWorkPrice(e.target.value)} placeholder="Цена" type="number" className="w-24 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={addWork} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Parts */}
              <div className="bg-card border rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-500" /> Запчасти
                </h3>
                {(order.parts ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Запчасти не добавлены</p>
                ) : (
                  <div className="divide-y">
                    {(order.parts ?? []).map((p: { name: string; price: number; quantity: number }, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <span>{p.name} × {p.quantity}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{formatCurrency(p.price * p.quantity)}</span>
                          <button onClick={() => removePart(i)} className="text-red-400 hover:text-red-600"><Minus className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <input value={addPartName} onChange={e => setAddPartName(e.target.value)} placeholder="Название" className="flex-1 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <input value={addPartQty} onChange={e => setAddPartQty(e.target.value)} placeholder="Кол-во" type="number" className="w-16 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <input value={addPartPrice} onChange={e => setAddPartPrice(e.target.value)} placeholder="Цена" type="number" className="w-24 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={addPart} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENT TAB */}
          {activeTab === 'payment' && (
            <div className="bg-card border rounded-xl p-4">
              <h3 className="flex items-center gap-2 font-semibold mb-4 text-sm">
                <DollarSign className="w-4 h-4 text-green-500" /> Оплата
              </h3>

              <div className="space-y-1 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Работы:</span>
                  <span>{formatCurrency(totalWorksPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Запчасти:</span>
                  <span>{formatCurrency(totalPartsPrice)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Скидка:</span>
                    <span>−{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Итого:</span>
                  <span>{formatCurrency(order.finalCost)}</span>
                </div>
              </div>

              {/* Payment history */}
              {(order.payments ?? []).length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">История платежей</div>
                  {(order.payments ?? []).map((p: { amount: number; method: string; date: string }, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                      <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method} · {formatDate(p.date)}</span>
                      <span className="text-green-600 font-medium">+{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Оплачено {formatCurrency(totalPaid)} из {formatCurrency(order.finalCost)}</span>
                  <span className={remaining === 0 ? 'text-green-600 font-medium' : ''}>
                    {remaining === 0 ? 'Оплачено полностью' : `Остаток: ${formatCurrency(remaining)}`}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${order.finalCost > 0 ? Math.min(100, (totalPaid / order.finalCost) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Add payment */}
              <div className="flex gap-2">
                <select value={addPayMethod} onChange={e => setAddPayMethod(e.target.value as 'cash' | 'card' | 'transfer' | 'online')}
                  className="px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background">
                  <option value="cash">Наличными</option>
                  <option value="card">Картой</option>
                  <option value="transfer">Переводом</option>
                  <option value="online">Онлайн</option>
                </select>
                <input value={addPayAmount} onChange={e => setAddPayAmount(e.target.value)} placeholder="Сумма" type="number"
                  className="flex-1 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={addPayment} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition">
                  Принять
                </button>
              </div>
            </div>
          )}

          {/* APPROVE TAB */}
          {activeTab === 'approve' && (
            <div className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" /> Согласовать с клиентом
              </h3>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">Отправьте клиенту ссылку для просмотра статуса и оценки работы:</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="font-mono text-xs break-all text-blue-700 mb-2">{trackUrl}</div>
                  <button onClick={() => navigator.clipboard.writeText(trackUrl)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition">
                    Скопировать
                  </button>
                </div>
                {qrDataUrl && (
                  <div className="flex items-center gap-4">
                    <img src={qrDataUrl} alt="QR" className="w-24 h-24 border rounded-lg" />
                    <div>
                      <p className="font-medium mb-1">QR-код для клиента</p>
                      <p className="text-xs text-muted-foreground">Распечатайте или покажите на экране — клиент сканирует и видит статус</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status history */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
              <Clock className="w-4 h-4 text-blue-500" />
              Паспорт ремонта — хронология
            </h3>
            <div className="space-y-3">
              {(order.statusHistory ?? []).map((h: { status: string; comment?: string; userName: string; createdAt: string }, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    {i < (order.statusHistory.length - 1) && <div className="w-0.5 flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-3 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={h.status} />
                      <span className="text-xs text-muted-foreground">{h.userName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(h.createdAt)}</span>
                    </div>
                    {h.comment && <p className="text-sm text-muted-foreground mt-1">{h.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Finance summary */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
              <DollarSign className="w-4 h-4 text-blue-500" /> Финансы
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Чистая прибыль</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(Math.max(0, (order.finalCost ?? 0) -
                    (order.parts ?? []).reduce((s: number, p: { cost: number; quantity: number }) => s + p.cost * p.quantity, 0)))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Клиенту</span>
                <span>{formatCurrency(order.finalCost ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Запчасти (себест.)</span>
                <span>{formatCurrency((order.parts ?? []).reduce((s: number, p: { cost: number; quantity: number }) => s + p.cost * p.quantity, 0))}</span>
              </div>
              {(order.discount ?? 0) > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Скидка</span>
                  <span>−{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="border-t pt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Оплата</span>
                  <span>{formatCurrency(totalPaid)} из {formatCurrency(order.finalCost)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${order.finalCost > 0 ? Math.min(100, (totalPaid / order.finalCost) * 100) : 0}%` }}
                  />
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between mt-1 text-xs">
                    <span className="text-muted-foreground">Остаток:</span>
                    <span className="text-orange-600 font-medium">{formatCurrency(remaining)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Executors */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">Исполнители</h3>
            <div className="space-y-2 text-sm">
              {order.receivedByName && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                    {order.receivedByName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-xs">{order.receivedByName}</div>
                    <div className="text-xs text-muted-foreground">Принял · {order.acceptedAt ? formatDateTime(order.acceptedAt) : formatDateTime(order.createdAt)}</div>
                  </div>
                </div>
              )}
              {order.masterName && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs flex-shrink-0">
                    {order.masterName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-xs">{order.masterName}</div>
                    <div className="text-xs text-muted-foreground">Мастер</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">Детали заказа</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Принят:</span>
                <span>{formatDate(order.acceptedAt ?? order.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Срок:</span>
                <EditableField label="Срок" value={order.dueDate ? formatDate(order.dueDate) : ''} onSave={val => patch({ dueDate: val ? new Date(val).toISOString() : undefined })} type="date" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Гарантия:</span>
                <EditableField label="Гарантия (дней)" value={String(order.warrantyDays ?? 30)} onSave={val => patch({ warrantyDays: parseInt(val) })} type="number" />
              </div>
              {order.issuedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Выдан:</span>
                  <span>{formatDateTime(order.issuedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Track link + QR */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <h3 className="font-semibold mb-1 text-sm text-blue-800 flex items-center gap-1.5">
              <QrCode className="w-4 h-4" /> Ссылка для клиента
            </h3>
            <p className="text-xs text-blue-600 mb-2">Клиент может отследить статус заказа</p>
            <div className="bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs font-mono break-all text-blue-700 mb-2">
              {trackUrl}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowQr(v => !v)} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 transition">
                {showQr ? 'Скрыть QR' : 'Показать QR'}
              </button>
              <button onClick={() => navigator.clipboard.writeText(trackUrl)} className="text-xs border border-blue-200 text-blue-700 px-2.5 py-1 rounded hover:bg-blue-100 transition">
                Копировать
              </button>
            </div>
          </div>

          {/* Alert if no payment */}
          {order.finalCost > 0 && remaining > 0 && order.status === 'ready' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Заказ готов к выдаче, но не оплачен полностью. Остаток: {formatCurrency(remaining)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
