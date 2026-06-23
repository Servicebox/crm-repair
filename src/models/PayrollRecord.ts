import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IPayrollRecord extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  month: string // 'YYYY-MM'
  ordersCount: number
  worksCount: number
  revenue: number
  profit: number
  accrued: number
  paid: number
  paidAt?: Date
  status: 'pending' | 'paid'
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const PayrollRecordSchema = new Schema<IPayrollRecord>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true },
  ordersCount: { type: Number, default: 0 },
  worksCount: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  accrued: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  paidAt: { type: Date },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  notes: { type: String },
}, { timestamps: true })

PayrollRecordSchema.index({ userId: 1, month: 1 }, { unique: true })

const PayrollRecord: Model<IPayrollRecord> = mongoose.models.PayrollRecord ?? mongoose.model<IPayrollRecord>('PayrollRecord', PayrollRecordSchema)
export default PayrollRecord
