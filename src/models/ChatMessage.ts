import mongoose, { Document, Model, Schema } from 'mongoose'
import type { ChatRoomScope } from './ChatRoom'

export interface IChatMessage extends Document {
  roomId: string
  scope: ChatRoomScope
  userId: mongoose.Types.ObjectId
  userName: string
  companyId?: mongoose.Types.ObjectId
  companyName?: string
  userAvatar?: string
  text: string
  attachments?: Array<{ name: string; url: string; type: string }>
  readBy: mongoose.Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: { type: String, required: true, default: 'general' },
    scope: { type: String, enum: ['global', 'internal', 'inter_org'], default: 'global' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    companyName: { type: String, default: null },
    userAvatar: String,
    text: { type: String, required: true, trim: true },
    attachments: [{ name: String, url: String, type: String }],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

// Single compound index satisfies: fetch messages for a room sorted by time,
// and per-room pagination queries (Last-Event-ID resumption).
ChatMessageSchema.index({ roomId: 1, createdAt: -1 })

const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage ??
  mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema)
export default ChatMessage

export function getChatMessageModel(conn: mongoose.Connection) {
  if (conn.models.ChatMessage) return conn.models.ChatMessage as Model<IChatMessage>
  return conn.model<IChatMessage>('ChatMessage', ChatMessageSchema)
}
