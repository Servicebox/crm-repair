'use client'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import QRCode from 'qrcode'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  new: 'Принят', diagnostics: 'Диагностика', waiting_approval: 'Ожидает согласования',
  waiting_parts: 'Ожидает запчасти', in_repair: 'В ремонте', quality_check: 'Проверка качества',
  ready: 'Готов к выдаче', issued: 'Выдан', cancelled: 'Отменён',
}

const CHECKLIST_ITEMS = [
  { id: 'screen', label: 'Экран / стекло' }, { id: 'body', label: 'Корпус / царапины' },
  { id: 'back', label: 'Задняя крышка' }, { id: 'cameras', label: 'Камеры' },
  { id: 'buttons', label: 'Кнопки / качелька' }, { id: 'speakers', label: 'Динамики / микрофон' },
  { id: 'charge', label: 'Разъём зарядки' }, { id: 'sim', label: 'SIM / сеть' },
  { id: 'wifi', label: 'Wi-Fi / Bluetooth' }, { id: 'battery', label: 'Аккумулятор' },
  { id: 'moisture', label: 'Следы влаги' }, { id: 'completeness', label: 'Комплектность' },
]

function PrintContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const printType = searchParams.get('type') ?? 'receipt' // receipt | act | label

  const [qrDataUrl, setQrDataUrl] = useState('')

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

  const { data: labelSettings } = useQuery({
    queryKey: ['settings-label'],
    queryFn: async () => {
      const res = await fetch('/api/settings/label')
      const json = await res.json()
      return json.data ?? {}
    },
  })

  useEffect(() => {
    if (!orderData?.number) return
    const trackUrl = `${window.location.origin}/track/${orderData.number}`
    QRCode.toDataURL(trackUrl, { width: 100, margin: 0 }).then(setQrDataUrl)
  }, [orderData?.number])

  useEffect(() => {
    if (orderData && companyData) {
      setTimeout(() => window.print(), 600)
    }
  }, [orderData, companyData])

  if (!orderData || !companyData) {
    return <div className="flex items-center justify-center h-screen">Загрузка...</div>
  }

  const order = orderData
  const company = companyData
  const totalPaid = (order.payments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0)
  const remaining = Math.max(0, (order.finalCost ?? 0) - totalPaid)
  const trackUrl = `${window.location.origin}/track/${order.number}`

  // ---------- LABEL 40×30 ----------
  if (printType === 'label') {
    const lbl = labelSettings ?? {}
    return (
      <div style={{ background: 'white', minHeight: '100vh' }}>
        <style>{`
          @media print {
            body { margin: 0; background: white; }
            .no-print { display: none !important; }
            @page { size: 40mm 30mm; margin: 1mm; }
          }
        `}</style>
        <div className="no-print p-4 flex gap-2 items-center border-b">
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Печать этикетки 40×30</button>
          <span className="text-sm text-gray-500">Формат: 40×30 мм, термопринтер</span>
        </div>

        {/* Label body — 40×30mm */}
        <div style={{ width: 151, height: 113, padding: '2mm', fontFamily: 'monospace', fontSize: 7, lineHeight: 1.2, overflow: 'hidden', border: '1px dashed #ccc', margin: '16px auto' }}>
          {/* Order number — always */}
          <div style={{ fontWeight: 'bold', fontSize: 9, borderBottom: '1px solid #000', paddingBottom: 1, marginBottom: 2 }}>
            {order.number}
          </div>

          {lbl.deviceModel !== false && order.deviceModel && (
            <div>{order.deviceBrand} {order.deviceModel}</div>
          )}
          {lbl.defect !== false && order.defectDescription && (
            <div style={{ fontSize: 6 }}>{order.defectDescription.slice(0, 40)}</div>
          )}
          {lbl.phone && order.clientPhone && (
            <div>{order.clientPhone}</div>
          )}
          {lbl.password && order.devicePassword && (
            <div>PWD: {order.devicePassword}</div>
          )}
          {lbl.acceptedDate !== false && (
            <div style={{ fontSize: 6 }}>{formatDate(order.acceptedAt ?? order.createdAt)}</div>
          )}
          {/* QR code */}
          {lbl.qr !== false && qrDataUrl && (
            <div style={{ marginTop: 2 }}>
              <img src={qrDataUrl} style={{ width: 28, height: 28 }} alt="QR" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---------- ACT (акт приёмки, копия сервиса) ----------
  if (printType === 'act') {
    return (
      <div style={{ background: 'white', minHeight: '100vh', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000' }}>
        <style>{`
          @media print {
            body { background: white; margin: 0; }
            .no-print { display: none !important; }
            @page { margin: 15mm; }
          }
          .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .divider { border-top: 1px solid #000; margin: 8px 0; }
          .dashed { border-top: 1px dashed #000; margin: 8px 0; }
        `}</style>
        <div className="no-print p-4">
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Печать акта</button>
        </div>

        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>{company.name}</div>
              {company.phone && <div>{company.phone}</div>}
              {company.address && <div>{company.address}</div>}
              {company.inn && <div>ИНН: {company.inn}</div>}
              {company.ogrn && <div>ОГРН: {company.ogrn}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: 18 }}>АКТ ПРИЁМКИ</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14 }}>№ {order.number}</div>
              <div>Принят: {formatDateTime(order.acceptedAt ?? order.createdAt)}</div>
              {order.dueDate && <div>Срок готовности: {formatDate(order.dueDate)}</div>}
            </div>
          </div>
          <div className="divider" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Клиент</div>
              <div>ФИО: {order.clientName}</div>
              {order.clientPhone && <div>Телефон: {order.clientPhone}</div>}
              {order.clientEmail && <div>Email: {order.clientEmail}</div>}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Устройство</div>
              <div>Тип: {order.deviceType}</div>
              {order.deviceBrand && <div>Бренд: {order.deviceBrand}</div>}
              {order.deviceModel && <div>Модель: {order.deviceModel}</div>}
              {order.deviceColor && <div>Цвет: {order.deviceColor}</div>}
              {order.deviceSerial && <div>S/N: {order.deviceSerial}</div>}
              {order.deviceImei && <div>IMEI: {order.deviceImei}</div>}
            </div>
          </div>

          {order.deviceCondition && <div><b>Внешнее состояние:</b> {order.deviceCondition}</div>}
          {order.deviceAccessories && <div><b>Комплектация:</b> {order.deviceAccessories}</div>}
          <div style={{ marginTop: 4 }}><b>Заявленная неисправность:</b> {order.defectDescription}</div>

          {/* Checklist */}
          {order.checklist && Object.keys(order.checklist).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Акт осмотра при приёмке:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px 12px', fontSize: 11 }}>
                {CHECKLIST_ITEMS.map(item => {
                  const val = order.checklist[item.id]
                  if (!val) return null
                  return (
                    <div key={item.id} style={{ display: 'flex', gap: 4 }}>
                      <span style={{ color: val === 'ok' ? 'green' : val === 'defect' ? 'red' : 'gray', fontWeight: 'bold' }}>
                        {val === 'ok' ? '✓' : val === 'defect' ? '✗' : 'Н/П'}
                      </span>
                      {item.label}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="divider" />

          {/* Finance */}
          {order.estimatedCost > 0 && (
            <div className="row"><span>Предварительная стоимость:</span><span>{formatCurrency(order.estimatedCost)}</span></div>
          )}
          {order.prepayment > 0 && (
            <div className="row"><span>Предоплата:</span><span>{formatCurrency(order.prepayment)}</span></div>
          )}
          <div className="row" style={{ fontWeight: 'bold', fontSize: 13 }}>
            <span>Итого к оплате:</span><span>{formatCurrency(order.finalCost)}</span>
          </div>
          <div><b>Гарантия:</b> {order.warrantyDays} дней после выдачи</div>

          <div className="divider" />

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <div>
              <div>Принял: {order.receivedByName ?? order.masterName ?? '____________________'}</div>
              <div style={{ marginTop: 8 }}>Подпись: ____________________</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>Клиент: {order.clientName}</div>
              <div style={{ marginTop: 8 }}>Подпись: ____________________</div>
            </div>
          </div>

          {/* Tear-off */}
          <div className="dashed" style={{ marginTop: 20 }} />
          <div style={{ textAlign: 'center', fontSize: 10, color: '#888', marginBottom: 4 }}>
            ✂ — ОТРЫВНОЙ ТАЛОН КЛИЕНТУ — ✂
          </div>
          <div className="dashed" />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div>
              <b>{order.number}</b> · {company.name}<br />
              {order.clientName} · {order.clientPhone}<br />
              {order.deviceType} {order.deviceBrand} {order.deviceModel}
            </div>
            <div style={{ textAlign: 'right' }}>
              Принят: {formatDate(order.acceptedAt ?? order.createdAt)}<br />
              {order.dueDate && <>Срок: {formatDate(order.dueDate)}<br /></>}
              Тел. сервиса: {company.phone}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------- КВИТАНЦИЯ КЛИЕНТУ (54-ФЗ compliant receipt) ----------
  return (
    <div style={{ background: 'white', minHeight: '100vh', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000' }}>
      <style>{`
        @media print {
          body { background: white; margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 12mm; }
        }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px solid #000; margin: 6px 0; }
        .small { font-size: 10px; color: #444; }
        .center { text-align: center; }
      `}</style>
      <div className="no-print p-4 flex gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Печать квитанции</button>
        <a href={`/orders/${id}/print?type=act`} target="_blank" className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Акт приёмки</a>
        <a href={`/orders/${id}/print?type=label`} target="_blank" className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Этикетка 40×30</a>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
        {/* Company header */}
        <div className="center" style={{ marginBottom: 8 }}>
          {company.logo && <img src={company.logo} alt="" style={{ height: 40, marginBottom: 4 }} />}
          <div className="bold" style={{ fontSize: 15 }}>{company.name}</div>
          {company.address && <div className="small">{company.address}</div>}
          {company.phone && <div className="small">{company.phone}</div>}
          {company.inn && <div className="small">ИНН: {company.inn} {company.ogrn ? `· ОГРН: ${company.ogrn}` : ''}</div>}
        </div>

        <div className="divider" />

        <div className="center bold" style={{ fontSize: 14 }}>КВИТАНЦИЯ К ДОГОВОРУ НА ОКАЗАНИЕ УСЛУГ</div>
        <div className="row" style={{ marginTop: 4 }}>
          <span>№ заказа:</span><span className="bold" style={{ fontFamily: 'monospace' }}>{order.number}</span>
        </div>
        <div className="row">
          <span>Дата приёмки:</span><span>{formatDateTime(order.acceptedAt ?? order.createdAt)}</span>
        </div>
        {order.dueDate && (
          <div className="row"><span>Плановая готовность:</span><span>{formatDate(order.dueDate)}</span></div>
        )}

        <div className="divider" />

        {/* Client */}
        <div className="bold" style={{ marginBottom: 2 }}>Заказчик:</div>
        <div>{order.clientName}</div>
        {order.clientPhone && <div>{order.clientPhone}</div>}
        {order.clientEmail && <div>{order.clientEmail}</div>}

        <div className="divider" />

        {/* Device */}
        <div className="bold" style={{ marginBottom: 2 }}>Принятое устройство:</div>
        <div>{order.deviceType} {order.deviceBrand} {order.deviceModel}</div>
        {order.deviceColor && <div className="small">Цвет: {order.deviceColor}</div>}
        {order.deviceSerial && <div className="small">Серийный №: {order.deviceSerial}</div>}
        {order.deviceImei && <div className="small">IMEI: {order.deviceImei}</div>}
        {order.deviceCondition && <div className="small">Состояние: {order.deviceCondition}</div>}
        {order.deviceAccessories && <div className="small">Комплектация: {order.deviceAccessories}</div>}
        <div style={{ marginTop: 4 }}><b>Неисправность:</b> {order.defectDescription}</div>

        <div className="divider" />

        {/* Works & Parts (if any) */}
        {(order.works?.length > 0 || order.parts?.length > 0) && (
          <>
            <div className="bold" style={{ marginBottom: 4 }}>Перечень работ и материалов:</div>
            {(order.works ?? []).map((w: { name: string; price: number }, i: number) => (
              <div key={i} className="row" style={{ fontSize: 11 }}>
                <span>{w.name}</span><span>{formatCurrency(w.price)}</span>
              </div>
            ))}
            {(order.parts ?? []).map((p: { name: string; price: number; quantity: number }, i: number) => (
              <div key={i} className="row" style={{ fontSize: 11 }}>
                <span>{p.name} × {p.quantity} шт.</span><span>{formatCurrency(p.price * p.quantity)}</span>
              </div>
            ))}
            <div className="divider" />
          </>
        )}

        {/* Financial */}
        {order.estimatedCost > 0 && (
          <div className="row"><span>Предварительная оценка:</span><span>{formatCurrency(order.estimatedCost)}</span></div>
        )}
        {order.discount > 0 && (
          <div className="row"><span>Скидка:</span><span>−{formatCurrency(order.discount)}</span></div>
        )}
        {order.prepayment > 0 && (
          <div className="row"><span>Предоплата:</span><span>{formatCurrency(order.prepayment)}</span></div>
        )}
        <div className="row bold" style={{ fontSize: 14 }}>
          <span>ИТОГО к оплате:</span><span>{formatCurrency(order.finalCost)}</span>
        </div>
        {remaining > 0 && (
          <div className="row"><span>Остаток (к доплате):</span><span>{formatCurrency(remaining)}</span></div>
        )}
        {totalPaid > 0 && totalPaid >= (order.finalCost ?? 0) && (
          <div className="row" style={{ color: 'green', fontWeight: 'bold' }}>
            <span>✓ ОПЛАЧЕНО:</span><span>{formatCurrency(totalPaid)}</span>
          </div>
        )}

        <div style={{ marginTop: 4 }}><b>Гарантия:</b> {order.warrantyDays} дней с даты выдачи</div>

        <div className="divider" />

        {/* Legal footer (54-ФЗ / договор) */}
        <div className="small center" style={{ marginBottom: 8 }}>
          Настоящая квитанция является договором-офертой на оказание сервисных услуг.<br />
          Принятие устройства подтверждает согласие с условиями ремонта.{' '}
          {company.website && <>Подробнее: {company.website}</>}
        </div>

        {/* QR + Signature */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            {qrDataUrl && (
              <div>
                <img src={qrDataUrl} style={{ width: 60, height: 60 }} alt="QR" />
                <div className="small">Статус заказа</div>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Принял: {order.receivedByName ?? '____________________'}</div>
            <div style={{ marginTop: 8 }}>Подпись клиента: ____________________</div>
          </div>
        </div>

        {/* Payments detail if paid */}
        {(order.payments ?? []).length > 0 && (
          <>
            <div className="divider" />
            <div className="small bold">История оплат:</div>
            {(order.payments ?? []).map((p: { amount: number; method: string; date: string }, i: number) => (
              <div key={i} className="row small">
                <span>{p.method === 'cash' ? 'Наличными' : p.method === 'card' ? 'Картой' : 'Переводом'} · {formatDate(p.date)}</span>
                <span>{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Загрузка...</div>}>
      <PrintContent />
    </Suspense>
  )
}
