import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded'

export interface IPayment extends Document {
  companyId: Types.ObjectId
  subscriptionId: Types.ObjectId
  yookassaPaymentId?: string
  amount: number           // копейки
  status: PaymentStatus
  paidAt?: Date
  rawWebhook?: unknown
  createdAt: Date
}

const PaymentSchema = new Schema<IPayment>(
  {
    companyId:          { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    subscriptionId:     { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    yookassaPaymentId:  { type: String, sparse: true, unique: true },
    amount:             { type: Number, required: true, validate: { validator: Number.isInteger, message: '{PATH} must be an integer (kopecks)' } },
    status:             { type: String, enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'], default: 'pending' },
    paidAt:             { type: Date },
    rawWebhook:         { type: Schema.Types.Mixed },
  },
  { timestamps: true }
)

PaymentSchema.index({ subscriptionId: 1 })
PaymentSchema.index({ companyId: 1, createdAt: -1 })

const Payment: Model<IPayment> =
  mongoose.models.Payment ?? mongoose.model<IPayment>('Payment', PaymentSchema)
export default Payment
