import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

function isPlatformOwner(email: string | null | undefined) {
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL
  return ownerEmail && email === ownerEmail
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email || !isPlatformOwner(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Try PM2 logs first
    const { stdout } = await execAsync('pm2 logs crm-repair --lines 200 --nostream 2>&1 || pm2 logs --lines 200 --nostream 2>&1', { timeout: 5000 })
    return NextResponse.json({ data: stdout, source: 'pm2' })
  } catch {
    // Fallback: read Next.js logs if available
    try {
      const { stdout } = await execAsync('tail -n 200 /var/log/crm-repair.log 2>/dev/null || journalctl -u crm-repair -n 200 --no-pager 2>&1', { timeout: 5000 })
      return NextResponse.json({ data: stdout, source: 'system' })
    } catch {
      return NextResponse.json({ data: 'Логи недоступны. Запустите приложение через PM2 или проверьте доступ к системным логам.', source: 'none' })
    }
  }
}
