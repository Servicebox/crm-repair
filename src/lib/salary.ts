// Flexible salary / motivation system — shared types and calculation logic

export type SalarySource =
  | 'services_all'       // All works / services in the order
  | 'services_category'  // Works of specific service categories
  | 'parts_all'          // All parts / goods
  | 'order_intake'       // Fixed bonus per order received (receivedById)
  | 'shift'              // Fixed bonus per shift
  | 'hourly'             // Per hour worked

export type SalaryMethod = 'percent_revenue' | 'percent_profit' | 'fixed'

export interface SalaryRule {
  id: string
  source: SalarySource
  categories?: string[]  // when source === 'services_category'
  method: SalaryMethod
  value: number
  enabled: boolean
}

export interface FlexSalary {
  guaranteed: number
  rules: SalaryRule[]
}

// Legacy — kept for backward compatibility with existing DB records
export interface LegacySalary {
  type: 'percent_revenue' | 'percent_profit' | 'fixed' | 'rate_per_order' | 'hourly'
  value: number
  hourlyRate?: number
  overtimeMultiplier?: number
  guaranteed?: number
}

export type AnyMasterSalary = FlexSalary | LegacySalary

export function isFlexSalary(s: AnyMasterSalary | null | undefined): s is FlexSalary {
  return Array.isArray((s as FlexSalary)?.rules)
}

export const SOURCE_LABELS: Record<SalarySource, string> = {
  services_all: 'Все услуги',
  services_category: 'Категория услуг',
  parts_all: 'Запчасти / товары',
  order_intake: 'Приём заказа',
  shift: 'Смена',
  hourly: 'Почасовая',
}

export const METHOD_LABELS: Record<SalaryMethod, string> = {
  percent_revenue: '% от выручки',
  percent_profit: '% от прибыли',
  fixed: 'Фиксированно',
}

// Sources where percent methods make sense
export const PERCENT_SOURCES: SalarySource[] = ['services_all', 'services_category', 'parts_all']
// Sources where only fixed amount is valid
export const FIXED_ONLY_SOURCES: SalarySource[] = ['order_intake', 'shift', 'hourly']

export function makeRule(partial?: Partial<SalaryRule>): SalaryRule {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10),
    source: 'services_all',
    method: 'percent_revenue',
    value: 10,
    enabled: true,
    ...partial,
  }
}

export function ruleLabel(rule: SalaryRule): string {
  const src = SOURCE_LABELS[rule.source]
  const cats =
    rule.source === 'services_category' && rule.categories?.length
      ? ` [${rule.categories.join(', ')}]`
      : ''
  const valStr = FIXED_ONLY_SOURCES.includes(rule.source) || rule.method === 'fixed'
    ? `${rule.value} ₽`
    : `${rule.value}%`
  return `${src}${cats} — ${valStr}`
}

// ─── Calculation types ────────────────────────────────────────────────────────

export interface CalcWork {
  price: number
  discount?: number
  cost?: number
  category?: string
}

export interface CalcPart {
  price: number
  quantity: number
  cost?: number
}

export interface CalcOrder {
  works: CalcWork[]
  parts: CalcPart[]
  isIntake?: boolean  // true when this employee received (receivedById) the order
}

export interface RuleResult {
  ruleId: string
  source: SalarySource
  method: SalaryMethod
  label: string   // human-readable summary for display
  base: number    // the amount the rule was applied to (revenue / profit / count)
  amount: number  // resulting earning
}

export interface EarningsBreakdown {
  byRule: RuleResult[]
  subtotal: number   // sum of all rules
  guaranteed: number
  total: number      // max(subtotal, guaranteed)
}

// ─── Flex calculation ─────────────────────────────────────────────────────────

export function calcFlexEarnings(
  salary: FlexSalary,
  orders: CalcOrder[],
  shifts: { shiftsCount: number; hoursWorked: number },
): EarningsBreakdown {
  const byRule: RuleResult[] = []

  for (const rule of salary.rules) {
    if (!rule.enabled) continue

    let base = 0
    let amount = 0

    switch (rule.source) {
      case 'services_all':
      case 'services_category': {
        for (const order of orders) {
          const works =
            rule.source === 'services_all'
              ? order.works
              : order.works.filter(
                  w => !rule.categories?.length || rule.categories.includes(w.category ?? ''),
                )
          if (rule.method === 'percent_revenue') {
            const rev = works.reduce((s, w) => s + w.price - (w.discount ?? 0), 0)
            base += rev
            amount += (rev * rule.value) / 100
          } else if (rule.method === 'percent_profit') {
            const prof = works.reduce(
              (s, w) => s + (w.price - (w.discount ?? 0)) - (w.cost ?? 0),
              0,
            )
            base += prof
            amount += (Math.max(0, prof) * rule.value) / 100
          }
        }
        break
      }
      case 'parts_all': {
        for (const order of orders) {
          if (rule.method === 'percent_revenue') {
            const rev = order.parts.reduce((s, p) => s + p.price * p.quantity, 0)
            base += rev
            amount += (rev * rule.value) / 100
          } else if (rule.method === 'percent_profit') {
            const prof = order.parts.reduce(
              (s, p) => s + (p.price - (p.cost ?? 0)) * p.quantity,
              0,
            )
            base += prof
            amount += (Math.max(0, prof) * rule.value) / 100
          }
        }
        break
      }
      case 'order_intake': {
        const count = orders.filter(o => o.isIntake).length
        base = count
        amount = count * rule.value
        break
      }
      case 'shift': {
        base = shifts.shiftsCount
        amount = shifts.shiftsCount * rule.value
        break
      }
      case 'hourly': {
        base = shifts.hoursWorked
        amount = shifts.hoursWorked * rule.value
        break
      }
    }

    byRule.push({
      ruleId: rule.id,
      source: rule.source,
      method: rule.method,
      label: ruleLabel(rule),
      base,
      amount,
    })
  }

  const subtotal = byRule.reduce((s, r) => s + r.amount, 0)
  const guaranteed = salary.guaranteed ?? 0
  const total = Math.max(subtotal, guaranteed)

  return { byRule, subtotal, guaranteed, total }
}

// ─── Legacy calculation (backward compat) ────────────────────────────────────

export function calcLegacyEarnings(
  salary: LegacySalary,
  revenue: number,
  profit: number,
  hoursWorked: number,
  ordersCount: number,
): number | null {
  let base = 0
  switch (salary.type) {
    case 'percent_revenue':
      base = (revenue * salary.value) / 100
      break
    case 'percent_profit':
      base = Math.max(0, (profit * salary.value) / 100)
      break
    case 'fixed':
      base = salary.value
      break
    case 'rate_per_order':
      base = ordersCount * salary.value
      break
    case 'hourly':
      base = hoursWorked * (salary.hourlyRate ?? salary.value)
      break
    default:
      return null
  }
  return Math.max(base, salary.guaranteed ?? 0)
}
