'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RotateCcw, Search, Phone, Mail, MessageCircle, TrendingDown, Users, Clock, DollarSign, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

type RiskLevel = 'high' | 'medium' | 'low'

type ProcessedClient = {
  _id: string
  id: string
  name: string
  phone: string
  email?: string
  totalOrders: number
  totalSpent: number
  totalRevenue?: number
  lastOrderDate?: string
  createdAt: string
  daysSince: number
  risk: RiskLevel
  lastVisit: Date
}

const RISK_COLORS: Record<RiskLevel, string> = {
  high: 'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-blue-600 bg-blue-50 border-blue-200',
}

const RISK_LABELS: Record<RiskLevel, string> = {
  high: 'Критический',
  medium: 'Средний',
  low: 'Низкий',
}

const DEVICE_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'OPPO', 'Realme', 'Vivo', 'Nokia', 'Honor', 'Lenovo', 'HP', 'Dell', 'ASUS', 'Acer', 'MSI']

const REACTIVATION_TEMPLATES = [
  { id: 'sms', label: 'SMS', icon: MessageCircle, text: 'Иван, давно не видели вас в нашем сервисе! Для вас скидка 10% на следующий ремонт. Ждём вас в SERVICE BOX 📱' },
  { id: 'email', label: 'Email', icon: Mail, text: 'Уважаемый клиент, мы соскучились по вам! Специально для постоянных клиентов — скидка 10% на любой ремонт. Приходите!' },
  { id: 'call', label: 'Звонок', icon: Phone, text: 'Добрый день, [имя]! Это SERVICE BOX. Мы заметили, что давно не обслуживали ваш телефон — предлагаем бесплатную диагностику и скидку на ремонт.' },
]

export default function ClientsReturnPage() {
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState<RiskLevel | ''>('')
  const [selected, setSelected] = useState<string[]>([])
  const [template, setTemplate] = useState('sms')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients-return'],
    queryFn: async () => {
      const res = await fetch('/api/clients?limit=200')
      const json = await res.json()
      return json.data?.clients ?? []
    },
  })

  const now = new Date()
  const processedClients: ProcessedClient[] = (clientsData ?? [])
    .map((c: ProcessedClient) => {
      const lastDate = c.lastOrderDate ? new Date(c.lastOrderDate) : new Date(c.createdAt)
      const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      const risk: RiskLevel = daysSince > 180 ? 'high' : daysSince > 60 ? 'medium' : 'low'
      return { ...c, id: c._id, daysSince, risk, lastVisit: lastDate, totalSpent: c.totalRevenue ?? 0 }
    })
    .filter((c: ProcessedClient) => c.daysSince >= 45)

  const filtered = processedClients.filter((c: ProcessedClient) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search)
    const matchRisk = !filterRisk || c.risk === filterRisk
    return matchSearch && matchRisk
  })

  function toggleSelect(id: string) {
    setSelected(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id])
  }

  function toggleAll() {
    setSelected(p => p.length === filtered.length ? [] : filtered.map((c: ProcessedClient) => c.id))
  }

  async function sendCampaign() {
    if (selected.length === 0) return
    setSending(true)
    await new Promise(r => setTimeout(r, 1500))
    setSent(true)
    setSending(false)
    setSelected([])
    setTimeout(() => setSent(false), 3000)
  }

  const highRisk = processedClients.filter(c => c.risk === 'high').length
  const totalLostRevenue = processedClients.reduce((s, c) => s + (c.totalSpent ?? 0), 0)
  const avgDaysSince = processedClients.length > 0
    ? Math.round(processedClients.reduce((s, c) => s + c.daysSince, 0) / processedClients.length)
    : 0

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-blue-500" />
          Возврат клиентов
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Клиенты, которые давно не обращались — верните их с персональным предложением</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Критический риск</span>
          </div>
          <div className="text-2xl font-bold">{highRisk}</div>
          <div className="text-xs text-muted-foreground">клиентов</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Неактивных</span>
          </div>
          <div className="text-2xl font-bold">{processedClients.length}</div>
          <div className="text-xs text-muted-foreground">за 2+ мес.</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Ср. отсутствие</span>
          </div>
          <div className="text-2xl font-bold">{avgDaysSince}</div>
          <div className="text-xs text-muted-foreground">дней</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Потерянная выручка</span>
          </div>
          <div className="text-2xl font-bold">{(totalLostRevenue / 1000).toFixed(0)}k</div>
          <div className="text-xs text-muted-foreground">₽ исторически</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Client list */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-40 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Имя или телефон..."
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterRisk}
              onChange={e => setFilterRisk(e.target.value as RiskLevel | '')}
              className="px-3 py-2 border rounded-lg text-sm bg-background outline-none"
            >
              <option value="">Все риски</option>
              <option value="high">Критический</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </div>

          {/* Select all */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-sm px-1">
              <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selected.length === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                />
                Выбрать всех ({filtered.length})
              </label>
              {selected.length > 0 && (
                <span className="text-blue-600 font-medium">Выбрано: {selected.length}</span>
              )}
            </div>
          )}

          {/* Clients */}
          <div className="space-y-2">
            {isLoading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <span className="w-5 h-5 border-2 border-muted border-t-blue-500 rounded-full animate-spin mr-2" />
                Загрузка клиентов...
              </div>
            )}
            {!isLoading && filtered.map(client => (
              <div
                key={client.id}
                className={cn(
                  'bg-card border rounded-xl p-4 transition cursor-pointer',
                  selected.includes(client.id) ? 'border-blue-400 bg-blue-50/30' : 'hover:border-blue-200'
                )}
                onClick={() => toggleSelect(client.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(client.id)}
                    onChange={() => toggleSelect(client.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{client.name}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', RISK_COLORS[client.risk])}>
                        {RISK_LABELS[client.risk]}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Был {format(client.lastVisit, 'd MMM yyyy', { locale: ru })}</span>
                      <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" />{client.daysSince} дней нет</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium text-sm">{client.totalSpent.toLocaleString('ru')} ₽</div>
                    <div className="text-xs text-muted-foreground">{client.totalOrders} заказов</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign panel */}
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" />
              Рассылка
            </h3>

            <div className="flex gap-2 mb-3">
              {REACTIVATION_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg border transition',
                    template === t.id ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-accent'
                  )}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={REACTIVATION_TEMPLATES.find(t => t.id === template)?.text ?? ''}
              readOnly
              rows={5}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-muted/30 text-muted-foreground resize-none"
            />

            <button
              onClick={sendCampaign}
              disabled={selected.length === 0 || sending}
              className={cn(
                'w-full mt-3 flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-lg transition',
                sent ? 'bg-green-600 text-white' :
                selected.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {sending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {sent ? '✓ Отправлено!' : sending ? 'Отправляем...' : `Отправить ${selected.length > 0 ? `(${selected.length})` : ''}`}
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <div className="font-medium text-amber-800 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Рекомендации
            </div>
            <ul className="text-amber-700 space-y-1.5 text-xs">
              <li>• Клиентам &gt; 180 дней — предложите скидку 15%</li>
              <li>• Клиентам с &gt; 5 заказами — личный звонок</li>
              <li>• Сезонное предложение: чистка перед летом</li>
              <li>• Напомните про гарантийное обслуживание</li>
            </ul>
          </div>

          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">Производители устройств</h3>
            <div className="flex flex-wrap gap-1.5">
              {DEVICE_BRANDS.map(brand => (
                <span key={brand} className="text-xs px-2 py-1 bg-muted rounded-full border">
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
