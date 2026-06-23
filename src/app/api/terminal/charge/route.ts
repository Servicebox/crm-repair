import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import Company from '@/models/Company'

const ChargeSchema = z.object({
  amount: z.number().positive(),
  orderNumber: z.string(),
  orderId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  let body: unknown
  try { body = await req.json() } catch { return err('Неверный JSON', 400) }

  const parsed = ChargeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message, 400)

  const { amount, orderNumber } = parsed.data

  await connectToDatabase()
  const company = await Company.findOne().lean() as Record<string, unknown> | null
  const cashierSettings = company?.cashierSettings as Record<string, unknown> | undefined
  const terminalUrl = (cashierSettings?.terminal as Record<string, unknown> | undefined)?.url as string | undefined

  // If no terminal URL configured → manual mode (user confirms in UI)
  if (!terminalUrl) {
    return ok({ success: true, manualMode: true, message: 'Терминал не настроен — используйте ручное подтверждение' })
  }

  // Send payment request to configured terminal (LifePay-compatible JSON API)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(terminalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        description: `Заказ ${orderNumber}`,
        external_id: orderNumber,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return err(`Терминал вернул ошибку: ${response.status}`, 502)
    }

    const result = await response.json() as Record<string, unknown>

    if (result.success || result.status === 'approved' || result.result === 'ok') {
      return ok({ success: true, sessionId: result.session_id ?? result.id, receipt: result.receipt })
    }

    return err((result.message as string) ?? 'Оплата отклонена терминалом', 402)
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      return err('Терминал не отвечает (timeout 30s)', 504)
    }
    return err('Нет связи с терминалом', 503)
  }
}
