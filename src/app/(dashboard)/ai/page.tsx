'use client'
import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Loader2, User, Wrench, Lightbulb, RefreshCw, Upload, Search, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Message = {
  role: 'user' | 'assistant'
  content: string
  ts: Date
}

const QUICK_PROMPTS = [
  'Как почистить iPhone от пыли и заменить термопасту?',
  'Диагностика: телефон не включается — с чего начать?',
  'Почему MacBook греется и быстро разряжается?',
  'Как определить оригинальность дисплея iPhone?',
  'Замена аккумулятора Samsung Galaxy — пошагово',
  'Причины появления полос на экране ноутбука',
]

const DEMO_RESPONSES: Record<string, string> = {
  default: `Привет! Я AI-помощник для мастеров сервисного центра. Я могу помочь с:\n\n• **Диагностикой** устройств (смартфоны, ноутбуки, планшеты, телевизоры)\n• **Пошаговыми инструкциями** по ремонту\n• **Ценообразованием** — подбором стоимости услуг\n• **Общением с клиентами** — как объяснить проблему\n• **Заказом запчастей** — что искать и где\n\nЗадайте вопрос или выберите одну из быстрых подсказок ниже.`,
  iphone: `## iPhone не включается — диагностика\n\n**1. Проверьте питание:**\n• Зарядите телефон минимум 30 минут\n• Попробуйте другой кабель и адаптер\n• Нажмите и удерживайте кнопку питания 10 сек\n\n**2. Принудительная перезагрузка:**\n• iPhone 8/X/11/12/13/14/15: Кнопка громкости+ → Кнопка громкости− → Удержать Sleep/Wake до появления яблока\n• iPhone 7: Sleep/Wake + Громкость− одновременно 10 сек\n\n**3. Аппаратная диагностика:**\n• Проверьте заряд АКБ мультиметром (норма 3.7–4.2 В)\n• Осмотрите разъём зарядки на предмет окислений\n• Проверьте целостность шлейфов на материнской плате\n\n**Вероятные причины:** разряженная/вздутая батарея (60%), неисправная кнопка питания (15%), повреждение материнской платы (25%)`,
}

const DEMO_KB = [
  { id: '1', name: 'iPhone 14 Pro Boardview.pdf', category: 'boardview', size: '4.2 MB', date: '20.06.2026', tags: ['Apple', 'A16 Bionic'] },
  { id: '2', name: 'Samsung Galaxy S23 Schematic.pdf', category: 'schematic', size: '2.8 MB', date: '18.06.2026', tags: ['Samsung', 'Snapdragon 8 Gen 2'] },
  { id: '3', name: 'MacBook Pro A2338 Service Manual.pdf', category: 'manual', size: '18.4 MB', date: '15.06.2026', tags: ['Apple', 'M1', 'MacBook'] },
  { id: '4', name: 'iPhone 13 mini Schematic.pdf', category: 'schematic', size: '3.1 MB', date: '10.06.2026', tags: ['Apple', 'A15'] },
]

const CAT_LABELS: Record<string, string> = { boardview: 'Boardview', schematic: 'Схема', manual: 'Мануал', other: 'Другое' }
const CAT_COLORS: Record<string, string> = { boardview: 'bg-blue-100 text-blue-700', schematic: 'bg-purple-100 text-purple-700', manual: 'bg-green-100 text-green-700', other: 'bg-slate-100 text-slate-700' }

