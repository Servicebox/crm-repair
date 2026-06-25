import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { parse as dateParse, parseISO, isValid, format } from 'date-fns'
import { ru } from 'date-fns/locale'

export type TransformerKey =
  | 'phone_normalize'
  | 'email_lowercase'
  | 'date_parse'
  | 'status_map'
  | 'price_parse'
  | 'trim'
  | 'none'

// Status mapping: Russian CRM values → system enum values
const STATUS_MAP: Record<string, string> = {
  'новый': 'new',
  'new': 'new',
  'диагностика': 'diagnostics',
  'diagnostics': 'diagnostics',
  'ожидает согласования': 'waiting_approval',
  'ожидание запчастей': 'waiting_parts',
  'waiting_parts': 'waiting_parts',
  'в работе': 'in_repair',
  'в ремонте': 'in_repair',
  'repairing': 'in_repair',
  'in_repair': 'in_repair',
  'проверка качества': 'quality_check',
  'готов': 'ready',
  'ready': 'ready',
  'выдан': 'issued',
  'issued': 'issued',
  'выдано': 'issued',
  'закрыт': 'issued',
  'completed': 'issued',
  'отменён': 'cancelled',
  'отмена': 'cancelled',
  'cancelled': 'cancelled',
}

const DATE_FORMATS = [
  'dd.MM.yyyy',
  'dd.MM.yyyy HH:mm',
  'dd.MM.yyyy HH:mm:ss',
  'yyyy-MM-dd',
  'yyyy-MM-dd HH:mm:ss',
  'MM/dd/yyyy',
  'd MMMM yyyy',
  'd MMM yyyy',
]

export const transformers: Record<TransformerKey, (value: unknown, extra?: unknown) => unknown> = {
  phone_normalize(value) {
    if (!value) return null
    const str = String(value).trim()
    if (!str) return null
    try {
      // Try Russian default first, then generic
      const phone = parsePhoneNumberFromString(str, 'RU')
        ?? parsePhoneNumberFromString(str)
      return phone?.isValid() ? phone.format('E.164') : null
    } catch {
      return null
    }
  },

  email_lowercase(value) {
    if (!value) return null
    const str = String(value).trim().toLowerCase()
    return str || null
  },

  date_parse(value) {
    if (!value) return null
    const str = String(value).trim()
    if (!str) return null

    // Try ISO first (fastest path)
    const iso = parseISO(str)
    if (isValid(iso)) return iso

    // Try Russian locale formats
    for (const fmt of DATE_FORMATS) {
      try {
        const d = dateParse(str, fmt, new Date(), { locale: ru })
        if (isValid(d)) return d
      } catch { /* try next format */ }
    }

    // Last resort: native Date parse
    const native = new Date(str)
    return isValid(native) ? native : null
  },

  status_map(value, extra) {
    if (!value) return null
    const str = String(value).toLowerCase().trim()
    // Check user-provided mapping first (extra is Record<string, string>)
    if (extra && typeof extra === 'object') {
      const custom = (extra as Record<string, string>)[str]
      if (custom) return custom
    }
    return STATUS_MAP[str] ?? str
  },

  price_parse(value) {
    if (!value) return null
    const str = String(value)
      .replace(/[^\d,.]/g, '')   // remove currency symbols, spaces
      .replace(',', '.')          // normalize decimal separator
    const num = parseFloat(str)
    return isNaN(num) ? null : Math.round(num * 100) / 100  // 2 decimal places
  },

  trim(value) {
    if (value == null) return ''
    return String(value).trim()
  },

  none(value) {
    return value
  },
}

export function applyTransformer(
  key: string,
  value: unknown,
  extra?: unknown
): unknown {
  const fn = transformers[key as TransformerKey]
  if (!fn) return value
  try {
    return fn(value, extra)
  } catch {
    return null
  }
}

export const TRANSFORMER_OPTIONS: Array<{ value: TransformerKey; label: string }> = [
  { value: 'none', label: 'Без преобразования' },
  { value: 'trim', label: 'Обрезать пробелы' },
  { value: 'phone_normalize', label: 'Нормализовать телефон (E.164)' },
  { value: 'email_lowercase', label: 'Email → строчные' },
  { value: 'date_parse', label: 'Распарсить дату' },
  { value: 'price_parse', label: 'Распарсить цену' },
  { value: 'status_map', label: 'Маппинг статусов' },
]
