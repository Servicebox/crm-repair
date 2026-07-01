const TG_BASE = 'https://api.telegram.org/bot'

export async function tgSendMessage(token: string, chatId: string | number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${TG_BASE}${token}/sendMessage`, {
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
    const res = await fetch(`${TG_BASE}${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: secretToken,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      }),
    })
    return res.json()
  } catch {
    return { ok: false, description: 'Network error' }
  }
}

export async function tgDeleteWebhook(token: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${TG_BASE}${token}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true }),
    })
    return res.json()
  } catch {
    return { ok: false }
  }
}

export async function tgGetMe(
  token: string
): Promise<{ ok: boolean; result?: { id: number; username: string; first_name: string } }> {
  try {
    const res = await fetch(`${TG_BASE}${token}/getMe`)
    return res.json()
  } catch {
    return { ok: false }
  }
}
