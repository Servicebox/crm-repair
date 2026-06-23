'use client'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'

export default function PrintPage() {
  const { id } = useParams<{ id: string }>()

  const { data: orderData } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${id}`)
      const json = await res.json()
      return json.data
    },
  })

  const { data: companyData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      const json = await res.json()
      return json.data
    },
  })

  useEffect(() => {
    if (orderData && companyData) {
      setTimeout(() => window.print(), 500)
    }
  }, [orderData, companyData])

  if (!orderData || !companyData) {
    return <div className="flex items-center justify-center h-screen">Загрузка...</div>
  }

  const order = orderData
  const company = companyData

  const STATUS_LABELS: Record<string, string> = {
    new: 'Принят', diagnostics: 'Диагностика', waiting_approval: 'Ожидает согласования',
    waiting_parts: 'Ожидает запчасти', in_repair: 'В ремонте', quality_check: 'Проверка качества',
    ready: 'Готов к выдаче', issued: 'Выдан', cancelled: 'Отменён',
  }

  const checklistItems = [
    { id: 'screen', label: 'Экран / стекло' }, { id: 'body', label: 'Корпус / царапины' },
    { id: 'back', label: 'Задняя крышка' }, { id: 'cameras', label: 'Камеры' },
    { id: 'buttons', label: 'Кнопки / качелька' }, { id: 'speakers', label: 'Динамики / микрофон' },
    { id: 'charge', label: 'Разъём зарядки' }, { id: 'sim', label: 'SIM / сеть' },
    { id: 'wifi', label: 'Wi-Fi / Bluetooth' }, { id: 'battery', label: 'Аккумулятор' },
    { id: 'moisture', label: 'Следы влаги / коррозии' }, { id: 'completeness', label: 'Комплектность' },
  ]

  return (
    <div className="print-page p-8 max-w-2xl mx-auto font-sans text-sm text-black">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .print-page { padding: 0; max-width: none; }
          @page { margin: 15mm; }
        }
        * { box-sizing: border-box; }
        .divider { border-top: 1px solid #000; margin: 8px 0; }
        .dashed { border-top: 1px dashed #000; margin: 8px 0; }
      `}</style>

      <button className="no-print mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg" onClick={() => window.print()}>
        🖨 Печать
      </button>

      {/* === КВИТАНЦИЯ КЛИЕНТУ === */}
      <section>
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            {company.logo && <img src={company.logo} alt="Logo" style={{ height: 48, marginBottom: 4 }} />}
            <div className="font-bold text-lg">{company.name}</div>
            {company.phone && <div>{company.phone}</div>}
            {company.address && <div>{company.address}</div>}
            {company.inn && <div>ИНН: {company.inn}</div>}
          </div>
          <div className="text-right">
            <div className="font-bold text-xl">КВИТАНЦИЯ</div>
            <div className="font-mono font-bold">№ {order.number}</div>
            <div>{formatDateTime(order.createdAt)}</div>
          </div>
        </div>

        <div className="divider" />

        {/* Client & Device */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="font-semibold mb-1">Клиент</div>
            <div>{order.clientName}</div>
            {order.clientPhone && <div>{order.clientPhone}</div>}
            {order.clientEmail && <div>{order.clientEmail}</div>}
          </div>
          <div>
            <div className="font-semibold mb-1">Устройство</div>
            <div>{order.deviceType} {order.deviceBrand} {order.deviceModel}</div>
            {order.deviceColor && <div>Цвет: {order.deviceColor}</div>}
            {order.deviceSerial && <div>S/N: {order.deviceSerial}</div>}
            {order.deviceImei && <div>IMEI: {order.deviceImei}</div>}
            {order.devicePassword && <div>Пароль: {order.devicePassword}</div>}
          </div>
        </div>

        {order.deviceCondition && <div className="mb-2"><b>Состояние:</b> {order.deviceCondition}</div>}
        {order.deviceAccessories && <div className="mb-2"><b>Комплектация:</b> {order.deviceAccessories}</div>}

        <div className="mb-2"><b>Неисправность:</b> {order.defectDescription}</div>
        <div className="mb-2"><b>Статус:</b> {STATUS_LABELS[order.status] ?? order.status}</div>
        {order.masterId && <div className="mb-2"><b>Мастер:</b> {order.masterName}</div>}
        {order.dueDate && <div className="mb-2"><b>Срок готовности:</b> {formatDate(order.dueDate)}</div>}
        <div className="mb-2"><b>Гарантия:</b> {order.warrantyDays} дней</div>

        {/* Checklist */}
        {order.checklist && Object.keys(order.checklist).length > 0 && (
          <div className="mb-4">
            <div className="font-semibold mb-2">Акт осмотра при приёмке:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
              {checklistItems.map(item => {
                const val = order.checklist[item.id]
                if (!val) return null
                return (
                  <div key={item.id} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 'bold', color: val === 'ok' ? 'green' : val === 'defect' ? 'red' : 'gray' }}>
                      {val === 'ok' ? '✓' : val === 'defect' ? '✗' : 'Н/П'}
                    </span>
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="divider" />

        {/* Financial */}
        <div className="flex justify-between mb-1">
          <span>Предоплата:</span>
          <span>{formatCurrency(order.prepayment)}</span>
        </div>
        {order.estimatedCost > 0 && (
          <div className="flex justify-between mb-1">
            <span>Смета:</span>
            <span>{formatCurrency(order.estimatedCost)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base mt-2">
          <span>Итого:</span>
          <span>{formatCurrency(order.finalCost)}</span>
        </div>
        {order.prepayment > 0 && (
          <div className="flex justify-between">
            <span>К оплате:</span>
            <span>{formatCurrency(Math.max(0, order.finalCost - order.prepayment))}</span>
          </div>
        )}

        <div className="divider" />

        {/* QR & signature */}
        <div className="flex justify-between items-end">
          <div>
            <div className="mb-4">Подпись клиента: ______________________</div>
            <div style={{ fontSize: 11, color: '#666' }}>
              Отследить заказ: {typeof window !== 'undefined' ? window.location.origin : ''}/track/{order.number}
            </div>
            {company.receiptSettings?.footerText && (
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{company.receiptSettings.footerText}</div>
            )}
          </div>
        </div>
      </section>

      {/* === ОТРЫВНОЙ ТАЛОН (АКТ СЕРВИСА) === */}
      <div className="dashed my-6" />
      <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>✂ — — — — — — — — — — — — — — — — — — — (ОТРЫВНОЙ ТАЛОН) — — — — — — — — — — — — — — — — — — — — ✂</div>
      <div className="dashed my-2" />

      <section style={{ fontSize: 12 }}>
        <div className="flex justify-between">
          <div>
            <b>{company.name}</b> · {order.number}
          </div>
          <div>{formatDateTime(order.createdAt)}</div>
        </div>
        <div className="flex gap-8 mt-2">
          <div><b>Клиент:</b> {order.clientName} {order.clientPhone}</div>
          <div><b>Устройство:</b> {order.deviceType} {order.deviceBrand} {order.deviceModel}</div>
        </div>
        <div><b>Неисправность:</b> {order.defectDescription}</div>
        {order.dueDate && <div><b>Срок:</b> {formatDate(order.dueDate)}</div>}
        <div className="flex justify-between mt-2">
          <span>Подпись мастера: ______________________</span>
          <span>Выдал: ______________________</span>
        </div>
      </section>
    </div>
  )
}
