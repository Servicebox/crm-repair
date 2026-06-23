import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, fmt = 'dd.MM.yyyy') {
  return format(new Date(date), fmt, { locale: ru })
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: ru })
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`
  }
  return phone
}

export function generateOrderNumber(prefix = 'SB', counter: number) {
  return `${prefix}-${String(counter).padStart(6, '0')}`
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
