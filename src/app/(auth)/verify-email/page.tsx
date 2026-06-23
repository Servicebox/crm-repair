'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Токен не указан')
      return
    }

    const controller = new AbortController()
    const url = new URL('/api/auth/verify-email', window.location.origin)
    url.searchParams.set('token', token)

    fetch(url.toString(), { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStatus('success')
          setMessage(data.message)
        } else {
          setStatus('error')
          setMessage(data.error ?? 'Ошибка верификации')
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setStatus('error')
        setMessage('Ошибка сети')
      })

    return () => controller.abort()
  }, [token])

  return (
    <>
      {status === 'loading' && (
        <>
          <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-slate-800">Проверяем токен...</h2>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Email подтверждён!</h2>
          <p className="text-slate-600 mb-6">{message}</p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition"
          >
            Войти в систему
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Ошибка</h2>
          <p className="text-slate-600 mb-6">{message}</p>
          <Link
            href="/register"
            className="inline-block bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2.5 px-6 rounded-lg transition"
          >
            Зарегистрироваться снова
          </Link>
        </>
      )}
    </>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <Suspense fallback={<Loader2 className="w-16 h-16 text-blue-500 mx-auto animate-spin" />}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  )
}
