import { NextRequest } from 'next/server'
import { z } from 'zod'
import { connectToDatabase } from '@/lib/mongodb'
import { requireTenantRole, ok, err } from '@/lib/api-helpers'
import Company from '@/models/Company'

const BaseTemplateSchema = z.object({
  showLogo: z.boolean().default(true),
  showRequisites: z.boolean().default(true),
  headerNote: z.string().default(''),
  footerText: z.string().default(''),
  legalText: z.string().default(''),
  showQr: z.boolean().default(true),
  showTearOff: z.boolean().default(true),
})

const DocumentTemplatesSchema = z.object({
  receipt: BaseTemplateSchema.optional(),
  acceptance: BaseTemplateSchema.optional(),
  worksAct: BaseTemplateSchema.extend({
    showParts: z.boolean().default(true),
    warrantyText: z.string().default(''),
    signatureNote: z.string().default(''),
  }).optional(),
})

export async function GET() {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  await connectToDatabase()
  const company = await Company.findOne({ dbName: auth.session!.user.dbName }).lean() as Record<string, unknown> | null

  return ok((company?.documentTemplates as unknown) ?? null)
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantRole(['owner', 'admin'])
  if (auth.error) return auth.error

  try {
    const body = await req.json()
    const data = DocumentTemplatesSchema.parse(body)

    await connectToDatabase()
    await Company.findOneAndUpdate(
      { dbName: auth.session!.user.dbName },
      { $set: { documentTemplates: data } },
      { upsert: true },
    )

    return ok(data)
  } catch (error) {
    if (error instanceof z.ZodError) return err(error.errors[0].message)
    return err('Ошибка сохранения шаблонов', 500)
  }
}
