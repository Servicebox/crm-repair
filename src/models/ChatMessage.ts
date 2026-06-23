import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IChatMessage extends Document {
  roomId: string
  userId: mongoose.Types.ObjectId
  userName: string
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
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userAvatar: String,
    text: { type: String, required: true, trim: true },
    attachments: [
      {
        name: String,
        url: String,
        type: String,
      },
    ],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

ChatMessageSchema.index({ roomId: 1, createdAt: -1 })

const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage ??
  mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema)
export default ChatMessage
