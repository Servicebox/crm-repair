'use client'

import { useCallback, useState } from 'react'

interface DropZoneProps {
  onFile: (file: File) => void
  accept?: string
  maxSizeMb?: number
}

const ACCEPT_MAP: Record<string, string> = {
  '.csv': 'CSV',
  '.xlsx': 'Excel',
  '.xls': 'Excel (старый)',
  '.xml': 'XML',
}

export function DropZone({ onFile, accept = '.csv,.xlsx,.xls,.xml', maxSizeMb = 100 }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPT_MAP[ext]) return `Неподдерживаемый формат. Допустимы: ${Object.values(ACCEPT_MAP).join(', ')}`
    if (file.size > maxSizeMb * 1024 * 1024) return `Файл превышает ${maxSizeMb} МБ`
    return null
  }

  const handle = useCallback((file: File) => {
    const err = validate(file)
    if (err) { setError(err); return }
    setError(null)
    onFile(file)
  }, [onFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handle(file)
  }, [handle])

  const onInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handle(file)
    e.target.value = ''  // allow re-selecting same file
  }, [handle])

  return (
    <div className="w-full">
      <label
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={[
          'flex flex-col items-center justify-center w-full min-h-[200px] rounded-xl border-2 border-dashed cursor-pointer transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
        ].join(' ')}
      >
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={onInput}
        />
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="text-5xl">📂</div>
          <p className="text-base font-medium text-gray-700 dark:text-gray-200">
            Перетащите файл сюда или нажмите для выбора
          </p>
          <p className="text-sm text-gray-400">
            {Object.values(ACCEPT_MAP).join(', ')} · до {maxSizeMb} МБ
          </p>
        </div>
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
