'use client'
import { useState } from 'react'
import {
  HelpCircle, ChevronDown, ChevronRight, Mail, Send,
  BookOpen, ShoppingCart, CreditCard, Code2, Play,
  Server, Database, CheckCircle2, ExternalLink,
} from 'lucide-react'

const FAQ_ITEMS = [
  {
    q: 'Как добавить нового сотрудника?',
    a: 'Перейдите в раздел «Управление → Сотрудники» и нажмите «Добавить». Укажите имя, роль и email — сотрудник получит приглашение на почту.',
  },
  {
    q: 'Как настроить шаблоны SMS и уведомлений?',
    a: 'В разделе «Настройки → Уведомления» можно задать тексты для каждого события: смена статуса, готовность заказа, выдача. Используйте переменные {{number}}, {{clientName}} и {{status}}.',
  },
  {
    q: 'Как подключить онлайн-кассу?',
    a: 'Перейдите в «Настройки → API и интеграции → Фискализация». Выберите провайдера ОФД, укажите ИНН и настройте правила печати чеков.',
  },
  {
    q: 'Можно ли работать с несколькими точками?',
    a: 'Да. В разделе «Управление → Локации» добавьте точки обслуживания. При создании заказа выберите локацию — статистика и доступ будут разделены.',
  },
  {
    q: 'Как экспортировать данные в 1С?',
    a: 'Перейдите в «Настройки → API и интеграции → 1С». Нажмите «Выгрузить склад» или «Выгрузить транзакции» — получите файл в формате JSON или XML.',
  },
  {
    q: 'Как ограничить доступ мастеров к данным?',
    a: 'В разделе «Управление → Права доступа» настройте роли. Мастера видят только свои заказы; менеджеры — все заказы своей точки.',
  },
]

const DOC_LINKS = [
  { label: 'Начало работы', icon: BookOpen, description: 'Первые шаги: настройка компании, добавление сотрудников' },
  { label: 'Управление заказами', icon: ShoppingCart, description: 'Статусы, чек-лист, приёмка и выдача устройств' },
  { label: 'Настройка кассы', icon: CreditCard, description: 'Оплата, фискальные чеки, интеграция с ОФД' },
  { label: 'API интеграция', icon: Code2, description: 'REST API, авторизация, примеры запросов' },
]

const VIDEO_TUTORIALS = [
  { title: 'Быстрый старт за 5 минут', duration: '5:12' },
  { title: 'Создание и обработка заказов', duration: '8:34' },
  { title: 'Настройка прав доступа', duration: '4:51' },
  { title: 'Отчёты и аналитика', duration: '6:20' },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3.5 text-left gap-3 hover:text-blue-600 transition-colors"
      >
        <span className="text-sm font-medium">{q}</span>
        {open ? <ChevronDown className="w-4 h-4 shrink-0 text-blue-500" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <p className="pb-3.5 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export default function SupportPage() {
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function handleSend() {
    if (!message.trim()) return
    setSent(true)
    setTopic('')
    setMessage('')
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Поддержка</h1>
          <p className="text-sm text-muted-foreground">Ответы на вопросы, документация и контакты</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* FAQ */}
          <section className="bg-card border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-base">Часто задаваемые вопросы</h2>
            <div>
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </section>

          {/* Write to support form */}
          <section className="bg-card border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-base">Написать в поддержку</h2>
            {sent ? (
              <div className="flex items-center gap-2 text-green-600 py-4">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Сообщение отправлено! Ответим в течение 24 часов.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Тема обращения</label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите тему...</option>
                    <option value="tech">Технический вопрос</option>
                    <option value="billing">Оплата и тарифы</option>
                    <option value="integration">Интеграции и API</option>
                    <option value="bug">Сообщить об ошибке</option>
                    <option value="feature">Предложить улучшение</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Сообщение</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Опишите вашу проблему или вопрос подробно..."
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  <Send className="w-4 h-4" />
                  Отправить
                </button>
              </div>
            )}
          </section>

          {/* Video tutorials */}
          <section className="bg-card border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-base">Видеоуроки</h2>
            <div className="grid grid-cols-2 gap-3">
              {VIDEO_TUTORIALS.map((v) => (
                <div
                  key={v.title}
                  className="border rounded-lg overflow-hidden hover:border-blue-400 transition-colors cursor-pointer group"
                >
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 h-24 flex items-center justify-center">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Play className="w-4 h-4 text-white ml-0.5" />
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium leading-snug">{v.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Contacts */}
          <section className="bg-card border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-base">Контакты</h2>
            <div className="space-y-3">
              <a
                href="mailto:support@servicebox.ru"
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
              >
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email поддержки</p>
                  <p className="text-sm font-medium group-hover:text-blue-600 transition-colors">support@servicebox.ru</p>
                </div>
              </a>
              <a
                href="https://t.me/servicebox_support"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
              >
                <div className="w-8 h-8 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telegram</p>
                  <p className="text-sm font-medium group-hover:text-sky-500 transition-colors">@servicebox_support</p>
                </div>
              </a>
            </div>
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Время ответа: пн–пт 9:00–21:00 МСК. Среднее время ответа — 2 часа.
              </p>
            </div>
          </section>

          {/* Documentation */}
          <section className="bg-card border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-base">Документация</h2>
            <div className="space-y-2">
              {DOC_LINKS.map((doc) => (
                <button
                  key={doc.label}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group text-left"
                >
                  <div className="w-7 h-7 bg-muted rounded-md flex items-center justify-center shrink-0">
                    <doc.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{doc.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </section>

          {/* System info */}
          <section className="bg-card border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-base">Информация о системе</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-1.5 border-b">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> Версия CRM
                </span>
                <span className="font-mono font-medium">2.4.1</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" /> Next.js
                </span>
                <span className="font-mono font-medium">14.x</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" /> Node.js
                </span>
                <span className="font-mono font-medium">20 LTS</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> MongoDB
                </span>
                <span className="flex items-center gap-1.5 text-green-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Connected
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
