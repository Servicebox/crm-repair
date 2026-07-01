'use client'
import { useCallback, useRef } from 'react'

export function useNotifications() {
  // Track whether we already asked for permission this session
  const askedRef = useRef(false)

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    // Ask at most once per session to avoid repeated prompts
    if (askedRef.current) return false
    askedRef.current = true
    const result = await Notification.requestPermission()
    return result === 'granted'
  }, [])

  /**
   * Show an OS-level notification.
   * - Skipped when the tab is in the foreground (user already sees the message)
   * - Requires browser notification permission (asks once automatically)
   * - tag: replaces a previous notification with the same tag (prevents pile-up)
   */
  const showNotification = useCallback(async (
    title: string,
    body: string,
    tag = 'crm-chat',
  ) => {
    // Tab is active — no need for a popup
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return
    const granted = await ensurePermission()
    if (!granted) return
    try {
      const n = new Notification(title, { body, tag, silent: false })
      // Click on OS notification → focus the CRM tab
      n.onclick = () => { window.focus(); n.close() }
      setTimeout(() => n.close(), 7000)
    } catch {}
  }, [ensurePermission])

  return { showNotification }
}
