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

  // Верификация: сверяем статус с YooKassa API
  const isVerified = await verifyPaymentWithYookassa(paymentId, payload.object.status)
  if (!isVerified) {
    // 200 — не раскрываем факт обнаружения, не просим retry
    console.warn('[webhook] status mismatch for payment:', paymentId)
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  try {
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
  } catch (err) {
    console.error('[webhook] processing error:', err)
    // 500 → YooKassa повторит попытку
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
