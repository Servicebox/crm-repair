import { NextRequest } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'
import Company from '@/models/Company'

const SaveSchema = z.object({
  url: z.string().url('Введите корректный URL').max(500).or(z.literal('')),
  events: z.object({
    newOrder: z.boolean(),
    statusChange: z.boolean(),
    payment: z.boolean(),
  }),
  regenerateSecret: z.boolean().optional(),
})

export async function GET() {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  await connectToDatabase()

  const company = await Company.findById(auth.session!.user.companyId)
    .select('outboundWebhook')
    .lean() as { outboundWebhook?: { url?: string; secret?: string; events?: Record<string, boolean> } } | null

  const cfg = company?.outboundWebhook ?? {}
  return ok({
    url: cfg.url ?? '',
    hasSecret: !!cfg.secret,
    events: {
      newOrder: cfg.events?.newOrder ?? true,
      statusChange: cfg.events?.statusChange ?? true,
      payment: cfg.events?.payment ?? false,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  await connectToDatabase()

  try {
    const body = await req.json()
    const data = SaveSchema.parse(body)

    const company = await Company.findById(auth.session!.user.companyId)
      .select('outboundWebhook')
      .lean() as { outboundWebhook?: { url?: string; secret?: string; events?: Record<string, boolean> } } | null

    const existingSecret = (company?.outboundWebhook as { secret?: string } | undefined)?.secret
    const secret = data.regenerateSecret || !existingSecret
      ? crypto.randomBytes(32).toString('hex')
      : existingSecret

    await Company.findByIdAndUpdate(auth.session!.user.companyId, {
      $set: {
        outboundWebhook: {
          url: data.url || null,
          secret,
          events: data.events,
        },
      },
    })

    return ok({ secret: data.regenerateSecret ? secret : undefined })
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка сохранения', 500)
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  await connectToDatabase()

  const company = await Company.findById(auth.session!.user.companyId)
    .select('outboundWebhook')
    .lean() as { outboundWebhook?: { url?: string; secret?: string } } | null

  const cfg = company?.outboundWebhook
  if (!cfg?.url) return err('Webhook URL не настроен', 400)

  try {
    const body = JSON.stringify({
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Тестовый запрос от ServiceBox CRM' },
    })
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ServiceBoxCRM-Webhook/1.0',
    }
    if (cfg.secret) {
      const sig = crypto.createHmac('sha256', cfg.secret).update(body).digest('hex')
      headers['X-Webhook-Signature'] = `sha256=${sig}`
    }
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(8000),
    })
    return ok({ statusCode: res.status, ok: res.ok })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network_error'
    return err(`Ошибка подключения: ${msg}`, 502)
  }
}
