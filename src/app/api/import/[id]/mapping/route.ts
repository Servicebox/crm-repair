import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase } from '@/lib/mongodb'
import ImportJob from '@/models/ImportJob'
import mongoose from 'mongoose'
import { z } from 'zod'
import type { DuplicateStrategy } from '@/models/ImportJob'
import { validateMappingPath, ValidationError } from '@/lib/importSecurity'

const FieldMappingSchema = z.object({
  source_column: z.string(),
  target_field: z.string(),
  transformer: z.string().default('none'),
  default_value: z.unknown().optional(),
  is_required: z.boolean().default(false),
})

const MappingBodySchema = z.object({
  mapping: z.array(FieldMappingSchema).min(1),
  duplicate_strategy: z.enum(['skip', 'update', 'create', 'merge']).default('skip'),
  target_entity: z.enum(['clients', 'orders', 'products']).optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()

  const job = await ImportJob.findOne({
    _id: params.id,
    organization_id: new mongoose.Types.ObjectId(session.user.companyId),
  })

  if (!job) return NextResponse.json({ success: false, error: 'Не найден' }, { status: 404 })

  if (!['ready_for_mapping', 'importing'].includes(job.status) && job.status !== 'failed') {
    return NextResponse.json({ success: false, error: 'Неверный статус для изменения маппинга' }, { status: 409 })
  }

  try {
    const body = await req.json()
    const parsed = MappingBodySchema.parse(body)

    // Guard against MongoDB operator injection via target_field dot-paths
    for (const field of parsed.mapping) {
      if (field.target_field && field.target_field !== '__skip__') {
        validateMappingPath(field.target_field)
      }
    }

    await ImportJob.updateOne({ _id: job._id }, {
      $set: {
        mapping: parsed.mapping,
        duplicate_strategy: parsed.duplicate_strategy as DuplicateStrategy,
        ...(parsed.target_entity ? { target_entity: parsed.target_entity } : {}),
      },
    })

    return NextResponse.json({ success: true, data: { id: job._id.toString() } })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 400 }
      )
    }
    const msg = err instanceof Error ? err.message : 'Ошибка сохранения маппинга'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
