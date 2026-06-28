import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IPayrollAdjustment {
  _id: mongoose.Types.ObjectId
  amount: number
  reason: string
  addedAt: Date
  addedBy: mongoose.Types.ObjectId
}

export interface IPayrollRecord extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  month: string // 'YYYY-MM'
  ordersCount: number
  worksCount: number
  revenue: number       // полная выручка (работы + запчасти)
  worksRevenue: number  // выручка только по работам (база для % зарплаты)
  profit: number
  hoursWorked: number
  shiftsCount: number
  accrued: number
  paid: number
  paidAt?: Date
  status: 'pending' | 'paid'
  notes?: string
  bonuses: IPayrollAdjustment[]
  deductions: IPayrollAdjustment[]
  /** Разбивка начисления по правилам (только для FlexSalary) */
  breakdown?: unknown
  createdAt: Date
  updatedAt: Date
}

const AdjustmentSchema = new Schema<IPayrollAdjustment>(
  {
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true }
)

const PayrollRecordSchema = new Schema<IPayrollRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true },
    ordersCount: { type: Number, default: 0 },
    worksCount: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    worksRevenue: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    hoursWorked: { type: Number, default: 0 },
    shiftsCount: { type: Number, default: 0 },
    accrued: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    paidAt: { type: Date },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    notes: { type: String },
    bonuses: { type: [AdjustmentSchema], default: [] },
    deductions: { type: [AdjustmentSchema], default: [] },
    breakdown: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
)

PayrollRecordSchema.index({ userId: 1, month: 1 }, { unique: true })

const PayrollRecord: Model<IPayrollRecord> =
  mongoose.models.PayrollRecord ?? mongoose.model<IPayrollRecord>('PayrollRecord', PayrollRecordSchema)
export default PayrollRecord

export function getPayrollRecordModel(conn: mongoose.Connection) {
  return conn.models.PayrollRecord ?? conn.model<IPayrollRecord>('PayrollRecord', PayrollRecordSchema)
}
