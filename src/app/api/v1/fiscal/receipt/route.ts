import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import FiscalReceipt from '@/models/FiscalReceipt'
import { IFiscalReceiptItem } from '@/models/FiscalReceipt'
import { validateApiKey, apiUnauthorized } from '@/lib/apiAuth'
import Company from '@/models/Company'

const ATOL_TAX_SYSTEMS: Record<string, string> = {
  osn: 'osn', usn_income: 'usn_income', usn_income_expense: 'usn_income_expense',
  eshn: 'eshn', patent: 'patent',
}

const PAYMENT_TYPE_MAP: Record<string, number> = {
  cash: 1,     // наличные
  card: 2,     // безналичные
  qr: 2,       // СБП = безналичные
  transfer: 2, // перевод = безналичные
}

interface AtolConfig {
  enabled: boolean
  login: string
  password: string
  inn: string
  paymentAddress: string
  url: string
  groupCode?: string
}

async function atolGetToken(cfg: AtolConfig): Promise<string> {
  const base = cfg.url.endsWith('/') ? cfg.url : cfg.url + '/'
  const res = await fetch(`${base}getToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: cfg.login, pass: cfg.password }),
  })
  if (!res.ok) throw new Error(`АТОЛ getToken HTTP ${res.status}`)
  const json = await res.json() as { code: number; token?: string }
  if (!json.token) throw new Error(`АТОЛ getToken error code ${json.code}`)
  return json.token
}

async function atolSendReceipt(
  cfg: AtolConfig,
  token: string,
  payload: Record<string, unknown>
): Promise<{ uuid: string }> {
  const base = cfg.url.endsWith('/') ? cfg.url : cfg.url + '/'
  const group = cfg.groupCode ?? 'Main'
  const res = await fetch(`${base}${group}/sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Token': token },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`АТОЛ sell HTTP ${res.status}`)
  const json = await res.json() as { uuid?: string; error?: { text: string } }
  if (json.error?.text) throw new Error(`АТОЛ: ${json.error.text}`)
  if (!json.uuid) throw new Error('АТОЛ не вернул uuid')
  return { uuid: json.uuid }
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return apiUnauthorized()

  await connectToDatabase()

  const body = await request.json() as {
    orderId?: string
    orderNumber?: string
    items?: IFiscalReceiptItem[]
    paymentMethod: 'cash' | 'card' | 'qr' | 'transfer'
    total: number
    clientEmail?: string
  }
  const { orderId, orderNumber, items, paymentMethod, total, clientEmail } = body

  if (!paymentMethod || total == null) {
    return NextResponse.json({ success: false, error: 'paymentMethod and total are required' }, { status: 400 })
  }

  const receipt = await FiscalReceipt.create({
    orderId: orderId ?? undefined,
    type: 'sale',
    items: items ?? [],
    total,
    paymentMethod: paymentMethod === 'transfer' ? 'card' : paymentMethod,
    status: 'pending',
  })

  // Load company + fiscal/cashier settings
  const company = await Company.findOne().lean() as Record<string, unknown> | null
  const cashierSettings = company?.cashierSettings as Record<string, unknown> | undefined
  const fiscalSettings = company?.fiscalSettings as Record<string, unknown> | undefined
  const atolCfg = cashierSettings?.atol as AtolConfig | undefined

  // Check if АТОЛ is configured and enabled
  const atolEnabled = atolCfg?.enabled && atolCfg?.login && atolCfg?.password && atolCfg?.inn && atolCfg?.url

  if (atolEnabled) {
    try {
      const token = await atolGetToken(atolCfg!)
      const taxSystem = (cashierSettings?.global as Record<string, unknown> | undefined)?.taxSystem as string | undefined
      const sno = ATOL_TAX_SYSTEMS[taxSystem ?? 'osn'] ?? 'osn'

      const now = new Date()
      const ts = now.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).replace(',', '')

      const receiptItems = (items ?? []).map((it: IFiscalReceiptItem) => ({
        name: it.name.slice(0, 128),
        price: Math.round(it.price * 100) / 100,
        quantity: it.qty ?? 1,
        sum: Math.round(it.price * (it.qty ?? 1) * 100) / 100,
        payment_method: 'full_payment',
        payment_object: 'service',
        vat: { type: 'none' },
      }))

      if (receiptItems.length === 0) {
        receiptItems.push({
          name: `Услуги сервисного центра${orderNumber ? ` (${orderNumber})` : ''}`,
          price: total,
          quantity: 1,
          sum: total,
          payment_method: 'full_payment',
          payment_object: 'service',
          vat: { type: 'none' },
        })
      }

      const payload = {
        timestamp: ts,
        external_id: orderNumber ?? `receipt-${receipt._id.toString()}`,
        receipt: {
          ...(clientEmail ? { client: { email: clientEmail } } : {}),
          company: {
            email: company?.email as string | undefined ?? atolCfg!.login,
            sno,
            inn: atolCfg!.inn,
            payment_address: atolCfg!.paymentAddress,
          },
          items: receiptItems,
          payments: [{ type: PAYMENT_TYPE_MAP[paymentMethod] ?? 2, sum: total }],
          total,
        },
      }

      const { uuid } = await atolSendReceipt(atolCfg!, token, payload)
      receipt.status = 'sent'
      receipt.uuid = uuid
      receipt.provider = 'atol'
      await receipt.save()

      return NextResponse.json({
        success: true,
        data: { receiptId: receipt._id.toString(), uuid, status: 'sent', message: 'Чек отправлен в АТОЛ' },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Неизвестная ошибка АТОЛ'
      receipt.status = 'error'
      receipt.errorMessage = msg
      await receipt.save()
      return NextResponse.json({ success: false, error: msg, receiptId: receipt._id.toString() }, { status: 502 })
    }
  }

  // Check fiscal settings — if provider configured but not АТОЛ, store and return pending
  const provider = fiscalSettings?.ofdProvider as string | undefined
  if (provider && provider !== 'atol') {
    receipt.status = 'pending'
    receipt.provider = provider
    await receipt.save()
    return NextResponse.json({
      success: true,
      data: {
        receiptId: receipt._id.toString(),
        status: 'pending',
        message: `Чек поставлен в очередь (${provider}). Настройте API-подключение для автоматической отправки.`,
      },
    })
  }

  // Demo mode — no fiscal provider configured
  receipt.status = 'registered'
  receipt.receiptId = `DEMO-${Date.now()}`
  await receipt.save()

  return NextResponse.json({
    success: true,
    data: { receiptId: receipt.receiptId, status: 'registered', message: 'Чек зарегистрирован (демо-режим)' },
  })
}
