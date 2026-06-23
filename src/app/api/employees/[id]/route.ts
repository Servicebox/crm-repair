import { NextRequest } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { connectToDatabase } from '@/lib/mongodb'
import { requireRole, ok, err } from '@/lib/api-helpers'
import User from '@/models/User'

const UpdateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['owner', 'admin', 'manager', 'master']).optional(),
  isActive: z.boolean().optional(),
  locationId: z.string().optional(),
  avatar: z.string().optional(),
  salary: z.object({
    type: z.enum(['percent_revenue', 'percent_profit', 'fixed', 'rate_per_order']),
    value: z.number(),
    salesPercent: z.number().optional(),
    guaranteed: z.number().optional(),
  }).optional(),
  permissions: z.object({
    canViewAllOrders: z.boolean().optional(),
    canCreateOrders: z.boolean().optional(),
    canEditOrders: z.boolean().optional(),
    canDeleteOrders: z.boolean().optional(),
    canChangeStatus: z.boolean().optional(),
    canViewClients: z.boolean().optional(),
    canEditClients: z.boolean().optional(),
    canViewFinance: z.boolean().optional(),
    canManageCashRegister: z.boolean().optional(),
    canViewWarehouse: z.boolean().optional(),
    canManageWarehouse: z.boolean().optional(),
    canViewEmployees: z.boolean().optional(),
    canManageEmployees: z.boolean().optional(),
    canViewReports: z.boolean().optional(),
    canViewTelemetry: z.boolean().optional(),
    canManageSettings: z.boolean().optional(),
    canAccessSales: z.boolean().optional(),
  }).optional(),
})

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  try {
    await connectToDatabase()
    const body = await req.json()
    const data = UpdateEmployeeSchema.parse(body)
    const user = await User.findByIdAndUpdate(
      params.id,
      { $set: data },
      { new: true }
    ).select('-password -emailVerificationToken -passwordResetToken')
    if (!user) return err('Сотрудник не найден', 404)
    return ok(user)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка обновления сотрудника', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if (auth.error) return auth.error

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  await connectToDatabase()
  await User.findByIdAndUpdate(params.id, { isActive: false })
  return ok({ deleted: true })
}
