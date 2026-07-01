const TG_BASE = 'https://api.telegram.org/bot'

async function tgFetch(url: string, init?: RequestInit): Promise<Response> {
  const proxyUrl = process.env.TELEGRAM_PROXY_URL
  if (proxyUrl) {
    // Use undici ProxyAgent when proxy is configured (needed on hosts that block Telegram)
    const { ProxyAgent, fetch: undiciFetch } = await import('undici')
    const dispatcher = new ProxyAgent(proxyUrl)
    return undiciFetch(url, { ...init, dispatcher } as Parameters<typeof undiciFetch>[1]) as unknown as Response
  }
  return fetch(url, init)
}

export async function tgSendMessage(token: string, chatId: string | number, text: string): Promise<boolean> {
  try {
    const res = await tgFetch(`${TG_BASE}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function tgSetWebhook(
  token: string,
  url: string,
  secretToken: string
): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await tgFetch(`${TG_BASE}${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: secretToken,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      }),
    })
    return res.json() as Promise<{ ok: boolean; description?: string }>
  } catch {
    return { ok: false, description: 'network_error' }
  }
}

export async function tgDeleteWebhook(token: string): Promise<{ ok: boolean }> {
  try {
    const res = await tgFetch(`${TG_BASE}${token}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true }),
    })
    return res.json() as Promise<{ ok: boolean }>
  } catch {
    return { ok: false }
  }
}

export async function tgGetMe(
  token: string
): Promise<{ ok: boolean; result?: { id: number; username: string; first_name: string }; network_error?: boolean }> {
  try {
    const res = await tgFetch(`${TG_BASE}${token}/getMe`)
    return res.json() as Promise<{ ok: boolean; result?: { id: number; username: string; first_name: string } }>
  } catch {
    return { ok: false, network_error: true }
  }
}
