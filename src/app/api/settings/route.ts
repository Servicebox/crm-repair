import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireTenantAuth, requireTenantRole, ok, err } from '@/lib/api-helpers'
import Company from '@/models/Company'

const SettingsUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  website: z.string().optional(),
  inn: z.string().optional(),
  ogrn: z.string().optional(),
  logo: z.string().optional(),
  brandColor: z.string().optional(),
  orderPrefix: z.string().max(10).optional(),
  defaultWarrantyDays: z.number().int().min(0).optional(),
  defaultReadyDays: z.number().int().min(0).optional(),
  notificationTemplates: z.object({
    statusChange: z.string().optional(),
    ready: z.string().optional(),
    issued: z.string().optional(),
  }).optional(),
  receiptSettings: z.object({
    showLogo: z.boolean().optional(),
    showRequisites: z.boolean().optional(),
    footerText: z.string().optional(),
  }).optional(),
  checklistItems: z.array(z.object({
    id: z.string(),
    label: z.string(),
    order: z.number(),
  })).optional(),
  acceptanceFormFields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    visible: z.boolean(),
    required: z.boolean(),
  })).optional(),
  features: z.object({
    electronicSignature: z.boolean().optional(),
    clientReturn: z.boolean().optional(),
    vkIntegration: z.boolean().optional(),
    telegramBot: z.boolean().optional(),
  }).optional(),
  telegramBotToken: z.string().optional(),
  vkGroupId: z.string().optional(),
  vkAccessToken: z.string().optional(),
  reviewUrl: z.string().optional(),
})

export async function GET() {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error

  await connectToDatabase()
  // Try by dbName first; companies without a dedicated DB have no dbName field,
  // so fall back to companyId lookup for the main-account case.
  let company = await Company.findOne({ dbName: auth.session!.user.dbName }).lean()
  if (!company && auth.session!.user.companyId) {
    company = await Company.findById(auth.session!.user.companyId).lean()
  }
  if (!company) return err('Компания не найдена', 404)
  return ok(company)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  try {
    await connectToDatabase()
    const body = await req.json()
    const data = SettingsUpdateSchema.parse(body)
    const company = await Company.findOneAndUpdate({ dbName: auth.session!.user.dbName }, { $set: data }, { new: true, upsert: true })
    return ok(company)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка обновления настроек', 500)
  }
}
