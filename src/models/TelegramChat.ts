import mongoose, { Document, Model, Schema } from 'mongoose'

export interface ITelegramChat extends Document {
  companyId: mongoose.Types.ObjectId
  chatId?: string          // Telegram chat_id (set after linking)
  userId?: string          // User._id from tenant DB (as string)
  dbName: string           // tenant DB name, needed to look up user role
  userName?: string        // cached display name
  linkCode?: string        // ephemeral code employee sends to bot
  linkCodeExpires?: Date
  status: 'pending' | 'active'
  createdAt: Date
  updatedAt: Date
}

const TelegramChatSchema = new Schema<ITelegramChat>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    chatId: { type: String, sparse: true },
    userId: { type: String, index: true },
    dbName: { type: String, required: true },
    userName: String,
    linkCode: { type: String, sparse: true },
    linkCodeExpires: Date,
    status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  },
  { timestamps: true }
)

// One chat_id per company (one employee — one Telegram account per org)
TelegramChatSchema.index({ companyId: 1, chatId: 1 }, { unique: true, sparse: true })
// One link code per company (prevents collision)
TelegramChatSchema.index({ companyId: 1, linkCode: 1 }, { unique: true, sparse: true })

const TelegramChat: Model<ITelegramChat> =
  mongoose.models.TelegramChat ?? mongoose.model<ITelegramChat>('TelegramChat', TelegramChatSchema)
export default TelegramChat
