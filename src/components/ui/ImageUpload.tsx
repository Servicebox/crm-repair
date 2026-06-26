'use client'
import { useRef, useState } from 'react'
import { Upload, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  type: 'avatar' | 'logo'
  currentUrl?: string
  onUploaded: (url: string) => void
  onRemove?: () => void
  className?: string
  children?: React.ReactNode
}

export function ImageUpload({ type, currentUrl, onUploaded, onRemove, className, children }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`/api/upload?type=${type}`, { method: 'POST', body: formData })
    const json = await res.json()

    setUploading(false)
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Ошибка загрузки')
      return
    }
    onUploaded(json.data.url)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleChange}
      />

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className={cn('cursor-pointer', uploading && 'pointer-events-none')}
      >
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full z-10">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        ) : null}
        {children}
      </div>

      {currentUrl && onRemove && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center z-20 hover:bg-red-600 transition"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {error && (
        <p className="absolute top-full left-0 mt-1 text-xs text-red-600 whitespace-nowrap bg-white border border-red-200 rounded px-2 py-0.5 shadow-sm z-20">
          {error}
        </p>
      )}
    </div>
  )
}

interface LogoUploadProps {
  currentUrl?: string
  onUploaded: (url: string) => void
  onRemove?: () => void
}

export function LogoUpload({ currentUrl, onUploaded, onRemove }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload?type=logo', { method: 'POST', body: formData })
    const json = await res.json()
    setUploading(false)
    if (!res.ok || !json.success) { setError(json.error ?? 'Ошибка загрузки'); return }
    onUploaded(json.data.url)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-3">
      {currentUrl && (
        <div className="flex items-center gap-3 p-3 border rounded-xl bg-muted/30">
          <img src={currentUrl} alt="Логотип" className="h-14 w-auto object-contain rounded" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-700">Логотип загружен</p>
            <p className="text-xs text-muted-foreground truncate">{currentUrl}</p>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-red-500 hover:text-red-700 text-xs border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 transition"
            >
              Удалить
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition',
          drag ? 'border-blue-400 bg-blue-50' : 'border-border hover:border-blue-300 hover:bg-blue-50/50',
          uploading && 'pointer-events-none opacity-60'
        )}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка...
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">{currentUrl ? 'Заменить логотип' : 'Загрузить логотип'}</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG, WebP · до 5 МБ</p>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{error}</p>
      )}
    </div>
  )
}
