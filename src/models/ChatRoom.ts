import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IChatRoom extends Document {
  _id: mongoose.Types.ObjectId
  slug: string
  name: string
  scope: 'global' | 'internal'
  description?: string
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const ChatRoomSchema = new Schema<IChatRoom>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    scope: { type: String, enum: ['global', 'internal'], required: true },
    description: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

const ChatRoom: Model<IChatRoom> =
  mongoose.models.ChatRoom ?? mongoose.model<IChatRoom>('ChatRoom', ChatRoomSchema)
export default ChatRoom

export function getChatRoomModel(conn: mongoose.Connection) {
  return conn.models.ChatRoom ?? conn.model<IChatRoom>('ChatRoom', ChatRoomSchema)
}
