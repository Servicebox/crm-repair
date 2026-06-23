import type { CloudkassirConfig, CashierReceiptData, CashierResult } from './types'

const CLOUDKASSIR_BASE_URL = 'https://cloudkassir.ru/api/v1/receipts'

interface CloudkassirReceiptResponse {
  id?: string
  uuid?: string
  status?: string
  receiptUrl?: string
  error?: string
  message?: string
}

function mapCloudkassirTax(tax: string): string {
  const map: Record<string, string> = {
    none: 'none',
    vat0: 'vat0',
    vat10: 'vat10',
    vat20: 'vat20',
  }
  return map[tax] ?? 'none'
}

function mapCloudkassirPayment(method: 'cash' | 'card' | 'transfer'): string {
  if (method === 'cash') return 'cash'
  if (method === 'card') return 'electronically'
  return 'advance'
}

export async function sendReceiptCloudkassir(
  config: CloudkassirConfig,
  receiptData: CashierReceiptData
): Promise<CashierResult> {
  try {
    const body = {
      groupCode: config.groupCode,
      keyName: config.keyName,
      receipt: {
        externalId: receiptData.externalId,
        client: {
          email: receiptData.clientEmail,
          phone: receiptData.clientPhone,
        },
        items: receiptData.items.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          amount: item.amount,
          tax: mapCloudkassirTax(item.tax),
          paymentMethod: item.paymentMethod,
          paymentObject: item.paymentObject,
        })),
        payments: [
          {
            type: mapCloudkassirPayment(receiptData.paymentMethod),
            sum: receiptData.total,
          },
        ],
        total: receiptData.total,
      },
    }

    const res = await fetch(CLOUDKASSIR_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `CloudKassir HTTP ${res.status}: ${text}` }
    }

    const data = (await res.json()) as CloudkassirReceiptResponse

    if (data.error || data.message) {
      return {
        success: false,
        error: data.error ?? data.message ?? 'CloudKassir unknown error',
      }
    }

    const uuid = data.uuid ?? data.id
    return {
      success: true,
      uuid,
      receiptId: uuid,
      receiptUrl: data.receiptUrl,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown CloudKassir error'
    return { success: false, error: message }
  }
}
