import mongoose, { Document, Model, Schema } from 'mongoose'
import bcrypt from 'bcryptjs'

export type UserRole = 'owner' | 'admin' | 'manager' | 'master'

export interface IUserPermissions {
  canViewAllOrders: boolean
  canCreateOrders: boolean
  canEditOrders: boolean
  canDeleteOrders: boolean
  canChangeStatus: boolean
  canViewClients: boolean
  canEditClients: boolean
  canViewFinance: boolean
  canManageCashRegister: boolean
  canViewWarehouse: boolean
  canManageWarehouse: boolean
  canViewEmployees: boolean
  canManageEmployees: boolean
  canViewReports: boolean
  canViewTelemetry: boolean
  canManageSettings: boolean
  canAccessSales: boolean
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  email: string
  password: string
  role: UserRole
  locationId?: mongoose.Types.ObjectId
  phone?: string
  avatar?: string
  isEmailVerified: boolean
  emailVerificationToken?: string
  emailVerificationExpires?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date
  isActive: boolean
  salary?: {
    type: 'percent_revenue' | 'percent_profit' | 'fixed' | 'rate_per_order'
    value: number
    salesPercent?: number
    guaranteed?: number
  }
  permissions?: IUserPermissions
  createdAt: Date
  updatedAt: Date
  comparePassword(password: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'master'],
      default: 'master',
    },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    phone: { type: String },
    avatar: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    isActive: { type: Boolean, default: true },
    salary: {
      type: {
        type: String,
        enum: ['percent_revenue', 'percent_profit', 'fixed', 'rate_per_order'],
      },
      value: Number,
      salesPercent: Number,
      guaranteed: Number,
    },
    permissions: {
      canViewAllOrders: { type: Boolean, default: false },
      canCreateOrders: { type: Boolean, default: false },
      canEditOrders: { type: Boolean, default: false },
      canDeleteOrders: { type: Boolean, default: false },
      canChangeStatus: { type: Boolean, default: false },
      canViewClients: { type: Boolean, default: false },
      canEditClients: { type: Boolean, default: false },
      canViewFinance: { type: Boolean, default: false },
      canManageCashRegister: { type: Boolean, default: false },
      canViewWarehouse: { type: Boolean, default: false },
      canManageWarehouse: { type: Boolean, default: false },
      canViewEmployees: { type: Boolean, default: false },
      canManageEmployees: { type: Boolean, default: false },
      canViewReports: { type: Boolean, default: false },
      canViewTelemetry: { type: Boolean, default: false },
      canManageSettings: { type: Boolean, default: false },
      canAccessSales: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
)

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

UserSchema.methods.comparePassword = async function (password: string) {
  return bcrypt.compare(password, this.password)
}

UserSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: unknown, ret: any) => {
    delete ret.password
    delete ret.emailVerificationToken
    delete ret.passwordResetToken
    return ret
  },
})

const User: Model<IUser> = mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema)
export default User
