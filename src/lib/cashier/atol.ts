import type { AtolConfig, CashierReceiptData, CashierResult } from './types'

const ATOL_BASE_URL = 'https://online.atol.ru/possystem/v4'

interface AtolTokenResponse {
  token: string
  timestamp: string
}

interface AtolSellResponse {
  uuid: string
  timestamp: string
  status: string
  error?: {
    code: number
    text: string
    type: string
  }
}

function formatAtolTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

function mapPaymentType(method: 'cash' | 'card' | 'transfer'): number {
  // ATOL: 1 — cash, 2 — card/non-cash
  if (method === 'cash') return 1
  return 2
}

async function getAtolToken(config: AtolConfig): Promise<string> {
  const res = await fetch(`${ATOL_BASE_URL}/getToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ login: config.login, pass: config.password }),
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`ATOL getToken HTTP ${res.status}`)
  }

  const data = (await res.json()) as AtolTokenResponse
  if (!data.token) {
    throw new Error('ATOL: token not returned')
  }
  return data.token
}

export async function sendReceiptAtol(
  config: AtolConfig,
  receiptData: CashierReceiptData,
  operation: 'sell' | 'sell_refund' = 'sell'
): Promise<CashierResult> {
  try {
    const token = await getAtolToken(config)

    const now = new Date()
    const body = {
      timestamp: formatAtolTimestamp(now),
      external_id: receiptData.externalId,
      service: {
        callback_url: config.callbackUrl ?? '',
      },
      receipt: {
        client: {
          email: receiptData.clientEmail ?? '',
          phone: receiptData.clientPhone ?? '',
        },
        company: {
          email: config.companyEmail ?? '',
          sno: config.sno ?? 'usn_income',
          inn: config.inn,
          payment_address: config.paymentAddress,
        },
        ...(receiptData.cashierName ? { cashier: { name: receiptData.cashierName } } : {}),
        items: receiptData.items.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sum: item.amount,
          tax: { type: item.tax },
          payment_method: item.paymentMethod,
          payment_object: item.paymentObject,
        })),
        payments: [
          {
            type: mapPaymentType(receiptData.paymentMethod),
            sum: receiptData.total,
          },
        ],
        total: receiptData.total,
      },
    }

    const res = await fetch(`${ATOL_BASE_URL}/${config.groupCode}/${operation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Token: token,
      },
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `ATOL HTTP ${res.status}: ${text}` }
    }

    const data = (await res.json()) as AtolSellResponse

    if (data.error) {
      return {
        success: false,
        error: `ATOL error ${data.error.code}: ${data.error.text}`,
      }
    }

    return {
      success: true,
      uuid: data.uuid,
      receiptId: data.uuid,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown ATOL error'
    return { success: false, error: message }
  }
}
