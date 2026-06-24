import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IClient extends Document {
  name: string
  phone?: string
  email?: string
  source?: string
  notes?: string
  discount?: number
  totalOrders: number
  totalRevenue: number
  lastOrderDate?: Date
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    source: String,
    notes: String,
    discount: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    lastOrderDate: Date,
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
)

ClientSchema.index({ phone: 1 })
ClientSchema.index({ email: 1 })
ClientSchema.index({ name: 'text', phone: 'text', email: 'text' })

const Client: Model<IClient> =
  mongoose.models.Client ?? mongoose.model<IClient>('Client', ClientSchema)
export default Client

export function getClientModel(conn: mongoose.Connection) {
  return conn.models.Client ?? conn.model<IClient>('Client', ClientSchema)
}
