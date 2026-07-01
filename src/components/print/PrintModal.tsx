'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { X, Printer, FileText, Tag, Receipt } from 'lucide-react'
import QRCode from 'qrcode'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'

// ---------- constants ----------

const STATUS_LABELS: Record<string, string> = {
  new: 'Принят', diagnostics: 'Диагностика', waiting_approval: 'Ожидает согласования',
  waiting_parts: 'Ожидает запчасти', in_repair: 'В ремонте', quality_check: 'Проверка качества',
  ready: 'Готов к выдаче', issued: 'Выдан', cancelled: 'Отменён',
}
void STATUS_LABELS // used in templates if needed

const CHECKLIST_ITEMS = [
  { id: 'screen', label: 'Экран / стекло' }, { id: 'body', label: 'Корпус / царапины' },
  { id: 'back', label: 'Задняя крышка' }, { id: 'cameras', label: 'Камеры' },
  { id: 'buttons', label: 'Кнопки / качелька' }, { id: 'speakers', label: 'Динамики / микрофон' },
  { id: 'charge', label: 'Разъём зарядки' }, { id: 'sim', label: 'SIM / сеть' },
  { id: 'wifi', label: 'Wi-Fi / Bluetooth' }, { id: 'battery', label: 'Аккумулятор' },
  { id: 'moisture', label: 'Следы влаги' }, { id: 'completeness', label: 'Комплектность' },
]

const DOC_TYPES = [
  { type: 'receipt', label: 'Квитанция', icon: Receipt },
  { type: 'act', label: 'Акт приёмки', icon: FileText },
  { type: 'works-act', label: 'Акт о работах', icon: FileText },
  { type: 'label', label: 'Этикетка 40×30', icon: Tag },
]

// Print isolation CSS lives in globals.css (body:has(#crm-print-portal) rules).
// No dynamic injection needed — static CSS is more reliable.

// ---------- types ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Order = Record<string, any>

interface PrintModalProps {
  orderId: string
  order?: Order | null
  isOpen: boolean
  onClose: () => void
  initialType?: string
}

// ---------- document templates ----------

