import type { EvotorConfig, CashierReceiptData, CashierResult } from './types'

const EVOTOR_BASE_URL = 'https://api.evotor.ru/api/v1/inventories/stores'

interface EvotorSellResponse {
  uuid?: string
  id?: string
  status?: string
  error?: string
  message?: string
}

function mapEvotorPaymentMethod(method: 'cash' | 'card' | 'transfer'): string {
  if (method === 'cash') return 'CASH'
  return 'CARD'
}

export async function sendReceiptEvotor(
  config: EvotorConfig,
  receiptData: CashierReceiptData
): Promise<CashierResult> {
  try {
    const body = {
      externalId: receiptData.externalId,
      positions: receiptData.items.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        totalSum: item.amount,
        tax: {
          type: item.tax.toUpperCase(),
        },
      })),
      payments: [
        {
          type: mapEvotorPaymentMethod(receiptData.paymentMethod),
          sum: receiptData.total,
        },
      ],
      totalSum: receiptData.total,
      clientInfo: {
        email: receiptData.clientEmail,
        phone: receiptData.clientPhone,
      },
    }

    const res = await fetch(`${EVOTOR_BASE_URL}/${config.storeId}/sell`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': config.token,
      },
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Evotor HTTP ${res.status}: ${text}` }
    }

    const data = (await res.json()) as EvotorSellResponse

    if (data.error || data.message) {
      return {
        success: false,
        error: data.error ?? data.message ?? 'Evotor unknown error',
      }
    }

    const uuid = data.uuid ?? data.id
    return {
      success: true,
      uuid,
      receiptId: uuid,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown Evotor error'
    return { success: false, error: message }
  }
}
