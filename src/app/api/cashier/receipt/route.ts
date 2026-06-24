import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'
import FiscalReceipt from '@/models/FiscalReceipt'
import Company from '@/models/Company'
import { sendReceiptAtol } from '@/lib/cashier/atol'
import { sendReceiptEvotor } from '@/lib/cashier/evotor'
import { sendReceiptCloudkassir } from '@/lib/cashier/cloudkassir'
import type { AtolConfig, EvotorConfig, CloudkassirConfig, CashierReceiptData } from '@/lib/cashier/types'

const ReceiptItemSchema = z.object({
  name: z.string().min(1),
  price: z.number(),
  quantity: z.number(),
  amount: z.number(),
  tax: z.enum(['none', 'vat0', 'vat10', 'vat20']),
  paymentMethod: z.enum(['full_payment', 'prepayment']),
  paymentObject: z.enum(['service', 'commodity']),
})

const SendReceiptSchema = z.object({
  orderId: z.string(),
  items: z.array(ReceiptItemSchema).min(1),
  total: z.number(),
  paymentMethod: z.enum(['cash', 'card', 'transfer']),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientPhone: z.string().optional(),
  provider: z.enum(['atol', 'evotor', 'cloudkassir']).optional(),
})

function parseCashierSettings(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'object' || raw === null) return null
  return raw as Record<string, unknown>
}

function getStringField(obj: Record<string, unknown>, key: string): string {
  const val = obj[key]
  return typeof val === 'string' ? val : ''
}

export async function POST(req: NextRequest) {
  const authResult = await requireTenantAuth()
  if (authResult.error) return authResult.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Неверный формат JSON')
  }

  let data: z.infer<typeof SendReceiptSchema>
  try {
    data = SendReceiptSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка валидации')
  }

  await connectToDatabase()

  // Load cashier settings from Company
  const company = await Company.findOne({ dbName: authResult.session!.user.dbName }).lean() as Record<string, unknown> | null
  if (!company) return err('Компания не настроена', 500)

  const cashierSettings = parseCashierSettings(
    (company as Record<string, unknown>)['cashierSettings']
  )

  const activeProvider = data.provider
    ?? (cashierSettings ? getStringField(cashierSettings, 'provider') : '')

  if (!activeProvider) {
    return err('Провайдер кассы не указан и не настроен в системе')
  }

  const receiptData: CashierReceiptData = {
    orderId: data.orderId,
    externalId: `order-${data.orderId}-${Date.now()}`,
    items: data.items,
    total: data.total,
    paymentMethod: data.paymentMethod,
    clientEmail: data.clientEmail || undefined,
    clientPhone: data.clientPhone || undefined,
    cashierName: authResult.session!.user.name ?? 'Кассир',
  }

  // Persist receipt record in pending state
  const receipt = await FiscalReceipt.create({
    orderId: data.orderId,
    type: 'sale',
    items: data.items.map((item) => ({
      name: item.name,
      qty: item.quantity,
      price: item.price,
      vat: 0,
    })),
    total: data.total,
    paymentMethod: data.paymentMethod === 'transfer' ? 'card' : data.paymentMethod,
    status: 'pending',
    provider: activeProvider,
  })

  // Dispatch to the appropriate adapter
  let result: { success: boolean; uuid?: string; receiptId?: string; receiptUrl?: string; error?: string }

  if (activeProvider === 'atol') {
    const providerCfg = parseCashierSettings(
      cashierSettings ? cashierSettings['atol'] : null
    )
    if (!providerCfg) {
      receipt.status = 'error'
      receipt.errorMessage = 'Настройки АТОЛ не найдены'
      await receipt.save()
      return err('Настройки АТОЛ не найдены')
    }
    const atolConfig: AtolConfig = {
      login: getStringField(providerCfg, 'login'),
      password: getStringField(providerCfg, 'password'),
      groupCode: getStringField(providerCfg, 'groupCode'),
      inn: getStringField(providerCfg, 'inn'),
      paymentAddress: getStringField(providerCfg, 'paymentAddress'),
      sno: getStringField(providerCfg, 'sno') || 'usn_income',
      callbackUrl: getStringField(providerCfg, 'callbackUrl') || '',
      companyEmail: getStringField(providerCfg, 'companyEmail') || '',
    }
    result = await sendReceiptAtol(atolConfig, receiptData)
  } else if (activeProvider === 'evotor') {
    const providerCfg = parseCashierSettings(
      cashierSettings ? (cashierSettings['evoter'] ?? cashierSettings['evotor']) : null
    )
    if (!providerCfg) {
      receipt.status = 'error'
      receipt.errorMessage = 'Настройки Эвотор не найдены'
      await receipt.save()
      return err('Настройки Эвотор не найдены')
    }
    const evotorConfig: EvotorConfig = {
      token: getStringField(providerCfg, 'token'),
      storeId: getStringField(providerCfg, 'storeId'),
    }
    result = await sendReceiptEvotor(evotorConfig, receiptData)
  } else if (activeProvider === 'cloudkassir') {
    const providerCfg = parseCashierSettings(
      cashierSettings ? (cashierSettings['cloudKassir'] ?? cashierSettings['cloudkassir']) : null
    )
    if (!providerCfg) {
      receipt.status = 'error'
      receipt.errorMessage = 'Настройки CloudKassir не найдены'
      await receipt.save()
      return err('Настройки CloudKassir не найдены')
    }
    const cloudkassirConfig: CloudkassirConfig = {
      apiKey: getStringField(providerCfg, 'apiKey'),
      groupCode: getStringField(providerCfg, 'groupCode'),
      keyName: getStringField(providerCfg, 'keyName'),
    }
    result = await sendReceiptCloudkassir(cloudkassirConfig, receiptData)
  } else {
    receipt.status = 'error'
    receipt.errorMessage = `Неизвестный провайдер: ${activeProvider}`
    await receipt.save()
    return err(`Неизвестный провайдер: ${activeProvider}`)
  }

  // Update the receipt record with the outcome
  if (result.success) {
    receipt.status = 'registered'
    receipt.receiptId = result.receiptId ?? result.uuid
    receipt.uuid = result.uuid
  } else {
    receipt.status = 'error'
    receipt.errorMessage = result.error ?? 'Неизвестная ошибка провайдера'
  }
  await receipt.save()

  if (!result.success) {
    return err(result.error ?? 'Ошибка отправки чека в кассу', 502)
  }

  return ok({
    receiptId: receipt.receiptId,
    receiptUrl: result.receiptUrl ?? null,
  }, 201)
}
