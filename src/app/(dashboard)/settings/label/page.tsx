'use client'
import { useState, useEffect } from 'react'
import { Tag, AlertTriangle, Save } from 'lucide-react'

interface LabelField {
  key: string
  label: string
  warning?: string
}

interface LabelSettings {
  enabled: Record<string, boolean>
}

const LABEL_FIELDS: LabelField[] = [
  { key: 'model', label: 'Модель устройства' },
  { key: 'fault', label: 'Неисправность' },
  {
    key: 'password',
    label: 'Пароль устройства',
    warning: 'Наклейка видна посторонним',
  },
  {
    key: 'phone',
    label: 'Телефон клиента',
    warning: 'Наклейка видна посторонним',
  },
  { key: 'date', label: 'Дата приёмки' },
  { key: 'qr', label: 'QR-код на карточку заказа' },
]

const DEFAULT_ENABLED: Record<string, boolean> = {
  model: true,
  fault: true,
  password: false,
  phone: false,
  date: true,
  qr: true,
}

export default function LabelSettingsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(DEFAULT_ENABLED)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/label')
        const json = await res.json() as { success: boolean; data: LabelSettings | null }
        if (json.success && json.data?.enabled) {
          setEnabled(json.data.enabled)
        }
      } catch {
        // use defaults on error
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  function toggle(key: string) {
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/settings/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // silently fail in demo mode
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
          <Tag className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Настройка этикетки 40×30</h1>
          <p className="text-sm text-muted-foreground">
            Этикетка печатается из карточки заказа на термопринтер. Номер заказа печатается всегда.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="space-y-5">
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-base mb-1">Поля на этикетке</h2>
            {LABEL_FIELDS.map(field => (
              <label
                key={field.key}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={enabled[field.key] ?? false}
                  onChange={() => toggle(field.key)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium group-hover:text-foreground transition-colors">
                    {field.label}
                  </span>
                  {field.warning && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {field.warning}
                      </span>
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              {saved ? 'Сохранено' : saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
