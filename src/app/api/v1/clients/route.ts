import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, apiUnauthorized } from '@/lib/apiAuth'
import { connectToDatabase } from '@/lib/mongodb'
import Client from '@/models/Client'

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return apiUnauthorized()

  await connectToDatabase()

  const body = await request.json() as {
    name?: string
    phone?: string
    email?: string
    deviceType?: string
    issue?: string
  }
  const { name, phone, email } = body

  if (!name && !phone) {
    return NextResponse.json({ success: false, error: 'name or phone required' }, { status: 400 })
  }

  let client = phone ? await Client.findOne({ phone }) : null
  if (!client) {
    client = await Client.create({ name, phone, email, source: 'website' })
  }

  return NextResponse.json(
    { success: true, data: { clientId: client._id } },
    { status: 201 }
  )
}
