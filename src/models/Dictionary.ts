import mongoose, { Document, Model, Schema } from 'mongoose'

export type DictionaryType = 'deviceType' | 'condition' | 'accessories' | 'defect'

export interface IDictionary extends Document {
  type: DictionaryType
  value: string
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const DictionarySchema = new Schema<IDictionary>(
  {
    type: {
      type: String,
      enum: ['deviceType', 'condition', 'accessories', 'defect'],
      required: true,
      index: true,
    },
    value: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

DictionarySchema.index({ type: 1, value: 1 }, { unique: true })

const Dictionary: Model<IDictionary> =
  mongoose.models.Dictionary ?? mongoose.model<IDictionary>('Dictionary', DictionarySchema)
export default Dictionary

export function getDictionaryModel(conn: mongoose.Connection) {
  return conn.models.Dictionary ?? conn.model<IDictionary>('Dictionary', DictionarySchema)
}
