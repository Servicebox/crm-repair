import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IAuditLog extends Document {
  type: string
  action: string
  description: string
  userId?: mongoose.Types.ObjectId
  userName: string
  ip?: string
  meta?: unknown
  createdAt: Date
  updatedAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    type: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    description: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    ip: String,
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
)

AuditLogSchema.index({ createdAt: -1 })
AuditLogSchema.index({ type: 1, action: 1 })

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ?? mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
export default AuditLog

export function getAuditLogModel(conn: mongoose.Connection) {
  return conn.models.AuditLog ?? conn.model<IAuditLog>('AuditLog', AuditLogSchema)
}
