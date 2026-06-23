import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import FiscalReceipt from '@/models/FiscalReceipt'
import { IFiscalReceiptItem } from '@/models/FiscalReceipt'

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const body = await request.json() as {
    orderId?: string
    items?: IFiscalReceiptItem[]
    paymentMethod: 'cash' | 'card' | 'qr'
    total: number
    clientEmail?: string
  }
  const { orderId, items, paymentMethod, total } = body

  if (!paymentMethod || total == null) {
    return NextResponse.json(
      { success: false, error: 'paymentMethod and total are required' },
      { status: 400 }
    )
  }

  const receipt = await FiscalReceipt.create({
    orderId: orderId ?? undefined,
    type: 'sale',
    items: items ?? [],
    total,
    paymentMethod,
    status: 'pending',
  })

  // Demo mode — mark as registered immediately
  receipt.status = 'registered'
  receipt.receiptId = `DEMO-${Date.now()}`
  await receipt.save()

  return NextResponse.json({
    success: true,
    data: {
      receiptId: receipt.receiptId,
      receiptUrl: null,
      message: 'Чек зарегистрирован (демо-режим)',
    },
  })
}
