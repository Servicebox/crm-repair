import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IFiscalReceiptItem {
  name: string
  qty: number
  price: number
  vat: number
}

export interface IFiscalReceipt extends Document {
  orderId?: mongoose.Types.ObjectId
  type: 'sale' | 'refund'
  items: IFiscalReceiptItem[]
  total: number
  paymentMethod: 'cash' | 'card' | 'qr'
  status: 'pending' | 'sent' | 'registered' | 'error'
  receiptId?: string
  provider?: string
  uuid?: string
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

const FiscalReceiptSchema = new Schema<IFiscalReceipt>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    type: { type: String, enum: ['sale', 'refund'], default: 'sale' },
    items: [{ name: String, qty: Number, price: Number, vat: Number }],
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'card', 'qr'], required: true },
    status: { type: String, enum: ['pending', 'sent', 'registered', 'error'], default: 'pending' },
    receiptId: String,
    provider: String,
    uuid: String,
    errorMessage: String,
  },
  { timestamps: true }
)

const FiscalReceipt: Model<IFiscalReceipt> =
  mongoose.models.FiscalReceipt ?? mongoose.model<IFiscalReceipt>('FiscalReceipt', FiscalReceiptSchema)
export default FiscalReceipt
