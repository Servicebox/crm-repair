'use client'
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, Building2, Palette, Bell, Wrench, Shield } from 'lucide-react'

type FieldProps = {
  label: string
  name: string
  type?: string
  placeholder?: string
  value: string
  onChange: (val: string) => void
}

function Field({ label, name, type = 'text', placeholder, value, onChange }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
      />
    </div>
  )
}

const TABS = [
  { key: 'company', label: 'Компания', icon: Building2 },
  { key: 'branding', label: 'Брендинг', icon: Palette },
  { key: 'reception', label: 'Приёмка', icon: Wrench },
  { key: 'notifications', label: 'Уведомления', icon: Bell },
  { key: 'security', label: 'Безопасность', icon: Shield },
]

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('company')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})

  const { data: company } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      const json = await res.json()
      return json.data
    },
  })

  useEffect(() => {
    if (company) setForm(company)
  }, [company])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    queryClient.invalidateQueries({ queryKey: ['settings'] })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Настройки</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Сохранено!' : 'Сохранить'}
        </button>
      </div>

      <div className="flex gap-4">
        {/* Sidebar tabs */}
        <div className="w-48 shrink-0 space-y-0.5">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-blue-600 text-white' : 'hover:bg-accent'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-card border rounded-xl p-6">
          {tab === 'company' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg mb-4">Основные данные</h2>
              <Field label="Название компании" name="name" placeholder="ООО Сервисный центр" value={(form.name as string) ?? ''} onChange={val => setForm(p => ({ ...p, name: val }))} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Телефон" name="phone" placeholder="+7 999 000 00 00" value={(form.phone as string) ?? ''} onChange={val => setForm(p => ({ ...p, phone: val }))} />
                <Field label="Email" name="email" type="email" placeholder="info@service.ru" value={(form.email as string) ?? ''} onChange={val => setForm(p => ({ ...p, email: val }))} />
              </div>
              <Field label="Адрес" name="address" placeholder="г. Москва, ул. Тверская, д. 1" value={(form.address as string) ?? ''} onChange={val => setForm(p => ({ ...p, address: val }))} />
              <Field label="Сайт" name="website" placeholder="https://myservice.ru" value={(form.website as string) ?? ''} onChange={val => setForm(p => ({ ...p, website: val }))} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="ИНН" name="inn" placeholder="1234567890" value={(form.inn as string) ?? ''} onChange={val => setForm(p => ({ ...p, inn: val }))} />
                <Field label="ОГРН" name="ogrn" placeholder="1234567890123" value={(form.ogrn as string) ?? ''} onChange={val => setForm(p => ({ ...p, ogrn: val }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Гарантия по умолчанию (дней)</label>
                  <input
                    type="number"
                    value={(form.defaultWarrantyDays as number) ?? 30}
                    onChange={e => setForm(p => ({ ...p, defaultWarrantyDays: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Срок готовности по умолчанию (дней)</label>
                  <input
                    type="number"
                    value={(form.defaultReadyDays as number) ?? 3}
                    onChange={e => setForm(p => ({ ...p, defaultReadyDays: +e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    min={1}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'branding' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg mb-4">Брендинг</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Фирменный цвет</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={(form.brandColor as string) ?? '#3b82f6'}
                      onChange={e => setForm(p => ({ ...p, brandColor: e.target.value }))}
                      className="w-12 h-10 border rounded-lg cursor-pointer p-1"
                    />
                    <input
                      value={(form.brandColor as string) ?? '#3b82f6'}
                      onChange={e => setForm(p => ({ ...p, brandColor: e.target.value }))}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Префикс номера заказа</label>
                  <input
                    value={(form.orderPrefix as string) ?? 'SB'}
                    onChange={e => setForm(p => ({ ...p, orderPrefix: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    maxLength={5}
                    placeholder="SB"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Пример: SB-000001</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL логотипа</label>
                <input
                  value={(form.logo as string) ?? ''}
                  onChange={e => setForm(p => ({ ...p, logo: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
                {!!form.logo && (
                  <img src={form.logo as string} alt="Logo" className="mt-2 h-16 object-contain rounded border" />
                )}
              </div>
            </div>
          )}

          {tab === 'reception' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg mb-4">Приёмка и квитанция</h2>
              <div>
                <label className="block text-sm font-medium mb-1">Текст в подвале квитанции</label>
                <textarea
                  value={((form.receiptSettings as Record<string, unknown>)?.footerText as string) ?? ''}
                  onChange={e => setForm(p => ({ ...p, receiptSettings: { ...(p.receiptSettings as Record<string, unknown>), footerText: e.target.value } }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Спасибо за ваш заказ!"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium block">Показывать в квитанции:</label>
                {[
                  ['showLogo', 'Логотип компании'],
                  ['showRequisites', 'Реквизиты компании'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!((form.receiptSettings as Record<string, unknown>)?.[key])}
                      onChange={e => setForm(p => ({ ...p, receiptSettings: { ...(p.receiptSettings as Record<string, unknown>), [key]: e.target.checked } }))}
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg mb-4">Шаблоны уведомлений</h2>
              <p className="text-sm text-muted-foreground">
                Доступные переменные: {'{{number}}'}, {'{{status}}'}, {'{{address}}'}, {'{{clientName}}'}
              </p>
              {[
                ['statusChange', 'Смена статуса', 'Статус вашего заказа {{number}} изменён на «{{status}}»'],
                ['ready', 'Готов к выдаче', 'Ваш заказ {{number}} готов к выдаче!'],
                ['issued', 'Заказ выдан', 'Заказ {{number}} выдан. Спасибо за доверие!'],
              ].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <textarea
                    value={((form.notificationTemplates as Record<string, unknown>)?.[key] as string) ?? ''}
                    onChange={e => setForm(p => ({ ...p, notificationTemplates: { ...(p.notificationTemplates as Record<string, unknown>), [key]: e.target.value } }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg mb-4">Безопасность и интеграции</h2>
              <div>
                <label className="block text-sm font-medium mb-1">Telegram Bot Token</label>
                <input
                  type="password"
                  value={(form.telegramBotToken as string) ?? ''}
                  onChange={e => setForm(p => ({ ...p, telegramBotToken: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="123456789:ABCdefGHI..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">VK Group ID</label>
                  <input
                    value={(form.vkGroupId as string) ?? ''}
                    onChange={e => setForm(p => ({ ...p, vkGroupId: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">VK Access Token</label>
                  <input
                    type="password"
                    value={(form.vkAccessToken as string) ?? ''}
                    onChange={e => setForm(p => ({ ...p, vkAccessToken: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="vk1.a.XXX..."
                  />
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-6">
                <h3 className="font-semibold text-red-700 mb-1">Опасная зона</h3>
                <p className="text-sm text-red-600 mb-3">
                  Полный сброс CRM до состояния при регистрации. Только для владельца.
                </p>
                <button
                  type="button"
                  onClick={() => confirm('Вы уверены? Все данные будут удалены!')}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  Сбросить CRM
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
