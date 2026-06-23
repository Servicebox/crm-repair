'use client'
import { useState, useEffect } from 'react'
import { Receipt, Save } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AtolConfig {
  enabled: boolean
  login: string
  password: string
  inn: string
  paymentAddress: string
  url: string
}

interface EvoterConfig {
  enabled: boolean
  token: string
  storeId: string
}

interface CloudKassirConfig {
  enabled: boolean
  apiKey: string
  groupCode: string
  keyName: string
}

type TaxSystem = 'osn' | 'usn_income' | 'usn_income_expense' | 'eshn' | 'patent'

interface GlobalConfig {
  autoReceipt: boolean
  sendEmail: boolean
  taxSystem: TaxSystem
}

interface CashierSettings {
  atol: AtolConfig
  evoter: EvoterConfig
  cloudKassir: CloudKassirConfig
  global: GlobalConfig
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_ATOL: AtolConfig = {
  enabled: false,
  login: '',
  password: '',
  inn: '',
  paymentAddress: '',
  url: 'https://online.atol.ru/possystem/v4/',
}

const DEFAULT_EVOTER: EvoterConfig = {
  enabled: false,
  token: '',
  storeId: '',
}

const DEFAULT_CLOUD_KASSIR: CloudKassirConfig = {
  enabled: false,
  apiKey: '',
  groupCode: '',
  keyName: '',
}

const DEFAULT_GLOBAL: GlobalConfig = {
  autoReceipt: false,
  sendEmail: false,
  taxSystem: 'osn',
}

const TAX_SYSTEMS: { value: TaxSystem; label: string }[] = [
  { value: 'osn', label: 'ОСН' },
  { value: 'usn_income', label: 'УСН доход' },
  { value: 'usn_income_expense', label: 'УСН доход-расход' },
  { value: 'eshn', label: 'ЕСХН' },
  { value: 'patent', label: 'Патент' },
]

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        checked ? 'bg-blue-600' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CashierSettingsPage() {
  const [atol, setAtol] = useState<AtolConfig>(DEFAULT_ATOL)
  const [evoter, setEvoter] = useState<EvoterConfig>(DEFAULT_EVOTER)
  const [cloudKassir, setCloudKassir] = useState<CloudKassirConfig>(DEFAULT_CLOUD_KASSIR)
  const [global, setGlobal] = useState<GlobalConfig>(DEFAULT_GLOBAL)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/cashier')
        const json = await res.json() as { success: boolean; data: CashierSettings | null }
        if (json.success && json.data) {
          setAtol(json.data.atol ?? DEFAULT_ATOL)
          setEvoter(json.data.evoter ?? DEFAULT_EVOTER)
          setCloudKassir(json.data.cloudKassir ?? DEFAULT_CLOUD_KASSIR)
          setGlobal(json.data.global ?? DEFAULT_GLOBAL)
        }
      } catch {
        // use defaults on error
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/settings/cashier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atol, evoter, cloudKassir, global }),
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
        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
          <Receipt className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Кассовая интеграция</h1>
          <p className="text-sm text-muted-foreground">Подключение онлайн-касс и фискализация чеков</p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      ) : (
        <div className="space-y-5">
          {/* ATOL */}
          <section className="bg-card border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-base">АТОЛ</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  АТОЛ 25Ф, 55Ф и другие модели через АТОЛ Онлайн API v4
                </p>
              </div>
              <Toggle checked={atol.enabled} onChange={v => setAtol(p => ({ ...p, enabled: v }))} />
            </div>
            {atol.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <Field
                  label="Login"
                  value={atol.login}
                  onChange={v => setAtol(p => ({ ...p, login: v }))}
                  placeholder="login"
                />
                <Field
                  label="Password"
                  value={atol.password}
                  onChange={v => setAtol(p => ({ ...p, password: v }))}
                  type="password"
                  placeholder="••••••••"
                />
                <Field
                  label="ИНН"
                  value={atol.inn}
                  onChange={v => setAtol(p => ({ ...p, inn: v }))}
                  placeholder="1234567890"
                />
                <Field
                  label="Payment Address"
                  value={atol.paymentAddress}
                  onChange={v => setAtol(p => ({ ...p, paymentAddress: v }))}
                  placeholder="https://yourshop.ru"
                />
                <div className="sm:col-span-2">
                  <Field
                    label="URL"
                    value={atol.url}
                    onChange={v => setAtol(p => ({ ...p, url: v }))}
                    placeholder="https://online.atol.ru/possystem/v4/"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Эвотор */}
          <section className="bg-card border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-base">Эвотор</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Смарт-терминалы Эвотор через облачный API
                </p>
              </div>
              <Toggle checked={evoter.enabled} onChange={v => setEvoter(p => ({ ...p, enabled: v }))} />
            </div>
            {evoter.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <Field
                  label="Token (API ключ)"
                  value={evoter.token}
                  onChange={v => setEvoter(p => ({ ...p, token: v }))}
                  placeholder="evotor-token"
                />
                <Field
                  label="Store ID"
                  value={evoter.storeId}
                  onChange={v => setEvoter(p => ({ ...p, storeId: v }))}
                  placeholder="20180820-7DF2-40E1-8A8D-…"
                />
              </div>
            )}
          </section>

          {/* CloudKassir */}
          <section className="bg-card border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-base">CloudKassir / OFD.ru</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Облачная фискализация без физической кассы
                </p>
              </div>
              <Toggle
                checked={cloudKassir.enabled}
                onChange={v => setCloudKassir(p => ({ ...p, enabled: v }))}
              />
            </div>
            {cloudKassir.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <Field
                  label="API Key"
                  value={cloudKassir.apiKey}
                  onChange={v => setCloudKassir(p => ({ ...p, apiKey: v }))}
                  placeholder="ck_live_…"
                />
                <Field
                  label="Group Code"
                  value={cloudKassir.groupCode}
                  onChange={v => setCloudKassir(p => ({ ...p, groupCode: v }))}
                  placeholder="group_code"
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Key Name"
                    value={cloudKassir.keyName}
                    onChange={v => setCloudKassir(p => ({ ...p, keyName: v }))}
                    placeholder="Название ключа"
                  />
                </div>
                <div className="sm:col-span-2 text-xs text-muted-foreground space-y-0.5">
                  <p>URL: <code className="bg-muted px-1 rounded font-mono">https://cloudkassir.ru/api/v1/</code></p>
                  <p>или <code className="bg-muted px-1 rounded font-mono">https://api.ofd.ru/api/kkt/v2/</code></p>
                </div>
              </div>
            )}
          </section>

          {/* Global settings */}
          <section className="bg-card border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-base">Глобальные настройки</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={global.autoReceipt}
                onChange={e => setGlobal(p => ({ ...p, autoReceipt: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Автоматически пробивать чек при оплате заказа</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={global.sendEmail}
                onChange={e => setGlobal(p => ({ ...p, sendEmail: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Отправлять электронный чек клиенту на email</span>
            </label>
            <div>
              <label className="block text-sm font-medium mb-1">Система налогообложения</label>
              <select
                value={global.taxSystem}
                onChange={e => setGlobal(p => ({ ...p, taxSystem: e.target.value as TaxSystem }))}
                className="w-full sm:w-72 px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TAX_SYSTEMS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              {saved ? 'Сохранено' : saving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