function DocumentContent({
  order, company, labelSettings, docTemplates, printType, qrDataUrl, reviewQrDataUrl, trackUrl,
}: {
  order: Order; company: Order; labelSettings: Order; docTemplates: Order
  printType: string; qrDataUrl: string; reviewQrDataUrl: string; trackUrl: string
}) {
  const totalPaid = ((order.payments as { amount: number }[]) ?? []).reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, ((order.finalCost as number) ?? 0) - totalPaid)

  // --- LABEL 40×30 ---
  if (printType === 'label') {
    const lbl = (labelSettings ?? {}) as Record<string, unknown>
    return (
      <div style={{ background: 'white', fontFamily: 'monospace', fontSize: 7, lineHeight: 1.2 }}>
        <div style={{ width: 151, height: 113, padding: '2mm', overflow: 'hidden', border: '1px dashed #ccc', margin: '24px auto' }}>
          <div style={{ fontWeight: 'bold', fontSize: 9, borderBottom: '1px solid #000', paddingBottom: 1, marginBottom: 2 }}>
            {order.number as string}
          </div>
          {lbl.deviceModel !== false && order.deviceModel && (
            <div>{order.deviceBrand as string} {order.deviceModel as string}</div>
          )}
          {lbl.defect !== false && order.defectDescription && (
            <div style={{ fontSize: 6 }}>{(order.defectDescription as string).slice(0, 40)}</div>
          )}
          {lbl.phone && order.clientPhone && <div>{order.clientPhone as string}</div>}
          {lbl.password && order.devicePassword && <div>PWD: {order.devicePassword as string}</div>}
          {lbl.acceptedDate !== false && (
            <div style={{ fontSize: 6 }}>{formatDate((order.acceptedAt ?? order.createdAt) as string)}</div>
          )}
          {lbl.qr !== false && qrDataUrl && (
            <div style={{ marginTop: 2 }}>
              <img src={qrDataUrl} style={{ width: 28, height: 28 }} alt="QR" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- АКТ ПРИЁМКИ ---
  if (printType === 'act') {
    const tpl = ((docTemplates as Record<string, unknown>)?.acceptance ?? {}) as Record<string, unknown>
    const showLogo = tpl.showLogo !== false
    const showRequisites = tpl.showRequisites !== false
    const showQr = tpl.showQr !== false
    const showTearOff = tpl.showTearOff !== false
    return (
      <div style={{ background: 'white', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000', padding: 16 }}>
        <style>{`.prow{display:flex;justify-content:space-between;margin-bottom:3px}.pdivider{border-top:1px solid #000;margin:8px 0}.pdashed{border-top:1px dashed #000;margin:8px 0}`}</style>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {tpl.headerNote && <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 4, padding: '6px 10px', marginBottom: 10, fontSize: 11 }}>{tpl.headerNote as string}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              {showLogo && company.logo && <img src={company.logo as string} alt="" style={{ height: 36, marginBottom: 4 }} />}
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>{company.name as string}</div>
              {showRequisites && company.phone && <div>{company.phone as string}</div>}
              {showRequisites && company.address && <div>{company.address as string}</div>}
              {showRequisites && company.inn && <div>ИНН: {company.inn as string}</div>}
              {showRequisites && company.ogrn && <div>ОГРН: {company.ogrn as string}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: 18 }}>АКТ ПРИЁМКИ</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14 }}>№ {order.number as string}</div>
              <div>Принят: {formatDateTime((order.acceptedAt ?? order.createdAt) as string)}</div>
              {order.dueDate && <div>Срок готовности: {formatDate(order.dueDate as string)}</div>}
            </div>
          </div>
          <div className="pdivider" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Клиент</div>
              <div>ФИО: {order.clientName as string}</div>
              {order.clientPhone && <div>Телефон: {order.clientPhone as string}</div>}
              {order.clientEmail && <div>Email: {order.clientEmail as string}</div>}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Устройство</div>
              <div>Тип: {order.deviceType as string}</div>
              {order.deviceBrand && <div>Бренд: {order.deviceBrand as string}</div>}
              {order.deviceModel && <div>Модель: {order.deviceModel as string}</div>}
              {order.deviceColor && <div>Цвет: {order.deviceColor as string}</div>}
              {order.deviceSerial && <div>S/N: {order.deviceSerial as string}</div>}
              {order.deviceImei && <div>IMEI: {order.deviceImei as string}</div>}
            </div>
          </div>
          {order.deviceCondition && <div><b>Внешнее состояние:</b> {order.deviceCondition as string}</div>}
          {order.deviceAccessories && <div><b>Комплектация:</b> {order.deviceAccessories as string}</div>}
          <div style={{ marginTop: 4 }}><b>Заявленная неисправность:</b> {order.defectDescription as string}</div>
          {order.checklist && Object.keys(order.checklist as object).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Акт осмотра при приёмке:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px 12px', fontSize: 11 }}>
                {CHECKLIST_ITEMS.map(item => {
                  const val = (order.checklist as Record<string, string>)[item.id]
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
          <div className="pdivider" />
          {(order.estimatedCost as number) > 0 && <div className="prow"><span>Предварительная стоимость:</span><span>{formatCurrency(order.estimatedCost as number)}</span></div>}
          {(order.prepayment as number) > 0 && <div className="prow"><span>Предоплата:</span><span>{formatCurrency(order.prepayment as number)}</span></div>}
          <div className="prow" style={{ fontWeight: 'bold', fontSize: 13 }}><span>Итого к оплате:</span><span>{formatCurrency(order.finalCost as number)}</span></div>
          <div><b>Гарантия:</b> {order.warrantyDays as number} дней после выдачи</div>
          <div className="pdivider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <div>
              <div>Принял: {(order.receivedByName ?? order.masterName ?? '____________________') as string}</div>
              <div style={{ marginTop: 8 }}>Подпись: ____________________</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>Клиент: {order.clientName as string}</div>
              <div style={{ marginTop: 8 }}>Подпись: ____________________</div>
            </div>
          </div>
          {showQr && qrDataUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <img src={qrDataUrl} style={{ width: 56, height: 56 }} alt="QR" />
              <div style={{ fontSize: 10, color: '#444' }}>
                <div style={{ fontWeight: 'bold' }}>Статус заказа онлайн:</div>
                <div>{trackUrl}</div>
              </div>
            </div>
          )}
          {tpl.legalText && <div style={{ fontSize: 9, color: '#666', marginTop: 6 }}>{tpl.legalText as string}</div>}
          {tpl.footerText && <div style={{ textAlign: 'center', fontSize: 10, color: '#444', marginTop: 6 }}>{tpl.footerText as string}</div>}
          {showTearOff && (
            <>
              <div className="pdashed" style={{ marginTop: 20 }} />
              <div style={{ textAlign: 'center', fontSize: 10, color: '#888', marginBottom: 4 }}>✂ — ОТРЫВНОЙ ТАЛОН КЛИЕНТУ — ✂</div>
              <div className="pdashed" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <div>
                  <b>{order.number as string}</b> · {company.name as string}<br />
                  {order.clientName as string} · {order.clientPhone as string}<br />
                  {order.deviceType as string} {order.deviceBrand as string} {order.deviceModel as string}
                </div>
                <div style={{ textAlign: 'right' }}>
                  Принят: {formatDate((order.acceptedAt ?? order.createdAt) as string)}<br />
                  {order.dueDate && <>Срок: {formatDate(order.dueDate as string)}<br /></>}
                  Тел. сервиса: {company.phone as string}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // --- АКТ О ВЫПОЛНЕННЫХ РАБОТАХ ---
  if (printType === 'works-act') {
    const wtpl = ((docTemplates as Record<string, unknown>)?.worksAct ?? {}) as Record<string, unknown>
    const wShowLogo = wtpl.showLogo !== false
    const wShowRequisites = wtpl.showRequisites !== false
    const wShowParts = wtpl.showParts !== false
    const worksTotal = ((order.works as { price: number; discount?: number }[]) ?? []).reduce((s, w) => s + w.price - (w.discount ?? 0), 0)
    const partsTotal = ((order.parts as { price: number; quantity: number }[]) ?? []).reduce((s, p) => s + p.price * p.quantity, 0)
    const totalPaidW = ((order.payments as { amount: number }[]) ?? []).reduce((s, p) => s + p.amount, 0)
    const remainingW = Math.max(0, ((order.finalCost as number) ?? 0) - totalPaidW)
    return (
      <div style={{ background: 'white', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000', padding: 16 }}>
        <style>{`.prow{display:flex;justify-content:space-between;margin-bottom:2px}.pdivider{border-top:1px solid #000;margin:8px 0}.pdashed{border-top:1px dashed #888;margin:8px 0}.ptable{border-collapse:collapse;width:100%}.ptable th{background:#f0f0f0;border:1px solid #ccc;padding:4px 6px;font-size:11px;text-align:left}.ptable td{border:1px solid #ccc;padding:4px 6px;font-size:11px}.right{text-align:right}`}</style>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          {wtpl.headerNote && <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 4, padding: '6px 10px', marginBottom: 10, fontSize: 11 }}>{wtpl.headerNote as string}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              {wShowLogo && company.logo && <img src={company.logo as string} alt="" style={{ height: 36, marginBottom: 4 }} />}
              <div style={{ fontWeight: 'bold', fontSize: 15 }}>{company.name as string}</div>
              {wShowRequisites && company.address && <div style={{ fontSize: 11 }}>{company.address as string}</div>}
              {wShowRequisites && company.phone && <div style={{ fontSize: 11 }}>{company.phone as string}</div>}
              {wShowRequisites && company.inn && <div style={{ fontSize: 11 }}>ИНН: {company.inn as string}{company.ogrn ? ` · ОГРН: ${company.ogrn}` : ''}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: 17 }}>АКТ О ВЫПОЛНЕННЫХ РАБОТАХ</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13 }}>№ {order.number as string}</div>
              <div style={{ fontSize: 11 }}>Дата: {formatDate((order.issuedAt ?? new Date()) as string)}</div>
            </div>
          </div>
          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 3 }}>Исполнитель:</div>
              <div>{company.name as string}</div>
              {company.inn && <div>ИНН: {company.inn as string}</div>}
              {company.address && <div>{company.address as string}</div>}
              {company.phone && <div>{company.phone as string}</div>}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 3 }}>Заказчик:</div>
              <div>{order.clientName as string}</div>
              {order.clientPhone && <div>{order.clientPhone as string}</div>}
              {order.clientEmail && <div>{order.clientEmail as string}</div>}
            </div>
          </div>
          <div className="pdivider" />
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold' }}>Устройство: </span>
            {order.deviceType as string} {order.deviceBrand as string} {order.deviceModel as string}
            {order.deviceSerial && <span> · S/N: {order.deviceSerial as string}</span>}
            {order.deviceImei && <span> · IMEI: {order.deviceImei as string}</span>}
          </div>
          <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 'bold' }}>Неисправность: </span>{order.defectDescription as string}</div>
          {order.masterComment && <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 'bold' }}>Заключение мастера: </span>{order.masterComment as string}</div>}
          <div className="pdivider" />
          {((order.works as unknown[]) ?? []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Выполненные работы:</div>
              <table className="ptable">
                <thead><tr><th style={{ width: 24 }}>№</th><th>Наименование работы</th><th className="right" style={{ width: 80 }}>Цена, ₽</th><th className="right" style={{ width: 70 }}>Скидка, ₽</th><th className="right" style={{ width: 80 }}>Сумма, ₽</th></tr></thead>
                <tbody>
                  {((order.works as { name: string; price: number; discount?: number; masterName?: string }[]) ?? []).map((w, i) => (
                    <tr key={i}><td>{i + 1}</td><td>{w.name}{w.masterName ? <span style={{ color: '#666', fontSize: 10 }}> ({w.masterName})</span> : ''}</td><td className="right">{w.price.toLocaleString('ru-RU')}</td><td className="right">{w.discount ? w.discount.toLocaleString('ru-RU') : '—'}</td><td className="right">{(w.price - (w.discount ?? 0)).toLocaleString('ru-RU')}</td></tr>
                  ))}
                  <tr><td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого работы:</td><td className="right" style={{ fontWeight: 'bold' }}>{worksTotal.toLocaleString('ru-RU')}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {wShowParts && ((order.parts as unknown[]) ?? []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Использованные материалы:</div>
              <table className="ptable">
                <thead><tr><th style={{ width: 24 }}>№</th><th>Наименование</th><th className="right" style={{ width: 50 }}>Кол-во</th><th className="right" style={{ width: 80 }}>Цена, ₽</th><th className="right" style={{ width: 80 }}>Сумма, ₽</th></tr></thead>
                <tbody>
                  {((order.parts as { name: string; price: number; quantity: number }[]) ?? []).map((p, i) => (
                    <tr key={i}><td>{i + 1}</td><td>{p.name}</td><td className="right">{p.quantity} шт.</td><td className="right">{p.price.toLocaleString('ru-RU')}</td><td className="right">{(p.price * p.quantity).toLocaleString('ru-RU')}</td></tr>
                  ))}
                  <tr><td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого материалы:</td><td className="right" style={{ fontWeight: 'bold' }}>{partsTotal.toLocaleString('ru-RU')}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="pdivider" />
          {(order.discount as number) > 0 && <div className="prow"><span>Скидка:</span><span>−{formatCurrency(order.discount as number)}</span></div>}
          <div className="prow" style={{ fontWeight: 'bold', fontSize: 14 }}><span>ИТОГО К ОПЛАТЕ:</span><span>{formatCurrency(order.finalCost as number)}</span></div>
          {((order.payments as unknown[]) ?? []).length > 0 && (
            <>
              <div className="pdashed" />
              <div style={{ fontWeight: 'bold', marginBottom: 3 }}>Оплачено:</div>
              {((order.payments as { amount: number; method: string; date: string }[]) ?? []).map((p, i) => (
                <div key={i} className="prow" style={{ fontSize: 11 }}>
                  <span>{p.method === 'cash' ? 'Наличными' : p.method === 'card' ? 'Картой' : p.method === 'transfer' ? 'Переводом' : 'Онлайн'} · {formatDate(p.date)}</span>
                  <span>{formatCurrency(p.amount)}</span>
                </div>
              ))}
              <div className="prow" style={{ fontWeight: 'bold' }}><span>Итого оплачено:</span><span>{formatCurrency(totalPaidW)}</span></div>
              {remainingW > 0 && <div className="prow" style={{ color: 'red' }}><span>Остаток к оплате:</span><span>{formatCurrency(remainingW)}</span></div>}
              {remainingW === 0 && <div className="prow" style={{ color: 'green', fontWeight: 'bold' }}><span>✓ Оплачено полностью</span></div>}
            </>
          )}
          <div className="pdivider" />
          <div><b>Гарантия на выполненные работы:</b> {order.warrantyDays as number} календарных дней с даты выдачи</div>
          {order.warrantyExpires && <div>Действует до: {formatDate(order.warrantyExpires as string)}</div>}
          {wtpl.warrantyText && <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{wtpl.warrantyText as string}</div>}
          <div className="pdivider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
            <div>
              <div>Исполнитель: {(company.name as string) ?? '_______________________'}</div>
              <div style={{ marginTop: 24 }}>Подпись: _______________________</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>Заказчик: {order.clientName as string}</div>
              <div style={{ marginTop: 24 }}>Подпись: _______________________</div>
            </div>
          </div>
          {wtpl.signatureNote && <div style={{ fontSize: 10, color: '#666', marginTop: 6 }}>{wtpl.signatureNote as string}</div>}
          {reviewQrDataUrl && (
            <div style={{ marginTop: 14, borderTop: '1px dashed #ccc', paddingTop: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#333', marginBottom: 4 }}>Понравился сервис? Оставьте отзыв!</div>
              <img src={reviewQrDataUrl} style={{ width: 90, height: 90 }} alt="QR отзыв" />
              <div style={{ fontSize: 9, color: '#888', marginTop: 3 }}>Отсканируйте QR-код</div>
            </div>
          )}
          {wtpl.footerText && <div style={{ textAlign: 'center', fontSize: 10, color: '#444', marginTop: 8 }}>{wtpl.footerText as string}</div>}
          {wtpl.legalText && <div style={{ fontSize: 9, color: '#666', marginTop: 6 }}>{wtpl.legalText as string}</div>}
        </div>
      </div>
    )
  }

  // --- КВИТАНЦИЯ (default) ---
  const rtpl = ((docTemplates as Record<string, unknown>)?.receipt ?? {}) as Record<string, unknown>
  const rShowLogo = rtpl.showLogo !== false
  const rShowRequisites = rtpl.showRequisites !== false
  const rShowQr = rtpl.showQr !== false
  const rShowTearOff = rtpl.showTearOff !== false
  return (
    <div style={{ background: 'white', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000', padding: 16 }}>
      <style>{`.prow{display:flex;justify-content:space-between;padding:2px 0}.pbold{font-weight:bold}.pdivider{border-top:1px solid #000;margin:6px 0}.psmall{font-size:10px;color:#444}.pcenter{text-align:center}`}</style>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {rtpl.headerNote && <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 4, padding: '5px 8px', marginBottom: 8, fontSize: 10 }}>{rtpl.headerNote as string}</div>}
        <div className="pcenter" style={{ marginBottom: 8 }}>
          {rShowLogo && company.logo && <img src={company.logo as string} alt="" style={{ height: 40, marginBottom: 4 }} />}
          <div className="pbold" style={{ fontSize: 15 }}>{company.name as string}</div>
          {rShowRequisites && company.address && <div className="psmall">{company.address as string}</div>}
          {rShowRequisites && company.phone && <div className="psmall">{company.phone as string}</div>}
          {rShowRequisites && company.inn && <div className="psmall">ИНН: {company.inn as string} {company.ogrn ? `· ОГРН: ${company.ogrn}` : ''}</div>}
        </div>
        <div className="pdivider" />
        <div className="pcenter pbold" style={{ fontSize: 14 }}>КВИТАНЦИЯ К ДОГОВОРУ НА ОКАЗАНИЕ УСЛУГ</div>
        <div className="prow" style={{ marginTop: 4 }}><span>№ заказа:</span><span className="pbold" style={{ fontFamily: 'monospace' }}>{order.number as string}</span></div>
        <div className="prow"><span>Дата приёмки:</span><span>{formatDateTime((order.acceptedAt ?? order.createdAt) as string)}</span></div>
        {order.dueDate && <div className="prow"><span>Плановая готовность:</span><span>{formatDate(order.dueDate as string)}</span></div>}
        <div className="pdivider" />
        <div className="pbold" style={{ marginBottom: 2 }}>Заказчик:</div>
        <div>{order.clientName as string}</div>
        {order.clientPhone && <div>{order.clientPhone as string}</div>}
        {order.clientEmail && <div>{order.clientEmail as string}</div>}
        <div className="pdivider" />
        <div className="pbold" style={{ marginBottom: 2 }}>Принятое устройство:</div>
        <div>{order.deviceType as string} {order.deviceBrand as string} {order.deviceModel as string}</div>
        {order.deviceColor && <div className="psmall">Цвет: {order.deviceColor as string}</div>}
        {order.deviceSerial && <div className="psmall">Серийный №: {order.deviceSerial as string}</div>}
        {order.deviceImei && <div className="psmall">IMEI: {order.deviceImei as string}</div>}
        {order.deviceCondition && <div className="psmall">Состояние: {order.deviceCondition as string}</div>}
        {order.deviceAccessories && <div className="psmall">Комплектация: {order.deviceAccessories as string}</div>}
        <div style={{ marginTop: 4 }}><b>Неисправность:</b> {order.defectDescription as string}</div>
        <div className="pdivider" />
        {(((order.works as unknown[]) ?? []).length > 0 || ((order.parts as unknown[]) ?? []).length > 0) && (
          <>
            <div className="pbold" style={{ marginBottom: 4 }}>Перечень работ и материалов:</div>
            {((order.works as { name: string; price: number }[]) ?? []).map((w, i) => (
              <div key={i} className="prow" style={{ fontSize: 11 }}><span>{w.name}</span><span>{formatCurrency(w.price)}</span></div>
            ))}
            {((order.parts as { name: string; price: number; quantity: number }[]) ?? []).map((p, i) => (
              <div key={i} className="prow" style={{ fontSize: 11 }}><span>{p.name} × {p.quantity} шт.</span><span>{formatCurrency(p.price * p.quantity)}</span></div>
            ))}
            <div className="pdivider" />
          </>
        )}
        {(order.estimatedCost as number) > 0 && <div className="prow"><span>Предварительная оценка:</span><span>{formatCurrency(order.estimatedCost as number)}</span></div>}
        {(order.discount as number) > 0 && <div className="prow"><span>Скидка:</span><span>−{formatCurrency(order.discount as number)}</span></div>}
        {(order.prepayment as number) > 0 && <div className="prow"><span>Предоплата:</span><span>{formatCurrency(order.prepayment as number)}</span></div>}
        <div className="prow pbold" style={{ fontSize: 14 }}><span>ИТОГО к оплате:</span><span>{formatCurrency(order.finalCost as number)}</span></div>
        {remaining > 0 && <div className="prow"><span>Остаток (к доплате):</span><span>{formatCurrency(remaining)}</span></div>}
        {totalPaid > 0 && totalPaid >= ((order.finalCost as number) ?? 0) && (
          <div className="prow" style={{ color: 'green', fontWeight: 'bold' }}><span>✓ ОПЛАЧЕНО:</span><span>{formatCurrency(totalPaid)}</span></div>
        )}
        <div style={{ marginTop: 4 }}><b>Гарантия:</b> {order.warrantyDays as number} дней с даты выдачи</div>
        <div className="pdivider" />
        {rtpl.legalText ? (
          <div className="psmall pcenter" style={{ marginBottom: 8 }}>{rtpl.legalText as string}</div>
        ) : (
          <div className="psmall pcenter" style={{ marginBottom: 8 }}>
            Настоящая квитанция является договором-офертой на оказание сервисных услуг.<br />
            Принятие устройства подтверждает согласие с условиями ремонта.
            {company.website && <> Подробнее: {company.website as string}</>}
          </div>
        )}
        {rtpl.footerText && <div className="psmall pcenter" style={{ marginBottom: 6, color: '#555' }}>{rtpl.footerText as string}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            {rShowQr && qrDataUrl && (
              <div>
                <img src={qrDataUrl} style={{ width: 60, height: 60 }} alt="QR" />
                <div className="psmall">Статус заказа</div>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Принял: {(order.receivedByName ?? '____________________') as string}</div>
            <div style={{ marginTop: 8 }}>Подпись клиента: ____________________</div>
          </div>
        </div>
        {((order.payments as unknown[]) ?? []).length > 0 && (
          <>
            <div className="pdivider" />
            <div className="psmall pbold">История оплат:</div>
            {((order.payments as { amount: number; method: string; date: string }[]) ?? []).map((p, i) => (
              <div key={i} className="prow psmall">
                <span>{p.method === 'cash' ? 'Наличными' : p.method === 'card' ? 'Картой' : 'Переводом'} · {formatDate(p.date)}</span>
                <span>{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </>
        )}
        {rShowTearOff && (
          <>
            <div style={{ borderTop: '1px dashed #000', margin: '14px 0 4px' }} />
            <div className="pcenter psmall" style={{ marginBottom: 4 }}>✂ — ОТРЫВНОЙ ТАЛОН — ✂</div>
            <div style={{ borderTop: '1px dashed #000', marginBottom: 6 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <div><b>{order.number as string}</b> · {company.name as string}<br />{order.clientName as string}</div>
              <div style={{ textAlign: 'right' }}>{formatDate((order.acceptedAt ?? order.createdAt) as string)}<br />Тел: {company.phone as string}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------- modal ----------

export default function PrintModal({ orderId, order: orderProp, isOpen, onClose, initialType = 'receipt' }: PrintModalProps) {
  const [printType, setPrintType] = useState(initialType)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [reviewQrDataUrl, setReviewQrDataUrl] = useState('')
  const [mounted, setMounted] = useState(false)

  // Self-fetch order when only orderId is provided (e.g. from new-order page)
  const { data: fetchedOrder } = useQuery({
    queryKey: ['order-print', orderId],
    queryFn: async () => {
      const r = await fetch(`/api/orders/${orderId}`)
      return (await r.json()).data as Order
    },
    enabled: isOpen && !orderProp && !!orderId,
  })
  const order = orderProp ?? fetchedOrder

  // Hydration guard — portal requires browser DOM
  useEffect(() => { setMounted(true) }, [])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Sync doc type when modal opens from different entry points
  useEffect(() => {
    if (isOpen) setPrintType(initialType)
  }, [isOpen, initialType])

  // ESC to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const { data: companyData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { const r = await fetch('/api/settings'); return (await r.json()).data },
    enabled: isOpen,
  })
  const { data: labelSettings } = useQuery({
    queryKey: ['settings-label'],
    queryFn: async () => { const r = await fetch('/api/settings/label'); return (await r.json()).data ?? {} },
    enabled: isOpen,
  })
  const { data: docTemplates } = useQuery({
    queryKey: ['settings-documents'],
    queryFn: async () => { const r = await fetch('/api/settings/documents'); return (await r.json()).data ?? {} },
    enabled: isOpen,
  })

  // QR code — order tracking
  useEffect(() => {
    if (!order?.number) return
    const trackId = (order.trackToken as string | undefined) ?? (order.number as string)
    const url = `${window.location.origin}/track/${trackId}`
    QRCode.toDataURL(url, { width: 120, margin: 0 }).then(setQrDataUrl)
  }, [order?.number, order?.trackToken])

  // QR code — review link (generated when companyData arrives)
  const reviewUrl = (companyData as Record<string, unknown> | undefined)?.reviewUrl as string | undefined
  useEffect(() => {
    if (!reviewUrl) return
    QRCode.toDataURL(reviewUrl, { width: 160, margin: 1 }).then(setReviewQrDataUrl)
  }, [reviewUrl])

  if (!isOpen || !mounted) return null

  const trackId = (order?.trackToken as string | undefined) ?? (order?.number as string)
  const trackUrl = `${window.location.origin}/track/${trackId}`
  const isReady = !!(companyData && order)

  const handlePrint = () => {
    document.body.classList.add('crm-printing')
    window.print()
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('crm-printing')
    }, { once: true })
  }

  return createPortal(
    <div id="crm-print-portal" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#f1f5f9' }}>

      {/* ── Toolbar (hidden when printing) ── */}
      <div id="crm-print-toolbar" style={{
        background: '#1e293b',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Doc type tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {DOC_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setPrintType(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', fontSize: 12, borderRadius: 8,
                border: 'none', cursor: 'pointer', fontWeight: 500,
                background: printType === type ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                color: printType === type ? '#fff' : '#94a3b8',
                transition: 'all 0.15s',
              }}
            >
              <Icon style={{ width: 13, height: 13 }} />
              {label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 18px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13,
              cursor: 'pointer', fontWeight: 600, letterSpacing: '0.01em',
            }}
          >
            <Printer style={{ width: 15, height: 15 }} /> Печать
          </button>
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, cursor: 'pointer',
            }}
            title="Закрыть (Esc)"
          >
            <X style={{ width: 15, height: 15, color: '#94a3b8' }} />
          </button>
        </div>
      </div>

      {/* ── Document preview area ── */}
      <div
        id="crm-print-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '32px 16px' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div id="crm-print-sheet" style={{
          maxWidth: printType === 'label' ? 360 : 800,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 6,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          minHeight: 400,
        }}>
          {!isReady ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, color: '#94a3b8', fontSize: 14 }}>
              Загрузка...
            </div>
          ) : (
            <DocumentContent
              order={order}
              company={companyData}
              labelSettings={labelSettings ?? {}}
              docTemplates={docTemplates ?? {}}
              printType={printType}
              qrDataUrl={qrDataUrl}
              reviewQrDataUrl={reviewQrDataUrl}
              trackUrl={trackUrl}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
