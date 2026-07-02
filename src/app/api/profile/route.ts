import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import User, { getUserModel } from '@/models/User'
import { getTenantConnection, getDefaultDbName } from '@/lib/tenantDb'

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}

async function getUserModel_(session: { user: { id: string; dbName?: string } }) {
  const dbName = session.user.dbName ?? getDefaultDbName()
  if (dbName !== getDefaultDbName()) {
    const conn = await getTenantConnection(dbName)
    return getUserModel(conn)
  }
  return User
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()

  await connectToDatabase()
  const userModel = await getUserModel_(session as { user: { id: string; dbName?: string } })
  const user = await userModel.findById(session.user.id)
    .select('name email phone position avatar')
    .lean() as { name?: string; email?: string; phone?: string; position?: string; avatar?: string } | null

  if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  return NextResponse.json({ success: true, data: user })
}

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional(),
  position: z.string().max(200).optional(),
  avatar: z.string().url().max(500).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return unauthorized()

  await connectToDatabase()

  try {
    const body = await req.json()
    const data = PatchSchema.parse(body)

    const userModel = await getUserModel_(session as { user: { id: string; dbName?: string } })
    await userModel.findByIdAndUpdate(session.user.id, { $set: data })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Ошибка сохранения' }, { status: 500 })
  }
}
