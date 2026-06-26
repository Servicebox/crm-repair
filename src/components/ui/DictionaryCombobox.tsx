'use client'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type DictionaryType = 'deviceType' | 'condition' | 'accessories' | 'defect' | 'brand' | 'model'

interface DictionaryItem {
  _id: string
  value: string
}

interface Props {
  type: DictionaryType
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  required?: boolean
  fallback?: string[]
}

export function DictionaryCombobox({ type, value, onChange, placeholder, className, required, fallback = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  const { data: items = [] } = useQuery<DictionaryItem[]>({
    queryKey: ['dictionary', type],
    queryFn: async () => {
      const res = await fetch(`/api/dictionary?type=${type}`)
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 60_000,
  })

  const allOptions = items.length > 0
    ? items.map(i => i.value)
    : fallback

  const filtered = inputVal.trim()
    ? allOptions.filter(o => o.toLowerCase().includes(inputVal.toLowerCase()))
    : allOptions

  useEffect(() => { setInputVal(value) }, [value])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  function select(option: string) {
    onChange(option)
    setInputVal(option)
    setOpen(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setInputVal(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  function clear() {
    setInputVal('')
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={inputVal}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2 pr-8 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-background"
        />
        {inputVal ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(option => (
            <button
              key={option}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(option) }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-accent transition',
                option === value && 'bg-blue-50 text-blue-700 font-medium'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
