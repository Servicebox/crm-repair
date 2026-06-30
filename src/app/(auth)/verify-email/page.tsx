'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react'

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Слабый', color: 'bg-red-500' }
  if (score <= 2) return { score, label: 'Средний', color: 'bg-amber-500' }
  if (score <= 3) return { score, label: 'Хороший', color: 'bg-yellow-400' }
  return { score, label: 'Надёжный', color: 'bg-green-500' }
}

function SetPasswordForm({ token, dbName }: { token: string; dbName: string | null }) {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [status, setStatus] = useState<'checking' | 'form' | 'done' | 'error'>('checking')
  const [errorMsg, setErrorMsg] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}${dbName ? `&db=${encodeURIComponent(dbName)}` : ''}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setUserName(data.name ?? '')
          if (data.autoVerified) {
            // User already had a password (registered via /register-org) — go straight to login
            setStatus('done')
            setTimeout(() => router.push('/login'), 3000)
          } else {
            setStatus('form')
          }
        } else {
          setErrorMsg(data.error ?? 'Ссылка недействительна')
          setStatus('error')
        }
      })
      .catch(e => {
        if (e.name === 'AbortError') return
        setErrorMsg('Ошибка сети')
        setStatus('error')
      })
    return () => controller.abort()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setErrorMsg('Пароли не совпадают'); return }
    if (password.length < 8) { setErrorMsg('Минимум 8 символов'); return }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMsg('Пароль должен содержать буквы и цифры')
      return
    }
    setErrorMsg('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, ...(dbName ? { db: dbName } : {}) }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus('done')
        setTimeout(() => router.push('/login'), 3000)
      } else {
        setErrorMsg(data.error ?? 'Ошибка')
      }
    } catch {
      setErrorMsg('Ошибка сети')
    } finally {
      setSubmitting(false)
    }
  }

  const strength = passwordStrength(password)

  if (status === 'checking') {
    return (
      <div className="text-center py-4">
        <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
        <p className="text-slate-600">Проверяем ссылку...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="text-center">
        <XCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Ссылка устарела</h2>
        <p className="text-slate-500 text-sm mb-6">{errorMsg}</p>
        <p className="text-slate-400 text-sm">Попросите администратора отправить новое приглашение.</p>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">
          {userName ? `Добро пожаловать, ${userName}!` : 'Email подтверждён!'}
        </h2>
        <p className="text-slate-500 text-sm mb-4">Ваш аккаунт активирован. Теперь вы можете войти в систему.</p>
        <p className="text-slate-400 text-xs">Переходим на страницу входа...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-center mb-5">
        <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
          <Lock className="w-7 h-7 text-blue-600" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-slate-800 text-center mb-1">
        Добро пожаловать{userName ? `, ${userName}` : ''}!
      </h2>
      <p className="text-slate-500 text-sm text-center mb-6">
        Придумайте пароль для входа в систему
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Новый пароль</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Минимум 8 символов"
              required
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength.score >= i ? strength.color : 'bg-slate-200'}`} />
                ))}
              </div>
              <p className="text-xs text-slate-500">{strength.label}</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Повторите пароль</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={`w-full px-3 py-2.5 pr-10 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                confirm && password !== confirm ? 'border-red-300' : 'border-slate-200'
              }`}
              placeholder="Повторите пароль"
              required
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirm && password !== confirm && (
            <p className="text-xs text-red-500 mt-1">Пароли не совпадают</p>
          )}
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Требования к паролю:</span>
          </div>
          <ul className="ml-5 space-y-0.5 list-disc">
            <li className={password.length >= 8 ? 'text-green-600' : ''}>Минимум 8 символов</li>
            <li className={/[A-Za-z]/.test(password) ? 'text-green-600' : ''}>Содержит буквы</li>
            <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>Содержит цифры</li>
          </ul>
        </div>

        {errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={submitting || password.length < 8 || password !== confirm}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition text-sm"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Установить пароль и войти'}
        </button>
      </form>
    </div>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const dbName = searchParams.get('db')

  if (!token) {
    return (
      <div className="text-center">
        <XCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Ссылка некорректна</h2>
        <p className="text-slate-500 text-sm">Токен не указан в ссылке.</p>
      </div>
    )
  }

  return <SetPasswordForm token={token} dbName={dbName} />
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  )
}
