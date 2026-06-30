import mongoose, { Document, Model, Schema } from 'mongoose'

export type ChatRoomScope = 'global' | 'internal' | 'inter_org'

export interface IChatRoom extends Document {
  _id: mongoose.Types.ObjectId
  slug: string
  name: string
  scope: ChatRoomScope
  description?: string
  // For inter_org rooms: the company IDs that can read/write this room.
  // Empty for global/internal rooms (access controlled by session scope).
  participants: mongoose.Types.ObjectId[]
  createdBy?: mongoose.Types.ObjectId
  // Order-linked rooms
  orderId?: mongoose.Types.ObjectId
  orderNumber?: string
  createdAt: Date
  updatedAt: Date
}

const ChatRoomSchema = new Schema<IChatRoom>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    scope: { type: String, enum: ['global', 'internal', 'inter_org'], required: true },
    description: { type: String },
    participants: [{ type: Schema.Types.ObjectId, ref: 'Company' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: { type: String },
  },
  { timestamps: true }
)

// Fast lookup: all inter_org rooms a company participates in
ChatRoomSchema.index({ participants: 1, scope: 1 })

const ChatRoom: Model<IChatRoom> =
  mongoose.models.ChatRoom ?? mongoose.model<IChatRoom>('ChatRoom', ChatRoomSchema)
export default ChatRoom

export function getChatRoomModel(conn: mongoose.Connection) {
  if (conn.models.ChatRoom) return conn.models.ChatRoom as Model<IChatRoom>
  return conn.model<IChatRoom>('ChatRoom', ChatRoomSchema)
}
