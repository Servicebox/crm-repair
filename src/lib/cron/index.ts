import cron from 'node-cron'
import { checkSubscriptions } from './checkSubscriptions'

declare global {
  // eslint-disable-next-line no-var
  var __cronRegistered: boolean | undefined
}

export function startCronJobs(): void {
  // Guard against pm2 cluster: only run on instance 0
  const instance = process.env.NODE_APP_INSTANCE
  if (instance !== undefined && instance !== '0') {
    console.log(`[cron] skip — pm2 instance ${instance}`)
    return
  }

  // Guard against double-registration on hot-reload
  if (global.__cronRegistered) {
    console.log('[cron] already registered')
    return
  }
  global.__cronRegistered = true

  // Every night at 02:00 Moscow time
  cron.schedule(
    '0 2 * * *',
    async () => {
      console.log('[cron] checkSubscriptions start', new Date().toISOString())
      try {
        const result = await checkSubscriptions()
        console.log('[cron] done', result)
      } catch (err) {
        console.error('[cron] error', err)
      }
    },
    { timezone: 'Europe/Moscow' }
  )

  console.log('[cron] scheduler registered')
}
