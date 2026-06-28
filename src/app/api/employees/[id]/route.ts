import { NextRequest } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'

const SalaryRuleSchema = z.object({
  id: z.string(),
  source: z.enum(['services_all', 'services_category', 'parts_all', 'order_intake', 'shift', 'hourly']),
  categories: z.array(z.string()).optional(),
  method: z.enum(['percent_revenue', 'percent_profit', 'fixed']),
  value: z.number().min(0),
  enabled: z.boolean(),
})

const SalarySchema = z.union([
  z.object({
    guaranteed: z.number().min(0),
    rules: z.array(SalaryRuleSchema).min(1),
  }),
  z.object({
    type: z.enum(['percent_revenue', 'percent_profit', 'fixed', 'rate_per_order', 'hourly']),
    value: z.number(),
    hourlyRate: z.number().optional(),
    overtimeMultiplier: z.number().optional(),
    salesPercent: z.number().optional(),
    guaranteed: z.number().optional(),
  }),
])

const UpdateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['owner', 'admin', 'manager', 'master']).optional(),
  isActive: z.boolean().optional(),
  locationId: z.string().optional(),
  avatar: z.string().optional(),
  salary: SalarySchema.optional(),
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
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { User } } = auth

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  try {
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
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error
  const { models: { User } } = auth

  if (!isValidObjectId(params.id)) return err('Неверный ID', 400)

  try {
    const deleted = await User.findByIdAndDelete(params.id)
    if (!deleted) return err('Сотрудник не найден', 404)
    return ok({ deleted: true })
  } catch {
    return err('Ошибка удаления сотрудника', 500)
  }
}
