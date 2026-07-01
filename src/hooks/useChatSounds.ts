'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'chat-sound-muted'
const SRC_SEND = '/sounds/send.mp3'
const SRC_RECV = '/sounds/delivered.mp3'

export function useChatSounds() {
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  const isMutedRef = useRef(isMuted)
  const ctxRef = useRef<AudioContext | null>(null)
  const bufs = useRef<Record<string, AudioBuffer | undefined>>({})
  const unlockedRef = useRef(false)

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  // Create AudioContext and preload both buffers
  useEffect(() => {
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ctxRef.current = ctx

    const load = async (src: string) => {
      try {
        const res = await fetch(src)
        const arr = await res.arrayBuffer()
        bufs.current[src] = await ctx.decodeAudioData(arr)
      } catch {}
    }
    load(SRC_SEND)
    load(SRC_RECV)

    return () => { ctx.close().catch(() => {}) }
  }, [])

  // Unlock AudioContext on first user gesture (click / key / touch)
  // After unlock, AudioContext plays audio freely — even in background tabs
  useEffect(() => {
    if (typeof window === 'undefined') return

    const unlock = () => {
      if (unlockedRef.current) return
      const ctx = ctxRef.current
      if (!ctx) return
      const finish = () => { unlockedRef.current = true }
      if (ctx.state === 'suspended') ctx.resume().then(finish).catch(() => {})
      else finish()
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }

    window.addEventListener('click', unlock)
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchstart', unlock)

    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [])

  const playBuffer = useCallback((src: string) => {
    if (isMutedRef.current) return
    const ctx = ctxRef.current
    const buf = bufs.current[src]
    if (!ctx || !buf) return
    const play = () => {
      try {
        const s = ctx.createBufferSource()
        s.buffer = buf
        s.connect(ctx.destination)
        s.start(0)
      } catch {}
    }
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {})
    else play()
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      isMutedRef.current = next
      return next
    })
  }, [])

  const playSend     = useCallback(() => playBuffer(SRC_SEND), [playBuffer])
  const playReceived = useCallback(() => playBuffer(SRC_RECV), [playBuffer])

  return { isMuted, toggleMute, playSend, playReceived }
}
