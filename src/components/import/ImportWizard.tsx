'use client'

import { useState, useCallback } from 'react'
import { DropZone } from './DropZone'
import { SmartMappingTable } from './SmartMappingTable'
import { ImportProgress } from './ImportProgress'
import { TARGET_ENTITIES } from '@/services/import/fieldDefinitions'
import type { IColumnAnalysis, IFieldMapping } from '@/models/ImportJob'

type Step = 'upload' | 'options' | 'mapping' | 'confirm' | 'progress' | 'done'

interface AnalysisResult {
  total_rows: number
  encoding: string
  sheets: string[]
  detected_columns: IColumnAnalysis[]
  sample: Record<string, string>[]
  entity: string
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>('upload')
  const [jobId, setJobId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [entity, setEntity] = useState<string>('clients')
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [dupStrategy, setDupStrategy] = useState<string>('skip')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [mapping, setMapping] = useState<IFieldMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Step 1: Upload ────────────────────────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    setError(null)
    setFile(f)
    setLoading(true)

    try {
      const form = new FormData()
      form.append('file', f)

      const res = await fetch('/api/import/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      setJobId(json.data.id)
      setStep('options')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Step 2 → 3: Analyse ───────────────────────────────────────────────
  const handleAnalyse = async () => {
    if (!jobId) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/import/${jobId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, sheet: selectedSheet || undefined }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      setAnalysis(json.data)
      setStep('mapping')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка анализа')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3 → 4: Save mapping ──────────────────────────────────────────
  const handleMappingConfirm = async () => {
    if (!jobId || mapping.length === 0) {
      setError('Необходимо сопоставить хотя бы одно поле')
      return
    }
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/import/${jobId}/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping, duplicate_strategy: dupStrategy, target_entity: entity }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setStep('confirm')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения маппинга')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 4 → 5: Start import ──────────────────────────────────────────
  const handleStart = async () => {
    if (!jobId) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/import/${jobId}/start`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setStep('progress')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка запуска импорта')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!jobId) return
    await fetch(`/api/import/${jobId}`, { method: 'DELETE' })
    reset()
  }

  const reset = () => {
    setStep('upload')
    setJobId(null)
    setFile(null)
    setAnalysis(null)
    setMapping([])
    setError(null)
    setLoading(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      {/* Step indicator */}
      <StepBar current={step} />

      <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* ── Step 1: Drop zone ─────────────────────────────────── */}
        {step === 'upload' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Загрузка файла
            </h2>
            {loading
              ? <p className="text-center py-12 text-gray-400">Загрузка файла…</p>
              : <DropZone onFile={handleFile} />
            }
          </div>
        )}

        {/* ── Step 2: Options ───────────────────────────────────── */}
        {step === 'options' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Параметры импорта
            </h2>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Файл: <span className="font-medium text-gray-700 dark:text-gray-200">{file?.name}</span>
            </p>

            {/* Entity */}
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Что импортируем?
              </span>
              <select
                value={entity}
                onChange={e => setEntity(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {TARGET_ENTITIES.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </label>

            {/* Duplicate strategy */}
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Дубликаты
              </span>
              <select
                value={dupStrategy}
                onChange={e => setDupStrategy(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="skip">Пропустить дубликаты</option>
                <option value="update">Обновить существующие</option>
                <option value="create">Создать новые (даже если дубль)</option>
                <option value="merge">Объединить данные</option>
              </select>
            </label>

            <div className="flex gap-3 pt-2">
              <button onClick={handleCancel} className="btn-outline">Отменить</button>
              <button onClick={handleAnalyse} disabled={loading} className="btn-primary">
                {loading ? 'Анализирую…' : 'Анализировать файл →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Mapping ───────────────────────────────────── */}
        {step === 'mapping' && analysis && (
          <div className="space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Сопоставление полей
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {analysis.total_rows.toLocaleString('ru-RU')} строк · кодировка {analysis.encoding}
                </p>
              </div>
            </div>

            {/* Excel sheet selector */}
            {analysis.sheets.length > 1 && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Лист Excel</label>
                <select
                  value={selectedSheet}
                  onChange={e => setSelectedSheet(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {analysis.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Data preview */}
            <details className="group">
              <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline select-none">
                Предпросмотр данных (первые строки)
              </summary>
              <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800">
                      {analysis.detected_columns.map(c => (
                        <th key={c.source_name} className="px-3 py-2 text-left text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {c.source_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {analysis.sample.slice(0, 5).map((row, ri) => (
                      <tr key={ri}>
                        {analysis.detected_columns.map(c => (
                          <td key={c.source_name} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                            {row[c.source_name] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <SmartMappingTable
              columns={analysis.detected_columns}
              entity={entity}
              onChange={setMapping}
            />

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('options')} className="btn-outline">← Назад</button>
              <button onClick={handleMappingConfirm} disabled={loading || mapping.length === 0} className="btn-primary">
                {loading ? 'Сохраняю…' : 'Подтвердить маппинг →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Confirm ───────────────────────────────────── */}
        {step === 'confirm' && analysis && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Подтверждение импорта
            </h2>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <Row label="Файл" value={file?.name ?? ''} />
              <Row label="Сущность" value={TARGET_ENTITIES.find(e => e.value === entity)?.label ?? entity} />
              <Row label="Строк к импорту" value={analysis.total_rows.toLocaleString('ru-RU')} />
              <Row label="Полей сопоставлено" value={String(mapping.length)} />
              <Row label="Дубликаты" value={{ skip: 'Пропустить', update: 'Обновить', create: 'Создавать новые', merge: 'Объединять' }[dupStrategy] ?? dupStrategy} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('mapping')} className="btn-outline">← Назад</button>
              <button onClick={handleStart} disabled={loading} className="btn-primary bg-green-600 hover:bg-green-700">
                {loading ? 'Запускаю…' : '▶ Запустить импорт'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Progress ──────────────────────────────────── */}
        {step === 'progress' && jobId && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Импорт выполняется</h2>
            <ImportProgress
              jobId={jobId}
              onComplete={() => setStep('done')}
            />
            <button onClick={handleCancel} className="btn-outline text-sm">Отменить импорт</button>
          </div>
        )}

        {/* ── Step 6: Done ──────────────────────────────────────── */}
        {step === 'done' && jobId && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Импорт завершён</h2>
            <ImportProgress jobId={jobId} />
            <div className="flex gap-3">
              <button onClick={reset} className="btn-primary">
                Новый импорт
              </button>
              <a href="/api/import/jobs" className="btn-outline text-sm">
                История импортов
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'upload',  label: 'Файл' },
  { id: 'options', label: 'Параметры' },
  { id: 'mapping', label: 'Маппинг' },
  { id: 'confirm', label: 'Подтверждение' },
  { id: 'progress', label: 'Импорт' },
  { id: 'done',    label: 'Готово' },
]

const STEP_ORDER = STEPS.map(s => s.id)

function StepBar({ current }: { current: Step }) {
  const ci = STEP_ORDER.indexOf(current)
  return (
    <nav aria-label="Шаги импорта">
      <ol className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = i < ci
          const active = i === ci
          return (
            <li key={s.id} className="flex items-center">
              <div className={[
                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors',
                done   ? 'bg-green-500 text-white' :
                active ? 'bg-blue-600 text-white ring-2 ring-blue-300 dark:ring-blue-800' :
                         'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
              ].join(' ')}>
                {done ? '✓' : i + 1}
              </div>
              <span className={[
                'hidden sm:inline ml-2 text-xs font-medium',
                active ? 'text-blue-600 dark:text-blue-400' :
                done   ? 'text-green-600 dark:text-green-400' :
                         'text-gray-400',
              ].join(' ')}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={[
                  'w-8 h-0.5 mx-2',
                  i < ci ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700',
                ].join(' ')} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
