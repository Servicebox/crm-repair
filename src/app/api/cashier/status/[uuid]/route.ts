import { NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { requireAuth, ok, err } from '@/lib/api-helpers'
import FiscalReceipt from '@/models/FiscalReceipt'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const authResult = await requireAuth()
  if (authResult.error) return authResult.error

  const { uuid } = await params

  if (!uuid) return err('UUID не указан')

  await connectToDatabase()

  const receipt = await FiscalReceipt.findOne({
    $or: [{ uuid }, { receiptId: uuid }],
  }).lean()

  if (!receipt) return err('Чек не найден', 404)

  return ok({
    status: receipt.status,
    receiptId: receipt.receiptId,
    uuid: receipt.uuid,
    provider: receipt.provider,
    total: receipt.total,
    paymentMethod: receipt.paymentMethod,
    errorMessage: receipt.errorMessage,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  })
}
