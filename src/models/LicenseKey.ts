import mongoose, { Document, Model, Schema, Types } from 'mongoose'

export interface ILicenseKey extends Document {
  key: string
  companyId?: Types.ObjectId
  planSlug: string
  durationDays: number
  isUsed: boolean
  activatedAt?: Date
  keyExpiresAt: Date
  createdBy: Types.ObjectId
}

const LicenseKeySchema = new Schema<ILicenseKey>(
  {
    key:          { type: String, required: true, unique: true },
    companyId:    { type: Schema.Types.ObjectId, ref: 'Company', sparse: true },
    planSlug:     { type: String, required: true },
    durationDays: { type: Number, required: true },
    isUsed:       { type: Boolean, default: false },
    activatedAt:  { type: Date },
    keyExpiresAt: { type: Date, required: true },
    createdBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

const LicenseKey: Model<ILicenseKey> =
  mongoose.models.LicenseKey ?? mongoose.model<ILicenseKey>('LicenseKey', LicenseKeySchema)
export default LicenseKey
