import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ChatMessage from '@/models/ChatMessage'
import mongoose from 'mongoose'

const Schema = z.object({
  room: z.string().max(100),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { room } = Schema.parse(body)

    await connectToDatabase()

    const userId = new mongoose.Types.ObjectId(session.user.id)

    // Mark all messages in the room (not sent by current user) as read
    await ChatMessage.updateMany(
      { roomId: room, userId: { $ne: userId }, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
