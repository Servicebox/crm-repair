import { NextResponse } from 'next/server'
import {
  verifyPaymentWithYookassa,
  handlePaymentSucceeded,
  handlePaymentCanceled,
  type YookassaWebhookPayload,
} from '@/lib/payments/webhook'

// Edge Runtime не поддерживает MongoDB
export const runtime = 'nodejs'

export async function POST(request: Request) {
  let payload: YookassaWebhookPayload
  try {
    payload = JSON.parse(await request.text())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const paymentId = payload.object?.id
  if (!paymentId) {
    return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 })
  }

  try {
    // Верификация: сверяем статус с YooKassa API
    const verified = await verifyPaymentWithYookassa(paymentId)
    if (verified.status !== payload.object.status) {
      // 200 — не раскрываем факт обнаружения, не просим retry
      console.warn('[webhook] status mismatch for payment:', paymentId)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    switch (payload.event) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(payload.object)
        break
      case 'payment.canceled':
        await handlePaymentCanceled(payload.object)
        break
      default:
        console.log('[webhook] unhandled event:', payload.event)
    }
  } catch (error) {
    console.error('[webhook/yookassa] processing error:', error)
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
