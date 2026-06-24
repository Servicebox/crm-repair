import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IProduct extends Document {
  name: string
  sku?: string
  barcode?: string
  category?: string
  description?: string
  productType: 'part' | 'product'
  condition?: 'new' | 'used'
  location?: string
  serialTracking: boolean
  quantity: number
  minQuantity: number
  cost: number
  price: number
  supplier?: string
  locationId?: mongoose.Types.ObjectId
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    sku: { type: String, unique: true, sparse: true, set: (v: string) => v === '' ? undefined : v },
    barcode: { type: String, unique: true, sparse: true, set: (v: string) => v === '' ? undefined : v },
    category: String,
    description: String,
    productType: { type: String, enum: ['part', 'product'], default: 'part' },
    condition: { type: String, enum: ['new', 'used'], default: 'new' },
    location: String,
    serialTracking: { type: Boolean, default: false },
    quantity: { type: Number, required: true, default: 0 },
    minQuantity: { type: Number, default: 1 },
    cost: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    supplier: String,
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

ProductSchema.index({ name: 'text', sku: 'text', barcode: 'text', category: 'text' })

const Product: Model<IProduct> =
  mongoose.models.Product ?? mongoose.model<IProduct>('Product', ProductSchema)
export default Product
