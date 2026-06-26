'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Save, Loader2, CheckCircle, RotateCcw,
  Receipt, ClipboardList, Wrench, Eye, EyeOff,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BaseTemplate {
  showLogo: boolean
  showRequisites: boolean
  headerNote: string
  footerText: string
  legalText: string
  showQr: boolean
  showTearOff: boolean
}

interface WorksActTemplate extends BaseTemplate {
  showParts: boolean
  warrantyText: string
  signatureNote: string
}

interface DocumentTemplates {
  receipt: BaseTemplate
  acceptance: BaseTemplate
  worksAct: WorksActTemplate
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_BASE: BaseTemplate = {
  showLogo: true,
  showRequisites: true,
  headerNote: '',
  footerText: 'Спасибо за доверие! Сохраняйте квитанцию до получения устройства.',
  legalText: '',
  showQr: true,
  showTearOff: true,
}

const DEFAULT_ACCEPTANCE: BaseTemplate = {
  showLogo: true,
  showRequisites: true,
  headerNote: '',
  footerText: '',
  legalText: 'Заказчик подтверждает корректность указанных данных и принимает условия обслуживания.',
  showQr: true,
  showTearOff: true,
}

const DEFAULT_WORKS_ACT: WorksActTemplate = {
  showLogo: true,
  showRequisites: true,
  headerNote: '',
  footerText: '',
  legalText: '',
  showQr: true,
  showTearOff: false,
  showParts: true,
  warrantyText: 'Гарантия распространяется только на выполненные работы и не распространяется на механические повреждения, возникшие после выдачи.',
  signatureNote: '',
}

function mergeBase(saved: Partial<BaseTemplate> | undefined | null, def: BaseTemplate): BaseTemplate {
  return { ...def, ...(saved ?? {}) }
}

function mergeWorksAct(saved: Partial<WorksActTemplate> | undefined | null): WorksActTemplate {
  return { ...DEFAULT_WORKS_ACT, ...(saved ?? {}) }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ label, description, value, onChange }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-b-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

function TextBlock({ label, description, value, onChange, rows = 2 }: {
  label: string; description?: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div className="py-3 border-b last:border-b-0">
      <label className="block text-sm font-medium mb-1">{label}</label>
      {description && <p className="text-xs text-muted-foreground mb-1.5">{description}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        placeholder="Оставьте пустым, чтобы не показывать"
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl p-5 mb-4">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

// ─── Tab editors ──────────────────────────────────────────────────────────────

function ReceiptEditor({ value, onChange }: { value: BaseTemplate; onChange: (v: BaseTemplate) => void }) {
  function set<K extends keyof BaseTemplate>(key: K, v: BaseTemplate[K]) {
    onChange({ ...value, [key]: v })
  }
  return (
    <>
      <Section title="Шапка документа">
        <Toggle label="Показывать логотип" description="Логотип сервиса в верхней части" value={value.showLogo} onChange={v => set('showLogo', v)} />
        <Toggle label="Показывать реквизиты" description="ИНН, ОГРН, адрес организации" value={value.showRequisites} onChange={v => set('showRequisites', v)} />
        <TextBlock label="Текст под реквизитами" description="Выводится сразу после шапки, перед данными заказа" value={value.headerNote} onChange={v => set('headerNote', v)} />
      </Section>
      <Section title="Нижняя часть">
        <Toggle label="QR-код для отслеживания" value={value.showQr} onChange={v => set('showQr', v)} />
        <Toggle label="Отрывной талон" description="Вторая часть с данными заказа, которую клиент оставляет себе" value={value.showTearOff} onChange={v => set('showTearOff', v)} />
        <TextBlock label="Текст в подвале" description="Пожелания, благодарность, правила сервиса" value={value.footerText} onChange={v => set('footerText', v)} />
      </Section>
      <Section title="Юридический текст">
        <TextBlock label="Оговорка / условия" description="Мелкий шрифт под подписями (условия договора, ответственность)" value={value.legalText} onChange={v => set('legalText', v)} rows={4} />
      </Section>
    </>
  )
}

function AcceptanceEditor({ value, onChange }: { value: BaseTemplate; onChange: (v: BaseTemplate) => void }) {
  function set<K extends keyof BaseTemplate>(key: K, v: BaseTemplate[K]) {
    onChange({ ...value, [key]: v })
  }
  return (
    <>
      <Section title="Шапка документа">
        <Toggle label="Показывать логотип" value={value.showLogo} onChange={v => set('showLogo', v)} />
        <Toggle label="Показывать реквизиты" description="ИНН, ОГРН, адрес организации" value={value.showRequisites} onChange={v => set('showRequisites', v)} />
        <TextBlock label="Текст под реквизитами" description="Выводится сразу после шапки, перед данными заказа" value={value.headerNote} onChange={v => set('headerNote', v)} />
      </Section>
      <Section title="Нижняя часть">
        <Toggle label="QR-код для отслеживания" value={value.showQr} onChange={v => set('showQr', v)} />
        <Toggle label="Отрывной талон клиенту" description="Копия данных для клиента — отрезается по пунктиру" value={value.showTearOff} onChange={v => set('showTearOff', v)} />
        <TextBlock label="Текст подвала" value={value.footerText} onChange={v => set('footerText', v)} />
      </Section>
      <Section title="Юридический текст">
        <TextBlock label="Подпись к подписям / условия" description="Выводится под строками подписей" value={value.legalText} onChange={v => set('legalText', v)} rows={4} />
      </Section>
    </>
  )
}

function WorksActEditor({ value, onChange }: { value: WorksActTemplate; onChange: (v: WorksActTemplate) => void }) {
  function set<K extends keyof WorksActTemplate>(key: K, v: WorksActTemplate[K]) {
    onChange({ ...value, [key]: v })
  }
  return (
    <>
      <Section title="Шапка документа">
        <Toggle label="Показывать логотип" value={value.showLogo} onChange={v => set('showLogo', v)} />
        <Toggle label="Показывать реквизиты" description="ИНН, ОГРН, адрес организации" value={value.showRequisites} onChange={v => set('showRequisites', v)} />
        <TextBlock label="Текст под реквизитами" value={value.headerNote} onChange={v => set('headerNote', v)} />
      </Section>
      <Section title="Содержание">
        <Toggle label="Раздел «Использованные материалы»" description="Таблица запчастей в акте о работах" value={value.showParts} onChange={v => set('showParts', v)} />
        <Toggle label="QR-код для отслеживания" value={value.showQr} onChange={v => set('showQr', v)} />
      </Section>
      <Section title="Гарантия">
        <TextBlock
          label="Текст условий гарантии"
          description="Выводится в разделе «Гарантия» после таблицы оплат"
          value={value.warrantyText}
          onChange={v => set('warrantyText', v)}
          rows={3}
        />
      </Section>
      <Section title="Подписи и подвал">
        <TextBlock label="Примечание к подписям" description="Выводится между строками подписей и QR-кодом" value={value.signatureNote} onChange={v => set('signatureNote', v)} />
        <TextBlock label="Текст подвала" value={value.footerText} onChange={v => set('footerText', v)} />
        <TextBlock label="Юридический текст / оговорка" value={value.legalText} onChange={v => set('legalText', v)} rows={4} />
      </Section>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type DocTab = 'receipt' | 'acceptance' | 'worksAct'

const TABS: { key: DocTab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    key: 'receipt',
    label: 'Квитанция',
    icon: <Receipt className="w-4 h-4" />,
    description: 'Выдаётся клиенту при сдаче устройства в ремонт. Содержит данные заказа и отрывной талон.',
  },
  {
    key: 'acceptance',
    label: 'Акт приёмки',
    icon: <ClipboardList className="w-4 h-4" />,
    description: 'Акт осмотра устройства при приёмке. Содержит чеклист состояния и подписи сторон.',
  },
  {
    key: 'worksAct',
    label: 'Акт о работах',
    icon: <Wrench className="w-4 h-4" />,
    description: 'Акт выполненных работ. Содержит таблицы работ, запчастей, оплат и гарантийные условия.',
  },
]

export default function DocumentTemplatesPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<DocTab>('receipt')
  const [saved, setSaved] = useState(false)

  const [receipt, setReceipt] = useState<BaseTemplate>(DEFAULT_BASE)
  const [acceptance, setAcceptance] = useState<BaseTemplate>(DEFAULT_ACCEPTANCE)
  const [worksAct, setWorksAct] = useState<WorksActTemplate>(DEFAULT_WORKS_ACT)

  const { data: serverData, isLoading } = useQuery<Partial<DocumentTemplates> | null>({
    queryKey: ['settings-documents'],
    queryFn: async () => {
      const res = await fetch('/api/settings/documents')
      const json = await res.json()
      return json.data ?? null
    },
    staleTime: 60_000,
  })

  // Hydrate form when data loads
  useEffect(() => {
    if (!serverData) return
    if (serverData.receipt) setReceipt(mergeBase(serverData.receipt, DEFAULT_BASE))
    if (serverData.acceptance) setAcceptance(mergeBase(serverData.acceptance, DEFAULT_ACCEPTANCE))
    if (serverData.worksAct) setWorksAct(mergeWorksAct(serverData.worksAct))
  }, [serverData])

  const mutation = useMutation({
    mutationFn: async (data: DocumentTemplates) => {
      const res = await fetch('/api/settings/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-documents'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function handleSave() {
    mutation.mutate({ receipt, acceptance, worksAct })
  }

  function handleReset() {
    if (activeTab === 'receipt') setReceipt(DEFAULT_BASE)
    if (activeTab === 'acceptance') setAcceptance(DEFAULT_ACCEPTANCE)
    if (activeTab === 'worksAct') setWorksAct(DEFAULT_WORKS_ACT)
  }

  const activeTabMeta = TABS.find(t => t.key === activeTab)!

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Шаблоны документов
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Настройте содержимое печатных документов — квитанций и актов
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-lg px-3 py-2 transition hover:bg-accent"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сбросить
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            {mutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : saved
                ? <CheckCircle className="w-4 h-4" />
                : <Save className="w-4 h-4" />}
            {saved ? 'Сохранено' : 'Сохранить'}
          </button>
        </div>
      </div>

      {mutation.isError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {(mutation.error as Error).message}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab description + preview hint */}
      <div className="flex items-start justify-between mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <div>
          <div className="flex items-center gap-2 font-medium text-sm text-blue-800 mb-0.5">
            {activeTabMeta.icon}
            {activeTabMeta.label}
          </div>
          <p className="text-xs text-blue-700">{activeTabMeta.description}</p>
        </div>
        <a
          href={`/orders`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0 ml-4 mt-1"
        >
          <Eye className="w-3.5 h-3.5" />
          Открыть заказ для теста
        </a>
      </div>

      {/* Editor */}
      {activeTab === 'receipt' && (
        <ReceiptEditor value={receipt} onChange={setReceipt} />
      )}
      {activeTab === 'acceptance' && (
        <AcceptanceEditor value={acceptance} onChange={setAcceptance} />
      )}
      {activeTab === 'worksAct' && (
        <WorksActEditor value={worksAct} onChange={setWorksAct} />
      )}

      {/* Bottom save */}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить шаблоны
        </button>
      </div>
    </div>
  )
}
