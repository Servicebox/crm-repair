'use client'
import { useState, useEffect } from 'react'
import {
  Code2, Key, Copy, Check, RefreshCw, Download, Globe,
  Webhook, FileJson, ChevronRight, Save, Loader2,
} from 'lucide-react'

const TABS = [
  { key: 'rest', label: 'REST API', icon: Code2 },
  { key: 'fiscal', label: 'Фискализация', icon: FileJson },
  { key: '1c', label: '1С', icon: Download },
  { key: 'webhook', label: 'Webhook', icon: Webhook },
]

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/orders', description: 'Список заказов с пагинацией и фильтрами' },
  { method: 'GET', path: '/api/v1/orders/:number', description: 'Заказ по номеру' },
  { method: 'POST', path: '/api/v1/clients', description: 'Создание клиента с сайта' },
  { method: 'GET', path: '/api/v1/tracking/:number', description: 'Публичное отслеживание заказа (без ключа)' },
  { method: 'GET', path: '/api/v1/export/warehouse', description: 'Экспорт склада (JSON/XML)' },
  { method: 'POST', path: '/api/v1/fiscal/receipt', description: 'Отправка фискального чека' },
]

const DEMO_KEY = 'sk_live_xK9mN2pQrT7vY4wZ'
const MASKED_KEY = `*****${DEMO_KEY.slice(-4)}`

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    POST: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    PATCH: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  }
  return (
    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${colors[method] ?? 'bg-muted text-muted-foreground'}`}>
      {method}
    </span>
  )
}


interface FiscalSettings {
  enabled: boolean
  autoReceipt: boolean
  ofdProvider: string
  inn: string
  printMethods: { cash: boolean; card: boolean; qr: boolean; transfer: boolean }
}

const DEFAULT_FISCAL: FiscalSettings = {
  enabled: false,
  autoReceipt: false,
  ofdProvider: '',
  inn: '',
  printMethods: { cash: true, card: true, qr: false, transfer: false },
}

export default function ApiSettingsPage() {
  const [tab, setTab] = useState('rest')
  const [copied, setCopied] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [lastExport, setLastExport] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<'json' | 'xml'>('json')
  const [fiscal, setFiscal] = useState<FiscalSettings>(DEFAULT_FISCAL)
  const [fiscalSaving, setFiscalSaving] = useState(false)
  const [fiscalSaved, setFiscalSaved] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookEvents, setWebhookEvents] = useState({ newOrder: true, statusChange: true, payment: false })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/fiscal')
        const json = await res.json() as { success: boolean; data: FiscalSettings | null }
        if (json.success && json.data) {
          setFiscal({ ...DEFAULT_FISCAL, ...json.data, printMethods: { ...DEFAULT_FISCAL.printMethods, ...(json.data.printMethods ?? {}) } })
        }
      } catch { /* use defaults */ }
    }
    void load()
  }, [])

  async function saveFiscal() {
    setFiscalSaving(true)
    try {
      await fetch('/api/settings/fiscal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fiscal),
      })
      setFiscalSaved(true)
      setTimeout(() => setFiscalSaved(false), 2500)
    } catch { /* ignore */ } finally {
      setFiscalSaving(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(DEMO_KEY).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const res = await fetch(`/api/v1/export/warehouse?format=${exportFormat}&api_key=${DEMO_KEY}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `warehouse-export.${exportFormat}`
      a.click()
      URL.revokeObjectURL(url)
      setLastExport(new Date().toLocaleString('ru-RU'))
    } catch {
      // silently handle — demo mode
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
          <Code2 className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">API и интеграции</h1>
          <p className="text-sm text-muted-foreground">Настройка внешних подключений и экспорта данных</p>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Tab sidebar */}
        <div className="w-44 shrink-0 space-y-0.5">
          {TABS.map((t) => (
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
        <div className="flex-1 bg-card border rounded-xl p-5 space-y-5">
          {/* REST API tab */}
          {tab === 'rest' && (
            <>
              <div>
                <h2 className="font-semibold text-base mb-3">API ключ</h2>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border font-mono text-sm">
                    <Key className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{showKey ? DEMO_KEY : MASKED_KEY}</span>
                  </div>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="px-3 py-2 border rounded-lg text-sm hover:bg-accent transition"
                  >
                    {showKey ? 'Скрыть' : 'Показать'}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-accent transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Передавайте ключ в заголовке: <code className="bg-muted px-1 rounded font-mono">Authorization: Bearer YOUR_API_KEY</code>
                </p>
              </div>

              <div>
                <h2 className="font-semibold text-base mb-3">Пример запроса (curl)</h2>
                <div className="bg-zinc-900 dark:bg-zinc-950 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-xs text-zinc-300 whitespace-pre">{`curl -X GET "https://yourcrm.ru/api/v1/orders?limit=10&page=1" \\
  -H "Authorization: Bearer ${MASKED_KEY}"`}</pre>
                </div>
              </div>

              <div>
                <h2 className="font-semibold text-base mb-3">Эндпоинты</h2>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground w-16">Метод</th>
                        <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Путь</th>
                        <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground hidden md:table-cell">Описание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ENDPOINTS.map((ep, i) => (
                        <tr key={ep.path} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                          <td className="px-3 py-2.5">
                            <MethodBadge method={ep.method} />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">{ep.path}</td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs hidden md:table-cell">{ep.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="font-semibold text-base mb-2">Базовый URL</h2>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <code className="text-sm font-mono">https://yourcrm.ru</code>
                </div>
              </div>
            </>
          )}

          {/* Fiscal tab */}
          {tab === 'fiscal' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold text-base">Фискализация</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Настройка автоматической отправки чеков в ОФД через API кассы (АТОЛ и др.)
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fiscal.enabled}
                    onChange={e => setFiscal(p => ({ ...p, enabled: e.target.checked }))}
                    className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium">Включить фискализацию</p>
                    <p className="text-xs text-muted-foreground">Автоматическая отправка чеков в ОФД</p>
                  </div>
                </label>

                {fiscal.enabled && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fiscal.autoReceipt}
                      onChange={e => setFiscal(p => ({ ...p, autoReceipt: e.target.checked }))}
                      className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-medium">Автоматически при оплате заказа</p>
                      <p className="text-xs text-muted-foreground">Отправлять чек сразу после записи оплаты</p>
                    </div>
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Провайдер ОФД</label>
                  <select
                    value={fiscal.ofdProvider}
                    onChange={e => setFiscal(p => ({ ...p, ofdProvider: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите ОФД...</option>
                    <option value="atol">АТОЛ Онлайн</option>
                    <option value="ofdru">ОФД.ру</option>
                    <option value="platformofd">Платформа ОФД</option>
                    <option value="firstofd">Первый ОФД</option>
                    <option value="kontur">Контур.ОФД</option>
                    <option value="yandex">Яндекс ОФД</option>
                  </select>
                  {fiscal.ofdProvider === 'atol' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Параметры АТОЛ (логин, пароль, URL) настраиваются в разделе{' '}
                      <a href="/settings/cashier" className="text-blue-600 underline">Кассы</a>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">ИНН организации</label>
                  <input
                    type="text"
                    value={fiscal.inn}
                    onChange={e => setFiscal(p => ({ ...p, inn: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1234567890"
                    maxLength={12}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Печатать чек при оплате:</p>
                <div className="grid grid-cols-2 gap-y-2">
                  {([
                    ['cash', 'Наличными'],
                    ['card', 'Картой'],
                    ['qr', 'QR-кодом (СБП)'],
                    ['transfer', 'Безналичным переводом'],
                  ] as [keyof FiscalSettings['printMethods'], string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fiscal.printMethods[key]}
                        onChange={e => setFiscal(p => ({
                          ...p,
                          printMethods: { ...p.printMethods, [key]: e.target.checked },
                        }))}
                        className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => void saveFiscal()}
                    disabled={fiscalSaving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    {fiscalSaving
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    {fiscalSaved ? 'Сохранено' : 'Сохранить настройки'}
                  </button>
                  {fiscalSaved && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="w-4 h-4" /> Настройки сохранены
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Чек отправляется через эндпоинт{' '}
                  <code className="bg-muted px-1 rounded font-mono">POST /api/v1/fiscal/receipt</code>
                </p>
              </div>
            </div>
          )}

          {/* 1C tab */}
          {tab === '1c' && (
            <>
              <h2 className="font-semibold text-base">Интеграция с 1С</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Формат экспорта</label>
                  <div className="flex gap-2">
                    {(['json', 'xml'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setExportFormat(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                          exportFormat === f ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-accent'
                        }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-sm">Склад и товары</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Все позиции склада с количеством и ценами</p>
                    <button
                      onClick={handleExport}
                      disabled={exportLoading}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
                    >
                      {exportLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Выгрузить склад
                    </button>
                  </div>
                  <div className="border rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-sm">Транзакции</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Финансовые операции за период</p>
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 bg-muted text-muted-foreground text-sm font-medium px-3 py-2 rounded-lg cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      Выгрузить транзакции
                    </button>
                  </div>
                </div>
                {lastExport && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    Последний экспорт: {lastExport}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Webhook tab */}
          {tab === 'webhook' && (
            <>
              <h2 className="font-semibold text-base">Webhook</h2>
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                <ChevronRight className="w-4 h-4 shrink-0" />
                <span>Раздел в разработке — будет доступен в следующей версии.</span>
              </div>
              <div className="space-y-4 opacity-50 pointer-events-none">
                <div>
                  <label className="block text-sm font-medium mb-1">URL для уведомлений</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="https://yourdomain.ru/webhook"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">События для отправки:</p>
                  <div className="space-y-2">
                    {(
                      [
                        ['newOrder', 'Новый заказ'],
                        ['statusChange', 'Смена статуса'],
                        ['payment', 'Оплата'],
                      ] as [keyof typeof webhookEvents, string][]
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={webhookEvents[key]}
                          onChange={(e) => setWebhookEvents((p) => ({ ...p, [key]: e.target.checked }))}
                          className="rounded"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  disabled
                  className="flex items-center gap-2 bg-muted text-muted-foreground text-sm font-medium px-4 py-2 rounded-lg cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                  Отправить тестовый запрос
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
