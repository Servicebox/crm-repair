'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'chat-sound-muted'

export function useChatSounds() {
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  // Stable ref so audio callbacks don't need isMuted in their dep array
  const isMutedRef = useRef(isMuted)
  const sendRef = useRef<HTMLAudioElement | null>(null)
  const receivedRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const s = new Audio('/sounds/send.mp3')
    const r = new Audio('/sounds/delivered.mp3')
    s.volume = 0.5
    r.volume = 0.5
    sendRef.current = s
    receivedRef.current = r
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const playSend = useCallback(() => {
    if (isMutedRef.current || !sendRef.current) return
    sendRef.current.currentTime = 0
    sendRef.current.play().catch(() => {})
  }, [])

  const playReceived = useCallback(() => {
    if (isMutedRef.current || !receivedRef.current) return
    receivedRef.current.currentTime = 0
    receivedRef.current.play().catch(() => {})
  }, [])

  return { isMuted, toggleMute, playSend, playReceived }
}
