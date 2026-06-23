import mongoose, { Document, Model, Schema } from 'mongoose'

export interface ILocation extends Document {
  name: string
  address?: string
  phone?: string
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true },
    address: String,
    phone: String,
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const Location: Model<ILocation> =
  mongoose.models.Location ?? mongoose.model<ILocation>('Location', LocationSchema)
export default Location
