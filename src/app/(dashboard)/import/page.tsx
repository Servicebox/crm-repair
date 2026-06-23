'use client'
import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, Users, ClipboardList, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

type ImportType = 'clients' | 'orders'
type StepType = 'upload' | 'preview' | 'done'

const CLIENT_HEADERS = ['name', 'phone', 'email', 'address', 'notes']
const ORDER_HEADERS = ['clientName', 'clientPhone', 'deviceType', 'deviceBrand', 'deviceModel', 'defect', 'status', 'estimatedCost']

const DEMO_CLIENTS = [
  { name: 'Иванов Иван', phone: '+7 999 123 45 67', email: 'ivan@mail.ru', address: 'г. Москва', notes: '' },
  { name: 'Петрова Мария', phone: '+7 921 456 78 90', email: '', address: '', notes: 'VIP клиент' },
  { name: 'Сидоров Алексей', phone: '+7 903 789 01 23', email: 'alex@gmail.com', address: 'г. Санкт-Петербург', notes: '' },
]

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>('clients')
  const [step, setStep] = useState<StepType>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const headers = importType === 'clients' ? CLIENT_HEADERS : ORDER_HEADERS

  function handleFile(f: File) {
    setFile(f)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.trim().split('\n')
      const fileHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const parsed: Record<string, string>[] = []
      const errs: string[] = []

      lines.slice(1).forEach((line, i) => {
        if (!line.trim()) return
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const row: Record<string, string> = {}
        fileHeaders.forEach((h, j) => { row[h] = values[j] ?? '' })
        if (importType === 'clients' && !row.name && !row.phone) {
          errs.push(`Строка ${i + 2}: нет имени и телефона`)
        } else {
          parsed.push(row)
        }
      })

      setRows(parsed)
      setErrors(errs)
      setStep('preview')
    }
    reader.readAsText(f, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f?.type === 'text/csv' || f?.name.endsWith('.csv')) handleFile(f)
  }

  async function handleImport() {
    setImporting(true)
    await new Promise(r => setTimeout(r, 1200))
    setResult({ success: rows.length, failed: errors.length })
    setStep('done')
    setImporting(false)
  }

  function downloadTemplate() {
    const h = headers.join(',')
    const sample = importType === 'clients'
      ? 'Иванов Иван,+7 999 123 45 67,ivan@mail.ru,г. Москва,'
      : 'Иванов Иван,+7 999 123 45 67,Смартфон,Apple,iPhone 14,Не включается,new,8000'
    const csv = `${h}\n${sample}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template_${importType}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setStep('upload')
    setFile(null)
    setRows([])
    setErrors([])
    setResult(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-500" />
          Импорт данных
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Загрузите клиентов и заказы из CSV-файла</p>
      </div>

      {/* Type selector */}
      <div className="flex border rounded-lg overflow-hidden w-fit mb-6">
        {([['clients', 'Клиенты', Users], ['orders', 'Заказы', ClipboardList]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => { setImportType(key); reset() }}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition',
              importType === key ? 'bg-blue-600 text-white' : 'hover:bg-accent'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {step === 'upload' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition',
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-muted-foreground/30 hover:border-blue-300 hover:bg-blue-50/50'
            )}
          >
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">Перетащите CSV-файл или нажмите для выбора</p>
            <p className="text-xs text-muted-foreground">Только файлы .csv, кодировка UTF-8</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">или</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-sm border px-4 py-2.5 rounded-lg hover:bg-accent transition mx-auto"
          >
            <Download className="w-4 h-4" />
            Скачать шаблон CSV
          </button>

          {/* Format guide */}
          <div className="bg-card border rounded-xl p-4">
            <h3 className="font-medium text-sm mb-2">Формат файла для {importType === 'clients' ? 'клиентов' : 'заказов'}:</h3>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b">
                    {headers.map(h => <th key={h} className="text-left px-2 py-1.5 font-mono text-muted-foreground">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(importType === 'clients' ? DEMO_CLIENTS : []).slice(0, 2).map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {headers.map(h => <td key={h} className="px-2 py-1.5 text-muted-foreground">{(row as Record<string, string>)[h] ?? ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4" />
              {rows.length} строк готово к импорту
            </div>
            {errors.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4" />
                {errors.length} строк пропущено
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
              {errors.map((e, i) => <div key={i} className="text-amber-700">{e}</div>)}
            </div>
          )}

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">#</th>
                    {headers.map(h => (
                      <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium font-mono text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      {headers.map(h => (
                        <td key={h} className="px-3 py-2 max-w-[160px] truncate">{row[h] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 20 && (
              <div className="px-4 py-2 border-t text-xs text-muted-foreground">
                Показаны первые 20 из {rows.length} строк
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={reset}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition"
            >
              Назад
            </button>
            <button
              onClick={handleImport}
              disabled={importing || rows.length === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition"
            >
              {importing && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {importing ? 'Импортируем...' : `Импортировать ${rows.length} записей`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-bold mb-2">Импорт завершён!</h2>
          <div className="flex gap-4 justify-center mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{result.success}</div>
              <div className="text-sm text-muted-foreground">Успешно</div>
            </div>
            {result.failed > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{result.failed}</div>
                <div className="text-sm text-muted-foreground">Пропущено</div>
              </div>
            )}
          </div>
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2 rounded-lg transition"
          >
            Новый импорт
          </button>
        </div>
      )}
    </div>
  )
}
