import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { getTenantConnection, getDefaultDbName } from '@/lib/tenantDb'
import { getModels } from '@/lib/models'
import Company from '@/models/Company'
import mongoose from 'mongoose'

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session }
}

export async function requireRole(roles: string[]) {
  const { session, error } = await requireAuth()
  if (error) return { error }
  if (!roles.includes(session!.user.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session }
}

export async function requireTenantAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  // role and dbName are populated by auth.ts session callback (fresh DB load).
  // If role is empty the user account was deactivated after their last login.
  if (!session.user.role) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  // Свежая проверка статуса подписки из БД (не JWT-кэш)
  if (session.user.companyId) {
    const company = await Company.findById(session.user.companyId)
      .select('subscriptionStatus pastDueUntil')
      .lean() as { subscriptionStatus?: string; pastDueUntil?: Date } | null

    const status = company?.subscriptionStatus
    if (status === 'blocked') {
      return { error: NextResponse.json({ error: 'SUBSCRIPTION_BLOCKED' }, { status: 402 }) }
    }
  }
  const dbName = session.user.dbName || getDefaultDbName()
  const db = await getTenantConnection(dbName)
  const models = getModels(db)
  return { session, db, models }
}

export async function requireTenantRole(roles: string[]) {
  const result = await requireTenantAuth()
  if (result.error) return result
  if (!roles.includes(result.session!.user.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return result
}

export async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (session.user.role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}
