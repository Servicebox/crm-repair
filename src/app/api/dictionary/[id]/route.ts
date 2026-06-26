import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantAuth, ok, err } from '@/lib/api-helpers'

const UpdateSchema = z.object({
  value: z.string().min(1).max(200).optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Dictionary } } = auth

  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return err('Некорректные данные', 400)

  const item = await Dictionary.findByIdAndUpdate(
    params.id,
    { $set: parsed.data },
    { new: true }
  )
  if (!item) return err('Не найдено', 404)

  return ok(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantAuth()
  if (auth.error) return auth.error
  const { models: { Dictionary } } = auth

  const item = await Dictionary.findByIdAndDelete(params.id)
  if (!item) return err('Не найдено', 404)

  return ok({ deleted: true })
}
