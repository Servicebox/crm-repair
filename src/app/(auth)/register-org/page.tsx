'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Building2, Eye, EyeOff, Loader2, CheckCircle, ChevronRight } from 'lucide-react'

export default function RegisterOrgPage() {
  const [step, setStep] = useState<'org' | 'admin'>('org')
  const [orgName, setOrgName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 'org') {
      setStep('admin')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/orgs/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, adminName, adminEmail, adminPassword }),
      })

      interface OrgRegisterResponse { message?: string; error?: string; emailSent?: boolean }
      const data = await res.json() as OrgRegisterResponse

      if (!res.ok) {
        setError(data.error ?? 'Ошибка регистрации')
      } else {
        setSuccess(data.message ?? 'Организация создана')
      }
    } catch {
      setError('Ошибка сети. Проверьте подключение.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Организация создана!</h2>
          <p className="text-slate-600 mb-6">{success}</p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition"
          >
            Перейти ко входу
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ServiceBox CRM</h1>
          <p className="text-slate-400 mt-1">Регистрация организации</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${step === 'org' ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'}`}>
              {step === 'org' ? '1' : '✓'}
            </div>
            <div className="text-sm font-medium text-slate-600">Организация</div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${step === 'admin' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
              2
            </div>
            <div className="text-sm font-medium text-slate-600">Аккаунт владельца</div>
          </div>

          <h2 className="text-xl font-semibold text-slate-800 mb-6">
            {step === 'org' ? 'Данные организации' : 'Аккаунт администратора'}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 'org' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Название организации
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="ООО «Мой сервис»"
                  required
                  minLength={2}
                  maxLength={100}
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Название вашего сервисного центра. Данные будут полностью изолированы от других организаций.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ваше имя</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Иван Иванов"
                    required
                    minLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="admin@myservice.ru"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="Минимум 8 символов"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              {step === 'admin' && (
                <button
                  type="button"
                  onClick={() => { setStep('org'); setError('') }}
                  className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 rounded-lg transition"
                >
                  Назад
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {step === 'org'
                  ? 'Далее'
                  : loading
                    ? 'Создаём...'
                    : 'Создать организацию'}
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Уже зарегистрированы?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
