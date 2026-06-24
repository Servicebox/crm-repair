import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import FiscalReceipt from '@/models/FiscalReceipt'
import Company from '@/models/Company'
import { sendReceiptAtol } from '@/lib/cashier/atol'
import type { AtolConfig, CashierReceiptData } from '@/lib/cashier/types'

const RefundSchema = z.object({
  orderId: z.string(),
  items: z.array(z.object({
    name: z.string().min(1),
    price: z.number(),
    quantity: z.number(),
    amount: z.number(),
    tax: z.enum(['none', 'vat0', 'vat10', 'vat20']),
    paymentMethod: z.enum(['full_payment', 'prepayment']),
    paymentObject: z.enum(['service', 'commodity']),
  })).min(1),
  total: z.number().positive(),
  paymentMethod: z.enum(['cash', 'card', 'transfer']),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientPhone: z.string().optional(),
  reason: z.string().optional(),
})

function parseCashierSettings(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'object' || raw === null) return null
  return raw as Record<string, unknown>
}

function getStringField(obj: Record<string, unknown>, key: string): string {
  const val = obj[key]
  return typeof val === 'string' ? val : ''
}

// Возврат прихода (чек типа sell_refund) — 54-ФЗ обязывает пробивать чек при возврате
export async function POST(req: NextRequest) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error

  let data: z.infer<typeof RefundSchema>
  try {
    const body = await req.json()
    data = RefundSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Неверный формат данных')
  }

  await connectToDatabase()

  const company = await Company.findOne({ dbName: authResult.session!.user.dbName }).lean() as Record<string, unknown> | null
  if (!company) return err('Компания не настроена', 500)

  const cashierSettings = parseCashierSettings((company as Record<string, unknown>)['cashierSettings'])

  const receipt = await FiscalReceipt.create({
    orderId: data.orderId,
    type: 'refund',
    items: data.items.map(item => ({
      name: item.name,
      qty: item.quantity,
      price: item.price,
      vat: 0,
    })),
    total: data.total,
    paymentMethod: data.paymentMethod === 'transfer' ? 'card' : data.paymentMethod,
    status: 'pending',
    provider: cashierSettings ? getStringField(cashierSettings, 'provider') : '',
  })

  const atolCfg = parseCashierSettings(cashierSettings ? (cashierSettings['atol'] ?? null) : null)
  const atolEnabled = atolCfg && getStringField(atolCfg, 'login') && getStringField(atolCfg, 'inn') && getStringField(atolCfg, 'url') && atolCfg['enabled']

  if (atolEnabled) {
    const receiptData: CashierReceiptData = {
      orderId: data.orderId,
      externalId: `refund-${data.orderId}-${Date.now()}`,
      items: data.items,
      total: data.total,
      paymentMethod: data.paymentMethod,
      clientEmail: data.clientEmail || undefined,
      clientPhone: data.clientPhone || undefined,
      cashierName: authResult.session!.user.name ?? 'Кассир',
    }

    const atol: AtolConfig = {
      login: getStringField(atolCfg!, 'login'),
      password: getStringField(atolCfg!, 'password'),
      groupCode: getStringField(atolCfg!, 'groupCode'),
      inn: getStringField(atolCfg!, 'inn'),
      paymentAddress: getStringField(atolCfg!, 'paymentAddress'),
      sno: getStringField(atolCfg!, 'sno') || 'usn_income',
      callbackUrl: getStringField(atolCfg!, 'callbackUrl'),
      companyEmail: getStringField(atolCfg!, 'companyEmail'),
    }

    // АТОЛ v4: возврат — endpoint /sell_refund вместо /sell
    const result = await sendReceiptAtol(atol, receiptData, 'sell_refund')

    if (result.success) {
      receipt.status = 'registered'
      receipt.receiptId = result.receiptId ?? result.uuid
      receipt.uuid = result.uuid
      receipt.provider = 'atol'
    } else {
      receipt.status = 'error'
      receipt.errorMessage = result.error ?? 'Ошибка АТОЛ'
    }
    await receipt.save()

    if (!result.success) return err(result.error ?? 'Ошибка отправки возврата в кассу', 502)

    return ok({ receiptId: receipt.receiptId, status: 'registered' }, 201)
  }

  // Нет настроенного провайдера — сохраняем pending, будет обработан вручную
  receipt.status = 'pending'
  await receipt.save()

  return ok({
    receiptId: receipt._id.toString(),
    status: 'pending',
    message: 'Чек возврата создан. Настройте кассу для автоматической отправки.',
  }, 201)
}
