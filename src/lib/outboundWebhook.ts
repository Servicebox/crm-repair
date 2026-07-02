import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'

export type WebhookEvent = 'order.created' | 'order.status_changed' | 'payment.received'

interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

function sign(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

async function send(url: string, secret: string | undefined, payload: WebhookPayload): Promise<boolean> {
  try {
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ServiceBoxCRM-Webhook/1.0',
    }
    if (secret) {
      headers['X-Webhook-Signature'] = `sha256=${sign(secret, body)}`
    }
    const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Fire-and-forget: sends outbound webhook if configured for this company and event type.
 */
export function fireWebhook(
  companyId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): void {
  _fireWebhook(companyId, event, data).catch(() => undefined)
}

async function _fireWebhook(
  companyId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  await connectToDatabase()
  const company = await Company.findById(companyId)
    .select('outboundWebhook')
    .lean() as { outboundWebhook?: { url?: string; secret?: string; events?: Record<string, boolean> } } | null

  const cfg = company?.outboundWebhook
  if (!cfg?.url) return

  const eventKey = event === 'order.created' ? 'newOrder'
    : event === 'order.status_changed' ? 'statusChange'
    : 'payment'

  if (cfg.events && cfg.events[eventKey] === false) return

  await send(cfg.url, cfg.secret, {
    event,
    timestamp: new Date().toISOString(),
    data,
  })
}
