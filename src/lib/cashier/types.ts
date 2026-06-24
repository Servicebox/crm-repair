export interface CashierReceiptItem {
  name: string
  price: number
  quantity: number
  amount: number
  tax: 'none' | 'vat0' | 'vat10' | 'vat20'
  paymentMethod: 'full_payment' | 'prepayment'
  paymentObject: 'service' | 'commodity'
}

export interface CashierReceiptData {
  orderId: string
  externalId: string
  items: CashierReceiptItem[]
  total: number
  paymentMethod: 'cash' | 'card' | 'transfer'
  clientEmail?: string
  clientPhone?: string
  cashierName?: string  // ФИО кассира — обязательно по 54-ФЗ
}

export interface CashierResult {
  success: boolean
  uuid?: string
  receiptId?: string
  receiptUrl?: string
  error?: string
}

export interface AtolConfig {
  login: string
  password: string
  groupCode: string
  inn: string
  paymentAddress: string
  sno?: string
  callbackUrl?: string
  companyEmail?: string
}

export interface EvotorConfig {
  token: string
  storeId: string
}

export interface CloudkassirConfig {
  apiKey: string
  groupCode: string
  keyName: string
}
