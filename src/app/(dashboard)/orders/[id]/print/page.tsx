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
  const printType = searchParams?.get('type') ?? 'receipt' // receipt | act | label

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

  const { data: docTemplates } = useQuery({
    queryKey: ['settings-documents'],
    queryFn: async () => {
      const res = await fetch('/api/settings/documents')
      const json = await res.json()
      return json.data ?? {}
    },
  })

  useEffect(() => {
    if (!orderData?.number) return
    const trackId = (orderData.trackToken as string | undefined) ?? orderData.number
    const trackUrl = `${window.location.origin}/track/${trackId}`
    QRCode.toDataURL(trackUrl, { width: 100, margin: 0 }).then(setQrDataUrl)
  }, [orderData?.number, orderData?.trackToken])

  const isPreview = searchParams?.get('preview') === '1'

  useEffect(() => {
    if (orderData && companyData && !isPreview) {
      setTimeout(() => window.print(), 600)
    }
  }, [orderData, companyData, isPreview])

  if (!orderData || !companyData) {
    return <div className="flex items-center justify-center h-screen">Загрузка...</div>
  }

  const order = orderData
  const company = companyData
  const totalPaid = (order.payments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0)
  const remaining = Math.max(0, (order.finalCost ?? 0) - totalPaid)
  const trackId = (order.trackToken as string | undefined) ?? order.number
  const trackUrl = `${window.location.origin}/track/${trackId}`

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
    const tpl = docTemplates?.acceptance ?? {}
    const showLogo = tpl.showLogo !== false
    const showRequisites = tpl.showRequisites !== false
    const showQr = tpl.showQr !== false
    const showTearOff = tpl.showTearOff !== false

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
          {tpl.headerNote && (
            <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 4, padding: '6px 10px', marginBottom: 10, fontSize: 11 }}>
              {tpl.headerNote}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              {showLogo && company.logo && <img src={company.logo} alt="" style={{ height: 36, marginBottom: 4 }} />}
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>{company.name}</div>
              {showRequisites && company.phone && <div>{company.phone}</div>}
              {showRequisites && company.address && <div>{company.address}</div>}
              {showRequisites && company.inn && <div>ИНН: {company.inn}</div>}
              {showRequisites && company.ogrn && <div>ОГРН: {company.ogrn}</div>}
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

          {/* QR code */}
          {showQr && qrDataUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, padding: '6px 0' }}>
              <img src={qrDataUrl} style={{ width: 56, height: 56 }} alt="QR" />
              <div style={{ fontSize: 10, color: '#444' }}>
                <div style={{ fontWeight: 'bold' }}>Статус заказа онлайн:</div>
                <div>{trackUrl}</div>
              </div>
            </div>
          )}

          {tpl.legalText && (
            <div style={{ fontSize: 9, color: '#666', marginTop: 6 }}>{tpl.legalText}</div>
          )}
          {tpl.footerText && (
            <div style={{ textAlign: 'center', fontSize: 10, color: '#444', marginTop: 6 }}>{tpl.footerText}</div>
          )}

          {/* Tear-off */}
          {showTearOff && (
            <>
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
            </>
          )}
        </div>
      </div>
    )
  }

  // ---------- АКТ О ВЫПОЛНЕННЫХ РАБОТАХ ----------
  if (printType === 'works-act') {
    const wtpl = docTemplates?.worksAct ?? {}
    const wShowLogo = wtpl.showLogo !== false
    const wShowRequisites = wtpl.showRequisites !== false
    const wShowParts = wtpl.showParts !== false
    const wShowQr = wtpl.showQr !== false
    const wWarrantyText = wtpl.warrantyText ?? ''
    const wSignatureNote = wtpl.signatureNote ?? ''

    const worksTotal = (order.works ?? []).reduce((s: number, w: { price: number; discount?: number }) => s + w.price - (w.discount ?? 0), 0)
    const partsTotal = (order.parts ?? []).reduce((s: number, p: { price: number; quantity: number }) => s + p.price * p.quantity, 0)
    const totalPaidForAct = (order.payments ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0)
    const remainingForAct = Math.max(0, (order.finalCost ?? 0) - totalPaidForAct)

    return (
      <div style={{ background: 'white', minHeight: '100vh', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000' }}>
        <style>{`
          @media print {
            body { background: white; margin: 0; }
            .no-print { display: none !important; }
            @page { margin: 15mm; }
          }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .divider { border-top: 1px solid #000; margin: 8px 0; }
          .dashed { border-top: 1px dashed #888; margin: 8px 0; }
          table { border-collapse: collapse; width: 100%; }
          th { background: #f0f0f0; border: 1px solid #ccc; padding: 4px 6px; font-size: 11px; text-align: left; }
          td { border: 1px solid #ccc; padding: 4px 6px; font-size: 11px; }
          td.right, th.right { text-align: right; }
        `}</style>
        <div className="no-print p-4 flex gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Печать акта о работах</button>
        </div>

        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px' }}>
          {wtpl.headerNote && (
            <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 4, padding: '6px 10px', marginBottom: 10, fontSize: 11 }}>
              {wtpl.headerNote}
            </div>
          )}
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              {wShowLogo && company.logo && <img src={company.logo} alt="" style={{ height: 36, marginBottom: 4 }} />}
              <div style={{ fontWeight: 'bold', fontSize: 15 }}>{company.name}</div>
              {wShowRequisites && company.address && <div style={{ fontSize: 11 }}>{company.address}</div>}
              {wShowRequisites && company.phone && <div style={{ fontSize: 11 }}>{company.phone}</div>}
              {wShowRequisites && company.inn && <div style={{ fontSize: 11 }}>ИНН: {company.inn}{company.ogrn ? ` · ОГРН: ${company.ogrn}` : ''}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: 17 }}>АКТ О ВЫПОЛНЕННЫХ РАБОТАХ</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13 }}>№ {order.number}</div>
              <div style={{ fontSize: 11 }}>Дата: {formatDate(order.issuedAt ?? new Date())}</div>
            </div>
          </div>
          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* Parties */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 3 }}>Исполнитель:</div>
              <div>{company.name}</div>
              {company.inn && <div>ИНН: {company.inn}</div>}
              {company.address && <div>{company.address}</div>}
              {company.phone && <div>{company.phone}</div>}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 3 }}>Заказчик:</div>
              <div>{order.clientName}</div>
              {order.clientPhone && <div>{order.clientPhone}</div>}
              {order.clientEmail && <div>{order.clientEmail}</div>}
            </div>
          </div>
          <div className="divider" />

          {/* Device */}
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold' }}>Устройство: </span>
            {order.deviceType} {order.deviceBrand} {order.deviceModel}
            {order.deviceSerial && <span> · S/N: {order.deviceSerial}</span>}
            {order.deviceImei && <span> · IMEI: {order.deviceImei}</span>}
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold' }}>Неисправность: </span>{order.defectDescription}
          </div>
          {order.masterComment && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold' }}>Заключение мастера: </span>{order.masterComment}
            </div>
          )}
          <div className="divider" />

          {/* Works table */}
          {(order.works ?? []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Выполненные работы:</div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 24 }}>№</th>
                    <th>Наименование работы</th>
                    <th className="right" style={{ width: 80 }}>Цена, ₽</th>
                    <th className="right" style={{ width: 70 }}>Скидка, ₽</th>
                    <th className="right" style={{ width: 80 }}>Сумма, ₽</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.works ?? []).map((w: { name: string; price: number; discount?: number; masterName?: string }, i: number) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{w.name}{w.masterName ? <span style={{ color: '#666', fontSize: 10 }}> ({w.masterName})</span> : ''}</td>
                      <td className="right">{w.price.toLocaleString('ru-RU')}</td>
                      <td className="right">{w.discount ? w.discount.toLocaleString('ru-RU') : '—'}</td>
                      <td className="right">{(w.price - (w.discount ?? 0)).toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого работы:</td>
                    <td className="right" style={{ fontWeight: 'bold' }}>{worksTotal.toLocaleString('ru-RU')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Parts table */}
          {wShowParts && (order.parts ?? []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Использованные материалы:</div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 24 }}>№</th>
                    <th>Наименование</th>
                    <th className="right" style={{ width: 50 }}>Кол-во</th>
                    <th className="right" style={{ width: 80 }}>Цена, ₽</th>
                    <th className="right" style={{ width: 80 }}>Сумма, ₽</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.parts ?? []).map((p: { name: string; price: number; quantity: number }, i: number) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{p.name}</td>
                      <td className="right">{p.quantity} шт.</td>
                      <td className="right">{p.price.toLocaleString('ru-RU')}</td>
                      <td className="right">{(p.price * p.quantity).toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого материалы:</td>
                    <td className="right" style={{ fontWeight: 'bold' }}>{partsTotal.toLocaleString('ru-RU')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Financial summary */}
          <div className="divider" />
          {order.discount > 0 && (
            <div className="row"><span>Скидка:</span><span>−{formatCurrency(order.discount)}</span></div>
          )}
          <div className="row" style={{ fontWeight: 'bold', fontSize: 14 }}>
            <span>ИТОГО К ОПЛАТЕ:</span><span>{formatCurrency(order.finalCost)}</span>
          </div>

          {/* Payments */}
          {(order.payments ?? []).length > 0 && (
            <>
              <div className="dashed" />
              <div style={{ fontWeight: 'bold', marginBottom: 3 }}>Оплачено:</div>
              {(order.payments ?? []).map((p: { amount: number; method: string; date: string }, i: number) => (
                <div key={i} className="row" style={{ fontSize: 11 }}>
                  <span>{p.method === 'cash' ? 'Наличными' : p.method === 'card' ? 'Картой' : p.method === 'transfer' ? 'Переводом' : 'Онлайн'} · {formatDate(p.date)}</span>
                  <span>{formatCurrency(p.amount)}</span>
                </div>
              ))}
              <div className="row" style={{ fontWeight: 'bold' }}>
                <span>Итого оплачено:</span><span>{formatCurrency(totalPaidForAct)}</span>
              </div>
              {remainingForAct > 0 && (
                <div className="row" style={{ color: 'red' }}>
                  <span>Остаток к оплате:</span><span>{formatCurrency(remainingForAct)}</span>
                </div>
              )}
              {remainingForAct === 0 && (
                <div className="row" style={{ color: 'green', fontWeight: 'bold' }}>
                  <span>✓ Оплачено полностью</span>
                </div>
              )}
            </>
          )}

          {/* Warranty */}
          <div className="divider" />
          <div><b>Гарантия на выполненные работы:</b> {order.warrantyDays} календарных дней с даты выдачи</div>
          {order.warrantyExpires && (
            <div>Действует до: {formatDate(order.warrantyExpires)}</div>
          )}
          {wWarrantyText && (
            <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{wWarrantyText}</div>
          )}

          {/* Signatures */}
          <div className="divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
            <div>
              <div>Исполнитель: {order.masterName ?? order.receivedByName ?? '_______________________'}</div>
              <div style={{ marginTop: 24 }}>Подпись: _______________________</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>Заказчик: {order.clientName}</div>
              <div style={{ marginTop: 24 }}>Подпись: _______________________</div>
            </div>
          </div>
          {wSignatureNote && (
            <div style={{ fontSize: 10, color: '#666', marginTop: 6 }}>{wSignatureNote}</div>
          )}

          {/* QR */}
          {wShowQr && qrDataUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, borderTop: '1px dashed #ccc', paddingTop: 10 }}>
              <img src={qrDataUrl} style={{ width: 60, height: 60 }} alt="QR" />
              <div style={{ fontSize: 10, color: '#555' }}>
                <div>Отслеживайте статус заказа онлайн:</div>
                <div>{trackUrl}</div>
                <div style={{ marginTop: 4 }}>Заказ выдан: {formatDate(order.issuedAt ?? new Date())}</div>
              </div>
            </div>
          )}
          {wtpl.footerText && (
            <div style={{ textAlign: 'center', fontSize: 10, color: '#444', marginTop: 8 }}>{wtpl.footerText}</div>
          )}
          {wtpl.legalText && (
            <div style={{ fontSize: 9, color: '#666', marginTop: 6 }}>{wtpl.legalText}</div>
          )}
        </div>
      </div>
    )
  }

  // ---------- КВИТАНЦИЯ КЛИЕНТУ (54-ФЗ compliant receipt) ----------
  const rtpl = docTemplates?.receipt ?? {}
  const rShowLogo = rtpl.showLogo !== false
  const rShowRequisites = rtpl.showRequisites !== false
  const rShowQr = rtpl.showQr !== false
  const rShowTearOff = rtpl.showTearOff !== false

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
        {rtpl.headerNote && (
          <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 4, padding: '5px 8px', marginBottom: 8, fontSize: 10 }}>
            {rtpl.headerNote}
          </div>
        )}
        {/* Company header */}
        <div className="center" style={{ marginBottom: 8 }}>
          {rShowLogo && company.logo && <img src={company.logo} alt="" style={{ height: 40, marginBottom: 4 }} />}
          <div className="bold" style={{ fontSize: 15 }}>{company.name}</div>
          {rShowRequisites && company.address && <div className="small">{company.address}</div>}
          {rShowRequisites && company.phone && <div className="small">{company.phone}</div>}
          {rShowRequisites && company.inn && <div className="small">ИНН: {company.inn} {company.ogrn ? `· ОГРН: ${company.ogrn}` : ''}</div>}
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

        {/* Legal footer */}
        {rtpl.legalText ? (
          <div className="small center" style={{ marginBottom: 8 }}>{rtpl.legalText}</div>
        ) : (
          <div className="small center" style={{ marginBottom: 8 }}>
            Настоящая квитанция является договором-офертой на оказание сервисных услуг.<br />
            Принятие устройства подтверждает согласие с условиями ремонта.{' '}
            {company.website && <>Подробнее: {company.website}</>}
          </div>
        )}

        {rtpl.footerText && (
          <div className="small center" style={{ marginBottom: 6, color: '#555' }}>{rtpl.footerText}</div>
        )}

        {/* QR + Signature */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            {rShowQr && qrDataUrl && (
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

        {/* Tear-off for receipt */}
        {rShowTearOff && (
          <>
            <div style={{ borderTop: '1px dashed #000', margin: '14px 0 4px' }} />
            <div className="center small" style={{ marginBottom: 4 }}>✂ — ОТРЫВНОЙ ТАЛОН — ✂</div>
            <div style={{ borderTop: '1px dashed #000', marginBottom: 6 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <div>
                <b>{order.number}</b> · {company.name}<br />
                {order.clientName}
              </div>
              <div style={{ textAlign: 'right' }}>
                {formatDate(order.acceptedAt ?? order.createdAt)}<br />
                Тел: {company.phone}
              </div>
            </div>
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
