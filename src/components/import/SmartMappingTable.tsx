'use client'

import { useState } from 'react'
import { TARGET_FIELDS, getFieldsForEntity } from '@/services/import/fieldDefinitions'
import { TRANSFORMER_OPTIONS } from '@/services/import/transformers'
import type { IColumnAnalysis, IFieldMapping } from '@/models/ImportJob'

interface SmartMappingTableProps {
  columns: IColumnAnalysis[]
  entity: string
  onChange: (mapping: IFieldMapping[]) => void
}

const SKIP_VALUE = '__skip__'

function confidenceBadge(conf: number) {
  if (conf >= 0.8) return <span className="ml-1 text-xs text-green-600 dark:text-green-400 font-medium">✓ {Math.round(conf * 100)}%</span>
  if (conf >= 0.5) return <span className="ml-1 text-xs text-yellow-600 dark:text-yellow-400 font-medium">~ {Math.round(conf * 100)}%</span>
  return null
}

export function SmartMappingTable({ columns, entity, onChange }: SmartMappingTableProps) {
  const entityFields = getFieldsForEntity(entity)

  const [rows, setRows] = useState<IFieldMapping[]>(() =>
    columns.map(col => ({
      source_column: col.source_name,
      target_field: col.suggested_target || SKIP_VALUE,
      transformer: 'none',
      is_required: false,
    }))
  )

  const update = (index: number, patch: Partial<IFieldMapping>) => {
    const next = rows.map((r, i) => i === index ? { ...r, ...patch } : r)
    setRows(next)
    onChange(next.filter(r => r.target_field && r.target_field !== SKIP_VALUE))
  }

  const autoFill = () => {
    const next = rows.map((r, i) => {
      const col = columns[i]
      return col.suggested_target
        ? { ...r, target_field: col.suggested_target }
        : r
    })
    setRows(next)
    onChange(next.filter(r => r.target_field && r.target_field !== SKIP_VALUE))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Сопоставление полей
        </h3>
        <button
          type="button"
          onClick={autoFill}
          className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          ✨ Автозаполнить
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 text-left w-[200px]">Колонка источника</th>
              <th className="px-4 py-3 text-left w-[220px]">Примеры значений</th>
              <th className="px-4 py-3 text-left w-[220px]">Поле CRM</th>
              <th className="px-4 py-3 text-left w-[180px]">Трансформер</th>
              <th className="px-4 py-3 text-center w-[100px]">Обязательное</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {columns.map((col, i) => {
              const row = rows[i]
              const isMapped = row.target_field && row.target_field !== SKIP_VALUE
              const isAI = isMapped && col.confidence >= 0.5 && row.target_field === col.suggested_target

              return (
                <tr
                  key={col.source_name}
                  className={[
                    'transition-colors',
                    isAI ? 'bg-green-50/50 dark:bg-green-900/10' : '',
                    !isMapped ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  {/* Source column name */}
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    {col.source_name}
                    {isAI && confidenceBadge(col.confidence)}
                  </td>

                  {/* Sample values */}
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {col.sample_values.slice(0, 3).map((v, vi) => (
                      <span key={vi} className="mr-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 inline-block mb-1">
                        {v.length > 20 ? v.slice(0, 20) + '…' : v}
                      </span>
                    ))}
                  </td>

                  {/* Target field dropdown */}
                  <td className="px-4 py-3">
                    <select
                      value={row.target_field}
                      onChange={e => update(i, { target_field: e.target.value })}
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value={SKIP_VALUE}>— Пропустить —</option>
                      {entityFields.map(f => (
                        <option key={f.path} value={f.path}>{f.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Transformer */}
                  <td className="px-4 py-3">
                    <select
                      value={row.transformer}
                      onChange={e => update(i, { transformer: e.target.value })}
                      disabled={!isMapped}
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-40"
                    >
                      {TRANSFORMER_OPTIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Required toggle */}
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={row.is_required}
                      onChange={e => update(i, { is_required: e.target.checked })}
                      disabled={!isMapped}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
