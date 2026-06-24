import mongoose, { Document, Model, Schema } from 'mongoose'

export type TransactionType = 'income' | 'expense'

export interface ITransaction extends Document {
  type: TransactionType
  amount: number
  category: string
  description?: string
  orderId?: mongoose.Types.ObjectId
  orderNumber?: string
  paymentMethod: 'cash' | 'card' | 'transfer' | 'online' | 'qr' | 'invoice'
  userId?: mongoose.Types.ObjectId
  createdBy?: string
  locationId?: mongoose.Types.ObjectId
  date: Date
  createdAt: Date
  updatedAt: Date
}

const TransactionSchema = new Schema<ITransaction>(
  {
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    description: String,
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: String,
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'transfer', 'online', 'qr', 'invoice'],
      default: 'cash',
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: String },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

TransactionSchema.index({ date: -1 })
TransactionSchema.index({ type: 1, date: -1 })

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ??
  mongoose.model<ITransaction>('Transaction', TransactionSchema)
export default Transaction

export function getTransactionModel(conn: mongoose.Connection) {
  return conn.models.Transaction ?? conn.model<ITransaction>('Transaction', TransactionSchema)
}
