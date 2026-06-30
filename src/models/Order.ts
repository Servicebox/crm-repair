import mongoose, { Document, Model, Schema } from 'mongoose'

export type OrderStatus =
  | 'new'
  | 'diagnostics'
  | 'waiting_approval'
  | 'waiting_parts'
  | 'in_repair'
  | 'quality_check'
  | 'ready'
  | 'issued'
  | 'cancelled'

export type OrderType = 'repair' | 'service'
export type OrderPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ClientType = 'b2c' | 'b2b' | 'individual' | 'ip' | 'company'

export type ChecklistValue = 'ok' | 'defect' | 'na'

export interface IOrderWork {
  serviceId?: mongoose.Types.ObjectId
  name: string
  price: number
  discount?: number
  duration?: number
  cost?: number
  masterId?: mongoose.Types.ObjectId
  masterName?: string
}

export interface IOrderPart {
  productId?: mongoose.Types.ObjectId
  name: string
  quantity: number
  cost: number
  price: number
}

export interface IOrderPayment {
  amount: number
  method: 'cash' | 'card' | 'transfer' | 'online'
  date: Date
  note?: string
}

export interface IOrder extends Document {
  number: string
  type: OrderType
  status: OrderStatus
  priority: OrderPriority
  clientType: ClientType

  clientId: mongoose.Types.ObjectId
  clientName: string
  clientPhone?: string
  clientEmail?: string
  source?: string

  deviceType: string
  deviceBrand?: string
  deviceModel?: string
  deviceColor?: string
  deviceSerial?: string
  deviceImei?: string
  devicePassword?: string
  deviceCondition?: string
  deviceAccessories?: string

  defectDescription: string
  masterComment?: string
  adminComment?: string

  checklist: Record<string, ChecklistValue>
  customChecklistItems: Array<{ id: string; label: string }>

  masterId?: mongoose.Types.ObjectId
  masterName?: string
  locationId?: mongoose.Types.ObjectId

  works: IOrderWork[]
  parts: IOrderPart[]
  payments: IOrderPayment[]

  estimatedCost?: number
  finalCost: number
  prepayment: number
  discount: number
  warrantyDays: number
  warrantyExpires?: Date

  dueDate?: Date
  issuedAt?: Date

  statusHistory: Array<{
    status: OrderStatus
    comment?: string
    userId: mongoose.Types.ObjectId
    userName: string
    createdAt: Date
  }>

  receivedByName?: string
  receivedById?: mongoose.Types.ObjectId
  acceptedAt?: Date
  customFields?: Array<{ label: string; value: string }>
  prepaymentReceived?: boolean
  prepaymentMethod?: string
  photos?: string[]
  deviceAtClient?: boolean
  approvalMessage?: string
  approvalStatus?: string
  clientApprovalComment?: string

  notificationSent: boolean
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const OrderSchema = new Schema<IOrder>(
  {
    number: { type: String, required: true, unique: true },
    type: { type: String, enum: ['repair', 'service'], default: 'repair' },
    status: {
      type: String,
      enum: ['new', 'diagnostics', 'waiting_approval', 'waiting_parts', 'in_repair', 'quality_check', 'ready', 'issued', 'cancelled'],
      default: 'new',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    clientType: { type: String, enum: ['b2c', 'b2b', 'individual', 'ip', 'company'], default: 'individual' },

    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    clientName: { type: String, required: true },
    clientPhone: String,
    clientEmail: String,
    source: String,

    deviceType: { type: String, required: true },
    deviceBrand: String,
    deviceModel: String,
    deviceColor: String,
    deviceSerial: String,
    deviceImei: String,
    devicePassword: String,
    deviceCondition: String,
    deviceAccessories: String,

    defectDescription: { type: String, required: true },
    masterComment: String,
    adminComment: String,

    checklist: { type: Schema.Types.Mixed, default: {} },
    customChecklistItems: {
      type: [{ id: String, label: String }],
      default: [],
    },

    masterId: { type: Schema.Types.ObjectId, ref: 'User' },
    masterName: String,
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },

    works: {
      type: [
        {
          serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
          name: String,
          category: String,  // stored for category-based salary rules
          price: Number,
          discount: { type: Number, default: 0 },
          duration: Number,
          cost: { type: Number, default: 0 },
          masterId: { type: Schema.Types.ObjectId, ref: 'User' },
          masterName: String,
        },
      ],
      default: [],
    },

    parts: {
      type: [
        {
          productId: { type: Schema.Types.ObjectId, ref: 'Product' },
          name: String,
          quantity: Number,
          cost: Number,
          price: Number,
        },
      ],
      default: [],
    },

    payments: {
      type: [
        {
          amount: Number,
          method: { type: String, enum: ['cash', 'card', 'transfer', 'online'] },
          date: Date,
          note: String,
        },
      ],
      default: [],
    },

    estimatedCost: Number,
    finalCost: { type: Number, default: 0 },
    prepayment: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    warrantyDays: { type: Number, default: 30 },
    warrantyExpires: Date,

    dueDate: Date,
    issuedAt: Date,

    statusHistory: {
      type: [
        {
          status: String,
          comment: String,
          userId: { type: Schema.Types.ObjectId, ref: 'User' },
          userName: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    receivedByName: String,
    receivedById: { type: Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: Date,
    customFields: {
      type: [{ label: String, value: String }],
      default: [],
    },
    prepaymentReceived: { type: Boolean, default: false },
    prepaymentMethod: String,
    photos: { type: [String], default: [] },
    deviceAtClient: { type: Boolean, default: false },
    approvalMessage: String,
    approvalStatus: String,
    clientApprovalComment: String,

    notificationSent: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

OrderSchema.index({ clientId: 1 })
OrderSchema.index({ masterId: 1 })
OrderSchema.index({ status: 1 })
OrderSchema.index({ createdAt: -1 })
OrderSchema.index({
  number: 'text',
  clientName: 'text',
  clientPhone: 'text',
  deviceModel: 'text',
  deviceImei: 'text',
})

const Order: Model<IOrder> =
  mongoose.models.Order ?? mongoose.model<IOrder>('Order', OrderSchema)
export default Order

export function getOrderModel(conn: mongoose.Connection) {
  return conn.models.Order ?? conn.model<IOrder>('Order', OrderSchema)
}
