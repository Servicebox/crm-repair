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
  Clock, ChevronDown, Save, Receipt, AlertCircle, TrendingUp,
  Home, Upload,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { StatusBadge, PriorityBadge } from '@/components/orders/OrderBadge'
import { formatDateTime, formatDate, formatCurrency } from '@/lib/utils'
import { ORDER_STATUSES } from '@/constants/orders'
import WorkModal from '@/components/orders/WorkModal'
import PartModal from '@/components/orders/PartModal'
import PrintModal from '@/components/print/PrintModal'

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

type SalaryType = 'percent_revenue' | 'percent_profit' | 'fixed' | 'rate_per_order' | 'hourly'
interface MasterSalary {
  type?: SalaryType
  value?: number
  hourlyRate?: number
  guaranteed?: number
  rules?: unknown[]
}

function calcMasterEarnings(salary: MasterSalary, revenue: number, profit: number, totalMinutes: number): number | null {
  // Flex salary (rules-based) — can't calculate per-order earnings without full month context
  if (Array.isArray(salary.rules)) return null
  switch (salary.type) {
    case 'percent_revenue': return revenue * (salary.value ?? 0) / 100
    case 'percent_profit': return Math.max(0, profit * (salary.value ?? 0) / 100)
    case 'rate_per_order': return salary.value ?? null
    case 'hourly': return (totalMinutes / 60) * (salary.hourlyRate ?? salary.value ?? 0)
    case 'fixed': return null
    default: return null
  }
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'device' | 'diagnostics' | 'work' | 'payment' | 'approve'>('device')
  const [newStatus, setNewStatus] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printModalType, setPrintModalType] = useState('receipt')
  const [discussing, setDiscussing] = useState(false)
  const [approvalDraft, setApprovalDraft] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [trackUrl, setTrackUrl] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [showWorkModal, setShowWorkModal] = useState(false)
  const [showPartModal, setShowPartModal] = useState(false)
  const [editWorkIdx, setEditWorkIdx] = useState<number | null>(null)
  const [editPartIdx, setEditPartIdx] = useState<number | null>(null)
  const [addPayAmount, setAddPayAmount] = useState('')
  const [addPayMethod, setAddPayMethod] = useState<'cash' | 'card' | 'transfer' | 'online'>('cash')
  const [showTerminalModal, setShowTerminalModal] = useState(false)
  const [terminalStatus, setTerminalStatus] = useState<'idle' | 'sending' | 'waiting' | 'success' | 'error'>('idle')
  const [terminalMessage, setTerminalMessage] = useState('')
  const [terminalAmount, setTerminalAmount] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${id}`)
      const json = await res.json()
      return json.data
    },
  })

  const isPrivileged = session?.user?.role === 'owner' || session?.user?.role === 'admin'

  const { data: employees } = useQuery<Array<{ _id: string; name: string; salary?: MasterSalary }>>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: isPrivileged,
    staleTime: 5 * 60_000,
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

  // Generate QR code + set trackUrl (both need window.location, so do in useEffect)
  useEffect(() => {
    if (!data?.number) return
    const trackId = (data.trackToken as string | undefined) ?? data.number
    const url = `${window.location.origin}/track/${trackId}`
    setTrackUrl(url)
    QRCode.toDataURL(url, { width: 180, margin: 1 }).then(setQrDataUrl)
  }, [data?.number, data?.trackToken])

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
  function openPrint(type: string) {
    setPrintModalType(type)
    setShowPrintModal(true)
  }

  async function handleDiscuss() {
    if (!order || discussing) return
    setDiscussing(true)
    try {
      const res = await fetch('/api/chat/rooms/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, orderNumber: order.number }),
      })
      const json = await res.json()
      if (json.success) router.push(`/chat?room=${json.data.slug}`)
    } finally {
      setDiscussing(false)
    }
  }

  function handleStatusChange() {
    if (!newStatus) return
    patch({ status: newStatus, statusComment })
    setNewStatus('')
    setStatusComment('')
  }

  type WorkItem = { name: string; price: number; discount?: number; duration?: number; cost?: number; masterName?: string }
  type PartItem = { productId?: string; name: string; quantity: number; cost: number; price: number }

  function calcFinalCost(works: WorkItem[], parts: PartItem[]) {
    return works.reduce((s, w) => s + w.price - (w.discount ?? 0), 0) +
      parts.reduce((s, p) => s + p.price * p.quantity, 0) - (order.discount ?? 0)
  }

  function addWorkEntry(entry: WorkItem, addMore: boolean) {
    const currentWorks: WorkItem[] = order.works ?? []
    const works = editWorkIdx !== null
      ? currentWorks.map((w, i) => i === editWorkIdx ? entry : w)
      : [...currentWorks, entry]
    patch({ works, finalCost: calcFinalCost(works, order.parts ?? []) })
    if (!addMore) { setShowWorkModal(false); setEditWorkIdx(null) }
  }

  function openEditWork(i: number) { setEditWorkIdx(i); setShowWorkModal(true) }

  function removeWork(i: number) {
    const works = (order.works ?? []).filter((_: WorkItem, idx: number) => idx !== i)
    patch({ works, finalCost: calcFinalCost(works, order.parts ?? []) })
  }

  function addPartEntry(entry: PartItem, addMore: boolean) {
    const currentParts: PartItem[] = order.parts ?? []
    const parts = editPartIdx !== null
      ? currentParts.map((p, i) => i === editPartIdx ? entry : p)
      : [...currentParts, entry]
    patch({ parts, finalCost: calcFinalCost(order.works ?? [], parts) })
    if (!addMore) { setShowPartModal(false); setEditPartIdx(null) }
  }

  function openEditPart(i: number) { setEditPartIdx(i); setShowPartModal(true) }

  function removePart(i: number) {
    const parts = (order.parts ?? []).filter((_: PartItem, idx: number) => idx !== i)
    patch({ parts, finalCost: calcFinalCost(order.works ?? [], parts) })
  }

  function addPayment() {
    if (!addPayAmount) return
    const payments = [...(order.payments ?? []), { amount: parseFloat(addPayAmount), method: addPayMethod, date: new Date() }]
    patch({ payments })
    setAddPayAmount('')
  }

  async function handleTerminalPayment() {
    const amount = parseFloat(terminalAmount) || remaining
    if (!amount || amount <= 0) return
    setTerminalStatus('sending')
    setTerminalMessage('Отправка запроса на терминал...')
    try {
      const res = await fetch('/api/terminal/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, orderNumber: order.number, orderId: id }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setTerminalStatus('error')
        setTerminalMessage(json.error ?? 'Ошибка связи с терминалом')
        return
      }
      if (json.manualMode) {
        setTerminalStatus('waiting')
        setTerminalMessage('Проведите оплату через терминал и подтвердите')
        return
      }
      setTerminalStatus('success')
      setTerminalMessage('Оплата прошла успешно')
      const payments = [...(order.payments ?? []), { amount, method: 'card' as const, date: new Date() }]
      patch({ payments })
    } catch {
      setTerminalStatus('error')
      setTerminalMessage('Нет связи с терминалом')
    }
  }

  function confirmTerminalManual() {
    const amount = parseFloat(terminalAmount) || remaining
    const payments = [...(order.payments ?? []), { amount, method: 'card' as const, date: new Date() }]
    patch({ payments })
    setTerminalStatus('success')
    setTerminalMessage('Оплата подтверждена')
    setTimeout(() => {
      setShowTerminalModal(false)
      setTerminalStatus('idle')
      setTerminalMessage('')
      setTerminalAmount('')
    }, 1500)
  }

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
          {/* Discuss in internal chat */}
          <button
            onClick={handleDiscuss}
            disabled={discussing}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-accent transition disabled:opacity-60"
            title="Обсудить заказ во внутреннем чате"
          >
            {discussing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <MessageSquare className="w-4 h-4" />
            }
            <span className="hidden sm:inline">Обсудить</span>
          </button>
          {/* Print menu */}
          <div className="relative">
            <button
              onClick={() => setShowPrintMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-accent transition"
            >
              <Printer className="w-4 h-4" /> Печать <ChevronDown className="w-3 h-3" />
            </button>
            {showPrintMenu && (
              <div className="absolute right-0 top-9 bg-white border rounded-xl shadow-lg z-20 min-w-[200px] py-1">
                {[
                  { type: 'receipt', icon: <Receipt className="w-4 h-4 text-blue-500" />, label: 'Квитанция клиенту' },
                  { type: 'act', icon: <FileText className="w-4 h-4 text-green-500" />, label: 'Акт приёмки' },
                  { type: 'works-act', icon: <FileText className="w-4 h-4 text-blue-500" />, label: 'Акт о выполненных работах' },
                  { type: 'label', icon: <Tag className="w-4 h-4 text-orange-500" />, label: 'Этикетка 40×30' },
                ].map(item => (
                  <button
                    key={item.type}
                    onClick={() => { openPrint(item.type); setShowPrintMenu(false) }}
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition w-full text-left"
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
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
              <button onClick={() => openPrint('label')} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
                Печать с QR
              </button>
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
            <div className="space-y-4">
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

              {/* Photos section */}
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Camera className="w-4 h-4 text-purple-500" /> Фото устройства
                  </h3>
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 border border-purple-200 rounded-lg px-2.5 py-1.5 hover:bg-purple-50 transition disabled:opacity-50"
                  >
                    {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Добавить фото
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? [])
                      if (!files.length) return
                      setPhotoUploading(true)
                      for (const file of files) {
                        const fd = new FormData()
                        fd.append('file', file)
                        await fetch(`/api/orders/${id}/photos`, { method: 'POST', body: fd })
                      }
                      setPhotoUploading(false)
                      queryClient.invalidateQueries({ queryKey: ['order', id] })
                      e.target.value = ''
                    }}
                  />
                </div>
                {(order.photos ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Фото не добавлены</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {(order.photos ?? []).map((url: string, i: number) => (
                      <div key={i} className="relative group aspect-square">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Фото ${i + 1}`} className="w-full h-full object-cover rounded-lg border" />
                        </a>
                        <button
                          onClick={async () => {
                            await fetch(`/api/orders/${id}/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
                            queryClient.invalidateQueries({ queryKey: ['order', id] })
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WORK TAB */}
          {activeTab === 'work' && (
            <div className="space-y-4">
              {/* Works */}
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-500" /> Работы
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowWorkModal(true)}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить работу
                  </button>
                </div>
                {(order.works ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Работы не добавлены</p>
                ) : (
                  <div className="divide-y">
                    {(order.works ?? []).map((w: { name: string; price: number; discount?: number; duration?: number; masterName?: string }, i: number) => (
                      <div key={i} className="py-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{w.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(w.price - (w.discount ?? 0))}</span>
                            <button type="button" onClick={() => openEditWork(i)} className="text-muted-foreground hover:text-blue-600 transition-colors" title="Редактировать">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => removeWork(i)} className="text-red-400 hover:text-red-600 transition-colors">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {(w.discount || w.duration || w.masterName) && (
                          <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                            {w.discount ? <span>скидка {formatCurrency(w.discount)}</span> : null}
                            {w.duration ? <span>{w.duration} мин.</span> : null}
                            {w.masterName ? <span>{w.masterName}</span> : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Parts */}
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-orange-500" /> Запчасти
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPartModal(true)}
                    className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 border border-orange-200 rounded-lg px-2.5 py-1.5 hover:bg-orange-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить запчасть
                  </button>
                </div>
                {(order.parts ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Запчасти не добавлены</p>
                ) : (
                  <div className="divide-y">
                    {(order.parts ?? []).map((p: { name: string; price: number; quantity: number; cost: number }, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                        <span>{p.name}{p.quantity > 1 && <span className="text-muted-foreground ml-1">× {p.quantity}</span>}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(p.price * p.quantity)}</span>
                          <button type="button" onClick={() => openEditPart(i)} className="text-muted-foreground hover:text-blue-600 transition-colors" title="Редактировать">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => removePart(i)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modals */}
          {showWorkModal && (
            <WorkModal
              onAdd={addWorkEntry}
              onClose={() => { setShowWorkModal(false); setEditWorkIdx(null) }}
              masters={(employees ?? []).map(e => ({ id: String(e._id), name: e.name }))}
              defaultMasterName={order.masterName}
              deviceType={order.deviceType}
              initialValues={editWorkIdx !== null ? order.works?.[editWorkIdx] : undefined}
              editMode={editWorkIdx !== null}
            />
          )}
          {showPartModal && (
            <PartModal
              onAdd={addPartEntry}
              onClose={() => { setShowPartModal(false); setEditPartIdx(null) }}
              initialValues={editPartIdx !== null ? order.parts?.[editPartIdx] : undefined}
              editMode={editPartIdx !== null}
            />
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
              <div className="flex gap-2 flex-wrap">
                <select value={addPayMethod} onChange={e => setAddPayMethod(e.target.value as 'cash' | 'card' | 'transfer' | 'online')}
                  className="px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background">
                  <option value="cash">Наличными</option>
                  <option value="card">Картой</option>
                  <option value="transfer">Переводом</option>
                  <option value="online">Онлайн</option>
                </select>
                <input value={addPayAmount} onChange={e => setAddPayAmount(e.target.value)} placeholder={`Сумма (остаток ${formatCurrency(remaining)})`} type="number"
                  className="flex-1 min-w-0 px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={addPayment} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition">
                  Принять
                </button>
              </div>

              {/* Terminal + Print act */}
              <div className="flex gap-2 mt-3 pt-3 border-t flex-wrap">
                <button
                  type="button"
                  onClick={() => { setTerminalAmount(String(remaining)); setShowTerminalModal(true); setTerminalStatus('idle'); setTerminalMessage('') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-accent transition"
                >
                  <Receipt className="w-4 h-4 text-blue-500" /> Через терминал
                </button>
                <button
                  onClick={() => openPrint('works-act')}
                  className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-accent transition"
                >
                  <FileText className="w-4 h-4 text-green-500" /> Акт о работах
                </button>
              </div>
            </div>
          )}

          {/* Terminal modal */}
          {showTerminalModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-card border rounded-2xl w-full max-w-sm mx-4 shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b">
                  <h2 className="font-semibold text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-500" /> Оплата через терминал
                  </h2>
                  <button type="button" onClick={() => setShowTerminalModal(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-4">
                  {terminalStatus === 'idle' && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Сумма к оплате</label>
                        <input
                          type="number"
                          value={terminalAmount}
                          onChange={e => setTerminalAmount(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleTerminalPayment}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                      >
                        Отправить на терминал
                      </button>
                    </>
                  )}
                  {(terminalStatus === 'sending' || terminalStatus === 'waiting') && (
                    <div className="text-center py-4">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                      <p className="text-sm font-medium">{terminalMessage}</p>
                      {terminalStatus === 'waiting' && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs text-muted-foreground">После получения оплаты нажмите «Подтвердить»</p>
                          <button
                            type="button"
                            onClick={confirmTerminalManual}
                            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                          >
                            ✓ Подтвердить оплату
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {terminalStatus === 'success' && (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Check className="w-6 h-6 text-green-600" />
                      </div>
                      <p className="text-sm font-medium text-green-700">{terminalMessage}</p>
                      <div className="flex gap-2 mt-4">
                        <button type="button" onClick={() => { setShowTerminalModal(false); setTerminalStatus('idle') }} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent">Закрыть</button>
                        <button onClick={() => { openPrint('works-act'); setShowTerminalModal(false); setTerminalStatus('idle') }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm text-center hover:bg-blue-700 transition">
                          Печать акта
                        </button>
                      </div>
                    </div>
                  )}
                  {terminalStatus === 'error' && (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <p className="text-sm font-medium text-red-700">{terminalMessage}</p>
                      <div className="flex gap-2 mt-4">
                        <button type="button" onClick={() => setTerminalStatus('idle')} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Повторить</button>
                        <button type="button" onClick={confirmTerminalManual} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent">Ручное подтверждение</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* APPROVE TAB */}
          {activeTab === 'approve' && (
            <div className="space-y-4">
              <div className="bg-card border rounded-xl p-4">
                <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-500" /> Согласование с клиентом
                </h3>

                {/* Current approval status */}
                {order.approvalStatus && (
                  <div className="mb-4 space-y-1">
                    <div className={`px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2
                      ${order.approvalStatus === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                        order.approvalStatus === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                        order.approvalStatus === 'thinking' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                        'bg-slate-50 text-slate-600 border'}`}>
                      {order.approvalStatus === 'approved' ? '✓ Клиент согласовал' :
                       order.approvalStatus === 'rejected' ? '✗ Клиент отказался' :
                       order.approvalStatus === 'thinking' ? '⏳ Клиент ещё думает' : '⏳ Ожидает ответа'}
                    </div>
                    {order.clientApprovalComment && (
                      <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border">
                        <span className="font-medium">Комментарий клиента:</span> {order.clientApprovalComment}
                      </div>
                    )}
                  </div>
                )}

                {/* Master: write what needs approval */}
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground mb-1">Что требует согласования (пишет мастер)</div>
                  {order.approvalMessage && (
                    <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-amber-800">
                      {order.approvalMessage}
                    </div>
                  )}
                  <textarea
                    value={approvalDraft || order.approvalMessage || ''}
                    onChange={e => setApprovalDraft(e.target.value)}
                    placeholder="Опишите работы, которые требуют согласования с клиентом..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                  <button
                    onClick={() => {
                      const msg = approvalDraft || order.approvalMessage || ''
                      patch({ approvalMessage: msg, approvalStatus: 'pending' })
                      setApprovalDraft('')
                    }}
                    className="mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
                  >
                    Сохранить
                  </button>
                </div>

                {/* Admin/owner: respond */}
                {isPrivileged && order.approvalMessage && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Ответ администратора</div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => patch({ approvalStatus: 'approved' })}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition ${order.approvalStatus === 'approved' ? 'bg-green-600 text-white border-green-600' : 'hover:bg-green-50 text-green-700 border-green-300'}`}
                      >
                        ✓ Согласовано
                      </button>
                      <button
                        onClick={() => patch({ approvalStatus: 'thinking' })}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition ${order.approvalStatus === 'thinking' ? 'bg-yellow-500 text-white border-yellow-500' : 'hover:bg-yellow-50 text-yellow-700 border-yellow-300'}`}
                      >
                        ⏳ Клиент ещё думает
                      </button>
                      <button
                        onClick={() => patch({ approvalStatus: 'rejected' })}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition ${order.approvalStatus === 'rejected' ? 'bg-red-600 text-white border-red-600' : 'hover:bg-red-50 text-red-700 border-red-300'}`}
                      >
                        ✗ Отказался
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tracking link */}
              <div className="bg-card border rounded-xl p-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">Ссылка для клиента</div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs break-all text-blue-700">{trackUrl}</span>
                  <button onClick={() => navigator.clipboard.writeText(trackUrl)} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 transition shrink-0">
                    Скопировать
                  </button>
                </div>
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

          {/* Master earnings — visible only to owner/admin */}
          {isPrivileged && order.masterId && (() => {
            const master = (employees ?? []).find(e => String(e._id) === String(order.masterId))
            if (!master?.salary) return null

            // Считаем напрямую из массивов works и parts — не через finalCost,
            // чтобы запчасти и услуги всегда учитывались независимо от состояния finalCost
            const worksRevenue = (order.works ?? []).reduce(
              (s: number, w: { price: number; discount?: number }) => s + w.price - (w.discount ?? 0), 0
            )
            const partsRevenue = (order.parts ?? []).reduce(
              (s: number, p: { price: number; quantity: number }) => s + p.price * p.quantity, 0
            )
            const revenue = worksRevenue + partsRevenue - (order.discount ?? 0)

            const partsCost = (order.parts ?? []).reduce(
              (s: number, p: { cost: number; quantity: number }) => s + (p.cost ?? 0) * p.quantity, 0
            )
            const worksCost = (order.works ?? []).reduce(
              (s: number, w: { cost?: number }) => s + (w.cost ?? 0), 0
            )
            const profit = Math.max(0, revenue - partsCost - worksCost)
            const totalMinutes = (order.works ?? []).reduce(
              (s: number, w: { duration?: number }) => s + (w.duration ?? 0), 0
            )
            const earnings = calcMasterEarnings(master.salary, revenue, profit, totalMinutes)

            const isFlexSalary = Array.isArray(master.salary.rules)
            const salaryLabel: Record<string, string> = {
              percent_revenue: `${master.salary.value}% от выручки`,
              percent_profit: `${master.salary.value}% от прибыли`,
              rate_per_order: 'Ставка за заказ',
              hourly: `${master.salary.hourlyRate ?? master.salary.value} ₽/ч`,
              fixed: 'Фиксированный оклад',
            }
            const schemeLabel = isFlexSalary
              ? `Гибкая (${(master.salary.rules as unknown[]).length} прав.)`
              : (salaryLabel[master.salary.type ?? ''] ?? '—')

            return (
              <div className="bg-card border rounded-xl p-4">
                <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-500" /> Заработок мастера
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{master.name}</span>
                    <span className="text-xs text-muted-foreground">{schemeLabel}</span>
                  </div>
                  {/* Revenue breakdown so it's visible what goes into salary */}
                  {(master.salary.type === 'percent_revenue' || master.salary.type === 'percent_profit') && (
                    <div className="bg-muted/40 rounded-lg px-3 py-2 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Услуги</span>
                        <span>{formatCurrency(worksRevenue)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Запчасти / товары</span>
                        <span>{formatCurrency(partsRevenue)}</span>
                      </div>
                      {(order.discount ?? 0) > 0 && (
                        <div className="flex justify-between text-xs text-orange-600">
                          <span>Скидка</span>
                          <span>−{formatCurrency(order.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-medium border-t pt-1">
                        <span>{master.salary.type === 'percent_profit' ? 'Выручка' : 'База'}</span>
                        <span>{formatCurrency(revenue)}</span>
                      </div>
                      {master.salary.type === 'percent_profit' && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Прибыль (−себест.)</span>
                          <span>{formatCurrency(profit)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {master.salary.type === 'hourly' && totalMinutes > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Время работ</span>
                      <span>{Math.round(totalMinutes / 6) / 10} ч</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="font-medium">Заработает с заказа</span>
                    {earnings !== null ? (
                      <span className="font-bold text-green-600 text-base">{formatCurrency(earnings)}</span>
                    ) : isFlexSalary ? (
                      <span className="text-xs text-muted-foreground">Учитывается в ведомости</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Зависит от оклада</span>
                    )}
                  </div>
                  {earnings !== null && master.salary.guaranteed && earnings < master.salary.guaranteed && (
                    <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
                      Ниже гарантированного минимума {formatCurrency(master.salary.guaranteed)} — минимум будет начислен
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

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
              {/* Master self-assignment */}
              {!order.masterId && session?.user?.role === 'master' && (
                <button
                  onClick={() => patch({ masterId: session?.user?.id ?? '', masterName: session?.user?.name ?? 'Мастер' })}
                  className="w-full mt-1 py-1.5 text-xs font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition"
                >
                  Взять заказ
                </button>
              )}
              {/* Admin: change master */}
              {isPrivileged && (employees ?? []).length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <div className="text-xs text-muted-foreground mb-1">{order.masterId ? 'Сменить мастера' : 'Назначить мастера'}</div>
                  <select
                    defaultValue=""
                    onChange={e => {
                      const emp = (employees ?? []).find(em => String(em._id) === e.target.value)
                      if (emp) patch({ masterId: String(emp._id), masterName: emp.name })
                    }}
                    className="w-full px-2 py-1 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                  >
                    <option value="" disabled>Выбрать мастера…</option>
                    {(employees ?? []).map(emp => (
                      <option key={String(emp._id)} value={String(emp._id)}>{emp.name}</option>
                    ))}
                  </select>
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
              {/* Device at client checkbox */}
              <div className="flex items-center justify-between pt-1 border-t mt-1">
                <label htmlFor="deviceAtClient" className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                  <Home className="w-3.5 h-3.5" /> Аппарат у клиента
                </label>
                <input
                  id="deviceAtClient"
                  type="checkbox"
                  checked={order.deviceAtClient ?? false}
                  onChange={e => patch({ deviceAtClient: e.target.checked })}
                  className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                />
              </div>
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

      <PrintModal
        orderId={id}
        order={order}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        initialType={printModalType}
      />
    </div>
  )
}
