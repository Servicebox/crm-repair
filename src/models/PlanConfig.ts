import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IPlanConfig extends Document {
  slug: string
  name: string
  priceMonthly: number   // копейки
  priceYearly: number    // копейки
  maxUsers: number
  maxLocations: number
  features: string[]
  isActive: boolean
  sortOrder: number
}

const PlanConfigSchema = new Schema<IPlanConfig>(
  {
    slug:          { type: String, required: true, unique: true },
    name:          { type: String, required: true },
    priceMonthly:  { type: Number, required: true },
    priceYearly:   { type: Number, required: true },
    maxUsers:      { type: Number, required: true },
    maxLocations:  { type: Number, required: true },
    features:      { type: [String], default: [] },
    isActive:      { type: Boolean, default: true },
    sortOrder:     { type: Number, default: 0 },
  },
  { timestamps: true }
)

const PlanConfig: Model<IPlanConfig> =
  mongoose.models.PlanConfig ?? mongoose.model<IPlanConfig>('PlanConfig', PlanConfigSchema)
export default PlanConfig
