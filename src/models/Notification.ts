import mongoose, { Document, Model, Schema } from 'mongoose'

export type NotificationType = 'order_new' | 'order_status' | 'order_payment' | 'stock_low' | 'system'

export interface INotification extends Document {
  type: NotificationType
  title: string
  body: string
  read: boolean
  link?: string
  orderId?: mongoose.Types.ObjectId
  orderNumber?: string
  createdAt: Date
  updatedAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: ['order_new', 'order_status', 'order_payment', 'stock_low', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    read: { type: Boolean, default: false },
    link: String,
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: String,
  },
  { timestamps: true }
)

NotificationSchema.index({ createdAt: -1 })
NotificationSchema.index({ read: 1 })

const Notification: Model<INotification> =
  mongoose.models.Notification ?? mongoose.model<INotification>('Notification', NotificationSchema)

export default Notification