function KnowledgeBase() {
  const [files, setFiles] = useState(DEMO_KB)
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFiles(p => [...p, {
      id: Date.now().toString(),
      name: f.name,
      category: 'other',
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      date: new Date().toLocaleDateString('ru'),
      tags: [],
    }])
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg">База знаний AI-помощника</h2>
            <p className="text-sm text-muted-foreground">Загружайте схемы, boardview и мануалы — AI будет использовать их при ответах</p>
          </div>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            <Upload className="w-4 h-4" />
            Загрузить
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.zip" className="hidden" onChange={handleUpload} />
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по файлам и тегам..." className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-800">
          <strong>Как это работает:</strong> загруженные PDF-схемы и boardview индексируются и становятся доступны AI-помощнику. Когда мастер задаёт вопрос про конкретную модель — AI использует загруженные данные для точного ответа.
        </div>

        <div className="space-y-2">
          {filtered.map(file => (
            <div key={file.id} className="bg-card border rounded-xl p-4 flex items-center gap-3 hover:border-blue-200 transition">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{file.name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CAT_COLORS[file.category])}>{CAT_LABELS[file.category]}</span>
                  {file.tags.map(t => <span key={t} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t}</span>)}
                  <span className="text-xs text-muted-foreground ml-auto">{file.size} · {file.date}</span>
                </div>
              </div>
              <button onClick={() => setFiles(p => p.filter(f => f.id !== file.id))} className="text-muted-foreground hover:text-red-500 transition p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Файлы не найдены</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AIPage() {
  const [mainTab, setMainTab] = useState<'chat'|'kb'>('chat')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: DEMO_RESPONSES.default, ts: new Date() }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text, ts: new Date() }
    setMessages(p => [...p, userMsg])
    setInput('')
    setLoading(true)

    await new Promise(r => setTimeout(r, 1000 + Math.random() * 800))

    const key = text.toLowerCase().includes('iphone') || text.toLowerCase().includes('не включ') ? 'iphone' : 'default'
    const reply = DEMO_RESPONSES[key] ?? DEMO_RESPONSES.default

    const fullReply = `Отвечаю на ваш вопрос о: **${text.slice(0, 40)}${text.length > 40 ? '...' : ''}**\n\n${reply}`

    setMessages(p => [...p, { role: 'assistant', content: fullReply, ts: new Date() }])
    setLoading(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function renderContent(content: string) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^## (.*)/gm, '<h3 class="font-bold text-base mt-2 mb-1">$1</h3>')
      .replace(/^• (.*)/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm">AI-помощник мастера</div>
            <div className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Онлайн
            </div>
          </div>
        </div>
        <button
          onClick={() => setMessages([{ role: 'assistant', content: DEMO_RESPONSES.default, ts: new Date() }])}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border px-3 py-1.5 rounded-lg hover:bg-accent transition"
        >
          <RefreshCw className="w-3 h-3" />
          Новый чат
        </button>
      </div>

      {/* Tab switcher */}
      <div className="border-b px-4 md:px-6 py-2 shrink-0 flex gap-1">
        {([['chat', 'Чат'], ['kb', 'База знаний']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={cn('px-4 py-1.5 text-sm font-medium rounded-lg transition', mainTab === key ? 'bg-blue-100 text-blue-700' : 'hover:bg-accent text-muted-foreground')}
          >
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'kb' && <KnowledgeBase />}

      {mainTab === 'chat' && <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              msg.role === 'assistant' ? 'bg-blue-100' : 'bg-slate-200'
            )}>
              {msg.role === 'assistant'
                ? <Bot className="w-4 h-4 text-blue-600" />
                : <User className="w-4 h-4 text-slate-600" />
              }
            </div>
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
              msg.role === 'assistant'
                ? 'bg-card border rounded-tl-sm'
                : 'bg-blue-600 text-white rounded-tr-sm'
            )}>
              <div
                dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                className="leading-relaxed"
              />
              <div className={cn('text-xs mt-2', msg.role === 'assistant' ? 'text-muted-foreground' : 'text-blue-200')}>
                {msg.ts.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-blue-600" />
            </div>
            <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-4 md:px-6 pb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Lightbulb className="w-3.5 h-3.5" />
            Быстрые вопросы:
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-xs border rounded-full px-3 py-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t px-4 md:px-6 py-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Спросите про ремонт, диагностику, цены..."
            rows={1}
            className="flex-1 px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl flex items-center justify-center transition shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center">
          AI-помощник работает в демо-режиме. Для полного AI подключите API-ключ в настройках.
        </p>
      </div>
      </>}
    </div>
  )
}
