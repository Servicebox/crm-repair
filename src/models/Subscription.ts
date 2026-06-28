import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface ISubscription extends Document {
  companyId: Types.ObjectId
  planSlug: string
  billingPeriod: 'monthly' | 'yearly'
  status: 'pending' | 'active' | 'expired' | 'cancelled'
  baseAmount: number        // копейки
  discountPercentage: number
  finalAmount: number       // копейки
  startDate: Date
  endDate: Date
  autoRenew: boolean
  savedPaymentMethodId?: string
  createdBy?: Types.ObjectId
  notes?: string
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    companyId:            { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    planSlug:             { type: String, required: true },
    billingPeriod:        { type: String, enum: ['monthly', 'yearly'], required: true },
    status:               { type: String, enum: ['pending', 'active', 'expired', 'cancelled'], default: 'pending' },
    baseAmount:           { type: Number, required: true, validate: { validator: Number.isInteger, message: '{PATH} must be an integer (kopecks)' } },
    discountPercentage:   { type: Number, default: 0 },
    finalAmount:          { type: Number, required: true, validate: { validator: Number.isInteger, message: '{PATH} must be an integer (kopecks)' } },
    startDate:            { type: Date, required: true },
    endDate:              { type: Date, required: true },
    autoRenew:            { type: Boolean, default: true },
    savedPaymentMethodId: { type: String },
    createdBy:            { type: Schema.Types.ObjectId, ref: 'User' },
    notes:                { type: String },
  },
  { timestamps: true }
)

SubscriptionSchema.index({ companyId: 1, status: 1 })
SubscriptionSchema.index({ endDate: 1, status: 1, autoRenew: 1 })

const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ?? mongoose.model<ISubscription>('Subscription', SubscriptionSchema)
export default Subscription
