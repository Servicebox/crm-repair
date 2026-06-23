'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, TrendingUp, TrendingDown, DollarSign, Loader2, X } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const INCOME_CATEGORIES = ['Ремонт', 'Услуга', 'Продажа запчастей', 'Другое']
const EXPENSE_CATEGORIES = ['Аренда', 'Зарплата', 'Запчасти', 'Оборудование', 'Реклама', 'Коммунальные', 'Другое']

export default function FinancePage() {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState({ from: '', to: '' })
  const [showForm, setShowForm] = useState(false)
  const [txType, setTxType] = useState<'income' | 'expense'>('income')
  const [form, setForm] = useState({ category: '', amount: '', description: '', paymentMethod: 'cash', date: '' })
  const [saving, setSaving] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['finance', period],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (period.from) p.set('from', period.from)
      if (period.to) p.set('to', period.to)
      const res = await fetch(`/api/finance?${p}`)
      const json = await res.json()
      return json.data
    },
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, type: txType, amount: Number(form.amount) }),
    })
    queryClient.invalidateQueries({ queryKey: ['finance'] })
    setShowForm(false)
    setForm({ category: '', amount: '', description: '', paymentMethod: 'cash', date: '' })
    setSaving(false)
  }

  const summary = data?.summary ?? { income: 0, expense: 0, profit: 0 }
  const transactions = data?.transactions ?? []

  const pieData = [
    { name: 'Доходы', value: summary.income },
    { name: 'Расходы', value: summary.expense },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Финансы</h1>
        <div className="flex gap-2">
          <button onClick={() => { setTxType('income'); setShowForm(true) }}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" />
            Доход
          </button>
          <button onClick={() => { setTxType('expense'); setShowForm(true) }}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition">
            <Plus className="w-4 h-4" />
            Расход
          </button>
        </div>
      </div>

      {/* Period */}
      <div className="flex gap-3 mb-6 items-center">
        <label className="text-sm text-muted-foreground">Период:</label>
        <input type="date" value={period.from} onChange={e => setPeriod(p => ({ ...p, from: e.target.value }))}
          className="px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-muted-foreground">—</span>
        <input type="date" value={period.to} onChange={e => setPeriod(p => ({ ...p, to: e.target.value }))}
          className="px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        {(period.from || period.to) && (
          <button onClick={() => setPeriod({ from: '', to: '' })} className="text-sm text-muted-foreground hover:text-foreground">
            Сбросить
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">Доходы</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{formatCurrency(summary.income)}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">Расходы</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.expense)}</div>
        </div>
        <div className={`${summary.profit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Прибыль</span>
          </div>
          <div className={`text-2xl font-bold ${summary.profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {formatCurrency(summary.profit)}
          </div>
        </div>
      </div>

      {/* Pie + Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Доходы / Расходы</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-xs mt-2">
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" />Доходы</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" />Расходы</div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-card border rounded-xl overflow-hidden">
          <div className="p-4 border-b font-semibold">Операции</div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Нет операций</div>
          ) : (
            <div className="overflow-y-auto max-h-96">
              {transactions.map((tx: { _id: string; type: string; amount: number; category: string; description?: string; paymentMethod: string; date: string }) => (
                <div key={tx._id} className="flex items-center gap-3 px-4 py-3 border-b hover:bg-accent/50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {tx.type === 'income' ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{tx.category}</div>
                    {tx.description && <div className="text-xs text-muted-foreground truncate">{tx.description}</div>}
                    <div className="text-xs text-muted-foreground">{formatDateTime(tx.date)} · {tx.paymentMethod}</div>
                  </div>
                  <div className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">{txType === 'income' ? 'Добавить доход' : 'Добавить расход'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-accent rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Категория <span className="text-red-500">*</span></label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background" required>
                  <option value="">Выберите</option>
                  {(txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Сумма, ₽ <span className="text-red-500">*</span></label>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" min={0} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Способ оплаты</label>
                <select value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-background">
                  <option value="cash">Наличные</option>
                  <option value="card">Карта</option>
                  <option value="transfer">Перевод</option>
                  <option value="online">Онлайн</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Описание</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Дата</label>
                <input type="datetime-local" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition">Отмена</button>
                <button type="submit" disabled={saving}
                  className={`flex-1 py-2 ${txType === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2`}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
