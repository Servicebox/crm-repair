type RateLimitEntry = { count: number; resetAt: number }

const store = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 60_000)

export interface RateLimitOptions {
  limit: number
  windowMs: number
}

export function checkRateLimit(key: string, options: RateLimitOptions): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    const resetAt = now + options.windowMs
    store.set(key, { count: 1, resetAt })
    return { ok: true, remaining: options.limit - 1, resetAt }
  }

  entry.count++
  store.set(key, entry)

  const ok = entry.count <= options.limit
  return { ok, remaining: Math.max(0, options.limit - entry.count), resetAt: entry.resetAt }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
