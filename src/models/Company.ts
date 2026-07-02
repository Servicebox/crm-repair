import mongoose, { Document, Model, Schema } from 'mongoose'

export interface DocTemplateSettings {
  showLogo: boolean
  showRequisites: boolean
  headerNote: string
  footerText: string
  legalText: string
  showQr: boolean
  showTearOff: boolean
}

export interface WorksActTemplateSettings extends DocTemplateSettings {
  showParts: boolean
  warrantyText: string
  signatureNote: string
}

export interface ICompany extends Document {
  name: string
  slug: string
  dbName: string
  isActive: boolean
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'blocked' | 'free'
  subscriptionPlan?: string
  subscriptionEndDate?: Date
  trialEndDate?: Date
  pastDueUntil?: Date
  discountPercentage: number
  phone?: string
  email?: string
  address?: string
  website?: string
  inn?: string
  ogrn?: string
  logo?: string
  brandColor?: string
  orderPrefix?: string
  orderCounter: number
  defaultWarrantyDays: number
  defaultReadyDays: number
  notificationTemplates: {
    statusChange?: string
    ready?: string
    issued?: string
  }
  receiptSettings: {
    showLogo: boolean
    showRequisites: boolean
    footerText?: string
  }
  checklistItems: Array<{
    id: string
    label: string
    order: number
  }>
  acceptanceFormFields: Array<{
    key: string
    label: string
    visible: boolean
    required: boolean
  }>
  features: {
    electronicSignature: boolean
    clientReturn: boolean
    vkIntegration: boolean
    telegramBot: boolean
  }
  telegramBotToken?: string
  telegramWebhookSecret?: string
  vkGroupId?: string
  vkAccessToken?: string
  reviewUrl?: string
  outboundWebhook?: {
    url?: string
    secret?: string
    events?: {
      newOrder?: boolean
      statusChange?: boolean
      payment?: boolean
    }
  }
  receptionSettings?: unknown
  labelSettings?: unknown
  fiscalSettings?: unknown
  cashierSettings?: unknown
  documentTemplates?: {
    receipt?: DocTemplateSettings
    acceptance?: DocTemplateSettings
    worksAct?: WorksActTemplateSettings
  }
  createdAt: Date
  updatedAt: Date
}

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, default: 'Мой сервисный центр' },
    slug: { type: String, unique: true, sparse: true },
    dbName: { type: String },
    isActive: { type: Boolean, default: true },
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'past_due', 'blocked', 'free'],
      default: 'trial',
    },
    subscriptionPlan: { type: String },
    subscriptionEndDate: { type: Date },
    trialEndDate: { type: Date },
    pastDueUntil: { type: Date },
    discountPercentage: { type: Number, default: 0 },
    phone: String,
    email: String,
    address: String,
    website: String,
    inn: String,
    ogrn: String,
    logo: String,
    brandColor: { type: String, default: '#3b82f6' },
    orderPrefix: { type: String, default: 'SB' },
    orderCounter: { type: Number, default: 0 },
    defaultWarrantyDays: { type: Number, default: 30 },
    defaultReadyDays: { type: Number, default: 3 },
    notificationTemplates: {
      statusChange: {
        type: String,
        default: 'Статус вашего заказа {{number}} изменён на «{{status}}»',
      },
      ready: {
        type: String,
        default: 'Ваш заказ {{number}} готов к выдаче! Ждём вас в {{address}}',
      },
      issued: {
        type: String,
        default: 'Заказ {{number}} выдан. Спасибо за доверие!',
      },
    },
    receiptSettings: {
      showLogo: { type: Boolean, default: true },
      showRequisites: { type: Boolean, default: true },
      footerText: { type: String, default: 'Спасибо за ваш заказ!' },
    },
    checklistItems: {
      type: [
        {
          id: String,
          label: String,
          order: Number,
        },
      ],
      default: [
        { id: 'screen', label: 'Экран / стекло', order: 1 },
        { id: 'body', label: 'Корпус / царапины', order: 2 },
        { id: 'back', label: 'Задняя крышка', order: 3 },
        { id: 'cameras', label: 'Камеры', order: 4 },
        { id: 'buttons', label: 'Кнопки / качелька', order: 5 },
        { id: 'speakers', label: 'Динамики / микрофон', order: 6 },
        { id: 'charge', label: 'Разъём зарядки', order: 7 },
        { id: 'sim', label: 'SIM / сеть', order: 8 },
        { id: 'wifi', label: 'Wi-Fi / Bluetooth', order: 9 },
        { id: 'battery', label: 'Аккумулятор', order: 10 },
        { id: 'moisture', label: 'Следы влаги / коррозии', order: 11 },
        { id: 'completeness', label: 'Комплектность', order: 12 },
      ],
    },
    acceptanceFormFields: {
      type: [
        {
          key: String,
          label: String,
          visible: Boolean,
          required: Boolean,
        },
      ],
      default: [
        { key: 'password', label: 'Пароль устройства', visible: true, required: false },
        { key: 'imei', label: 'IMEI', visible: true, required: false },
        { key: 'serial', label: 'Серийный номер', visible: true, required: false },
        { key: 'color', label: 'Цвет', visible: true, required: false },
        { key: 'condition', label: 'Внешнее состояние', visible: true, required: false },
        { key: 'accessories', label: 'Комплектация', visible: true, required: false },
      ],
    },
    features: {
      electronicSignature: { type: Boolean, default: false },
      clientReturn: { type: Boolean, default: false },
      vkIntegration: { type: Boolean, default: false },
      telegramBot: { type: Boolean, default: false },
    },
    telegramBotToken: String,
    telegramWebhookSecret: String,
    vkGroupId: String,
    vkAccessToken: String,
    reviewUrl: String,
    outboundWebhook: { type: Schema.Types.Mixed, default: null },
    receptionSettings: { type: Schema.Types.Mixed, default: null },
    labelSettings: { type: Schema.Types.Mixed, default: null },
    fiscalSettings: { type: Schema.Types.Mixed, default: null },
    cashierSettings: { type: Schema.Types.Mixed, default: null },
    documentTemplates: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
)

const Company: Model<ICompany> =
  mongoose.models.Company ?? mongoose.model<ICompany>('Company', CompanySchema)
export default Company
