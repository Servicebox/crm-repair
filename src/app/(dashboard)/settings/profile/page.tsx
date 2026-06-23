'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Save, Loader2, User, Lock, Bell, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const TABS = [
  { key: 'profile', label: 'Профиль', icon: User },
  { key: 'password', label: 'Пароль', icon: Lock },
  { key: 'notifications', label: 'Уведомления', icon: Bell },
]

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const [tab, setTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const [name, setName] = useState(session?.user?.name ?? '')
  const [email, setEmail] = useState(session?.user?.email ?? '')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('')

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [notifEmail, setNotifEmail] = useState(true)
  const [notifTelegram, setNotifTelegram] = useState(false)
  const [notifNewOrder, setNotifNewOrder] = useState(true)
  const [notifStatusChange, setNotifStatusChange] = useState(true)
  const [notifReady, setNotifReady] = useState(true)

  async function saveProfile() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, position }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка')
      await update({ name })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }
    if (newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка смены пароля')
    } finally {
      setSaving(false)
    }
  }

  async function saveNotifications() {
    setSaving(true)
    setError('')
    try {
      await fetch('/api/profile/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifEmail, notifTelegram, notifNewOrder, notifStatusChange, notifReady }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  function handleSave() {
    if (tab === 'profile') saveProfile()
    else if (tab === 'password') savePassword()
    else saveNotifications()
  }

  const initials = (session?.user?.name ?? 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 hover:bg-accent rounded-lg transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Мой профиль</h1>
          <p className="text-sm text-muted-foreground">Личные данные и настройки аккаунта</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Сохранено!' : 'Сохранить'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <div className="w-48 shrink-0 space-y-0.5">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError('') }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-blue-600 text-white' : 'hover:bg-accent'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-card border rounded-xl p-6">
          {tab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {initials}
                </div>
                <div>
                  <div className="font-semibold text-lg">{session?.user?.name}</div>
                  <div className="text-sm text-muted-foreground">{session?.user?.email}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 capitalize">{session?.user?.role ?? 'Сотрудник'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Имя</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Иван Иванов"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    value={email}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-muted text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Email изменить нельзя</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Телефон</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+7 999 000 00 00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Должность</label>
                  <input
                    value={position}
                    onChange={e => setPosition(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Мастер по ремонту"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'password' && (
            <div className="space-y-4 max-w-md">
              <h2 className="font-semibold text-lg mb-2">Смена пароля</h2>
              {[
                { label: 'Текущий пароль', value: oldPassword, setter: setOldPassword, show: showOld, toggle: () => setShowOld(p => !p) },
                { label: 'Новый пароль', value: newPassword, setter: setNewPassword, show: showNew, toggle: () => setShowNew(p => !p) },
                { label: 'Подтвердите новый пароль', value: confirmPassword, setter: setConfirmPassword, show: showNew, toggle: () => {} },
              ].map(({ label, value, setter, show, toggle }) => (
                <div key={label}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={value}
                      onChange={e => setter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    />
                    {toggle !== (() => {}) && (
                      <button type="button" onClick={toggle} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Минимум 6 символов</p>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg mb-2">Каналы уведомлений</h2>
              <div className="space-y-2">
                {[
                  [notifEmail, setNotifEmail, 'Email-уведомления', 'Получать уведомления на почту'],
                  [notifTelegram, setNotifTelegram, 'Telegram', 'Получать уведомления в Telegram-бот'],
                ].map(([checked, setter, label, desc]) => (
                  <label key={label as string} className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-accent/50 transition">
                    <input
                      type="checkbox"
                      checked={checked as boolean}
                      onChange={e => (setter as (v: boolean) => void)(e.target.checked)}
                      className="mt-0.5 rounded"
                    />
                    <div>
                      <div className="text-sm font-medium">{label as string}</div>
                      <div className="text-xs text-muted-foreground">{desc as string}</div>
                    </div>
                  </label>
                ))}
              </div>

              <h2 className="font-semibold text-lg mt-6 mb-2">События</h2>
              <div className="space-y-2">
                {[
                  [notifNewOrder, setNotifNewOrder, 'Новый заказ', 'При создании нового заказа на меня'],
                  [notifStatusChange, setNotifStatusChange, 'Смена статуса', 'При изменении статуса заказа'],
                  [notifReady, setNotifReady, 'Готов к выдаче', 'Когда заказ готов для клиента'],
                ].map(([checked, setter, label, desc]) => (
                  <label key={label as string} className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-accent/50 transition">
                    <input
                      type="checkbox"
                      checked={checked as boolean}
                      onChange={e => (setter as (v: boolean) => void)(e.target.checked)}
                      className="mt-0.5 rounded"
                    />
                    <div>
                      <div className="text-sm font-medium">{label as string}</div>
                      <div className="text-xs text-muted-foreground">{desc as string}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
