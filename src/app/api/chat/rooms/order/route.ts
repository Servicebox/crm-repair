import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ChatRoom from '@/models/ChatRoom'
import mongoose from 'mongoose'

const Schema = z.object({
  orderId: z.string().length(24),
  orderNumber: z.string().max(50),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { orderId, orderNumber } = Schema.parse(body)

    await connectToDatabase()

    const slug = `order-${orderId}`
    const name = `Заказ ${orderNumber}`

    // Upsert: return existing room or create new one
    const room = await ChatRoom.findOneAndUpdate(
      { slug },
      {
        $setOnInsert: {
          slug,
          name,
          scope: 'internal',
          participants: [],
          orderId: new mongoose.Types.ObjectId(orderId),
          orderNumber,
          createdBy: new mongoose.Types.ObjectId(session.user.id),
        },
      },
      { upsert: true, new: true }
    )

    return NextResponse.json({ success: true, data: { slug: room.slug, name: room.name } })
  } catch {
    return NextResponse.json({ success: false, error: 'Ошибка' }, { status: 400 })
  }
}
