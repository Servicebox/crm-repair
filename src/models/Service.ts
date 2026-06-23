import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IService extends Document {
  name: string
  description?: string
  category?: string
  deviceTypes: string[]
  price: number
  cost?: number
  duration?: number
  warrantyDays?: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const ServiceSchema = new Schema<IService>(
  {
    name: { type: String, required: true },
    description: String,
    category: String,
    deviceTypes: { type: [String], default: [] },
    price: { type: Number, required: true, default: 0 },
    cost: { type: Number, default: 0 },
    duration: Number,
    warrantyDays: { type: Number, default: 30 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const Service: Model<IService> =
  mongoose.models.Service ?? mongoose.model<IService>('Service', ServiceSchema)
export default Service
