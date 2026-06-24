import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IShift extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  openedBy: mongoose.Types.ObjectId
  locationId?: mongoose.Types.ObjectId
  openedAt: Date
  closedAt?: Date
  durationMinutes?: number
  status: 'open' | 'closed'
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const ShiftSchema = new Schema<IShift>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    openedAt: { type: Date, required: true },
    closedAt: { type: Date },
    durationMinutes: { type: Number },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    notes: { type: String },
  },
  { timestamps: true }
)

ShiftSchema.index({ userId: 1, status: 1 })
ShiftSchema.index({ userId: 1, openedAt: -1 })

const Shift: Model<IShift> = mongoose.models.Shift ?? mongoose.model<IShift>('Shift', ShiftSchema)
export default Shift

export function getShiftModel(conn: mongoose.Connection) {
  return conn.models.Shift ?? conn.model<IShift>('Shift', ShiftSchema)
}
