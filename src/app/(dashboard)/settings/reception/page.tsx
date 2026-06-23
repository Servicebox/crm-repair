'use client'
import { useState, useEffect } from 'react'
import { ClipboardList, Plus, Trash2, Save } from 'lucide-react'

interface FieldConfig {
  key: string
  label: string
  visible: boolean
  required: boolean
}

interface CustomField {
  id: string
  label: string
}

interface ReceptionSettings {
  fields: FieldConfig[]
  customFields: CustomField[]
}

const DEFAULT_FIELDS: FieldConfig[] = [
  { key: 'color', label: 'Цвет устройства', visible: true, required: false },
  { key: 'serial', label: 'Серийный номер', visible: true, required: false },
  { key: 'imei', label: 'IMEI', visible: true, required: false },
  { key: 'password', label: 'Пароль устройства', visible: true, required: false },
  { key: 'condition', label: 'Внешнее состояние', visible: true, required: false },
  { key: 'completeness', label: 'Комплектация', visible: true, required: false },
  { key: 'readyDate', label: 'Дата готовности', visible: true, required: false },
  { key: 'warranty', label: 'Гарантия (дней)', visible: true, required: false },
  { key: 'priority', label: 'Приоритет', visible: true, required: false },
  { key: 'orderType', label: 'Тип заказа (B2C/B2B)', visible: true, required: false },
  { key: 'notes', label: 'Заметки', visible: true, required: false },
]

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      } ${checked ? 'bg-blue-600' : 'bg-muted-foreground/30'}`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function ReceptionSettingsPage() {
  const [fields, setFields] = useState<FieldConfig[]>(DEFAULT_FIELDS)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/reception')
        const json = await res.json() as { success: boolean; data: ReceptionSettings | null }
        if (json.success && json.data) {
          setFields(json.data.fields ?? DEFAULT_FIELDS)
          setCustomFields(json.data.customFields ?? [])
        }
      } catch {
        // use defaults on error
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  function updateField(key: string, patch: Partial<FieldConfig>) {
    setFields(prev =>
      prev.map(f => (f.key === key ? { ...f, ...patch } : f)),
    )
  }

  function handleVisibleToggle(key: string, visible: boolean) {
    setFields(prev =>
      prev.map(f =>
        f.key === key
          ? { ...f, visible, required: visible ? f.required : false }
          : f,
      ),
    )
  }

  function addCustomField() {
    const label = newFieldLabel.trim()
    if (!label) return
    setCustomFields(prev => [...prev, { id: `custom_${Date.now()}`, label }])
    setNewFieldLabel('')
  }

  function removeCustomField(id: string) {
    setCustomFields(prev => prev.filter(f => f.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/settings/reception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, customFields }),
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Форма приёмки</h1>
          <p className="text-sm text-muted-foreground">Настройка полей при создании заказа</p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="space-y-6">
          {/* Fields table */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Поле</th>
                  <th className="px-4 py-3 font-medium text-xs text-muted-foreground text-center w-28">Показывать</th>
                  <th className="px-4 py-3 font-medium text-xs text-muted-foreground text-center w-28">Обязательное</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => (
                  <tr key={field.key} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                    <td className="px-4 py-3 font-medium">{field.label}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Toggle
                          checked={field.visible}
                          onChange={v => handleVisibleToggle(field.key, v)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Toggle
                          checked={field.required}
                          onChange={v => updateField(field.key, { required: v })}
                          disabled={!field.visible}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
            Клиент, бренд, модель и описание неисправности обязательны всегда. Для «Услуги» поля устройства не требуются.
          </p>

          {/* Custom fields */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-base">Свои поля</h2>

            {customFields.length > 0 && (
              <ul className="space-y-2">
                {customFields.map(cf => (
                  <li key={cf.id} className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
                    <span className="flex-1 text-sm">{cf.label}</span>
                    <button
                      type="button"
                      onClick={() => removeCustomField(cf.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                      aria-label={`Удалить поле «${cf.label}»`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newFieldLabel}
                onChange={e => setNewFieldLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomField() }}
                placeholder="Название поля"
                className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addCustomField}
                disabled={!newFieldLabel.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                Добавить поле
              </button>
            </div>
          </div>

          {/* Save */}
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
