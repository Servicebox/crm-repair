import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, apiUnauthorized } from '@/lib/apiAuth'
import { connectToDatabase } from '@/lib/mongodb'
import Product from '@/models/Product'
import { IProduct } from '@/models/Product'

function escapeXml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
    return map[c] ?? c
  })
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return apiUnauthorized()

  await connectToDatabase()

  const products = await Product.find({}, '-__v').lean()
  const format = request.nextUrl.searchParams.get('format')

  if (format === 'xml') {
    const rows = (products as unknown as IProduct[])
      .map(
        (p) =>
          `<product><id>${escapeXml(p._id)}</id><name>${escapeXml(p.name)}</name>` +
          `<sku>${escapeXml(p.sku)}</sku><quantity>${p.quantity}</quantity>` +
          `<price>${p.price}</price><cost>${p.cost}</cost></product>`
      )
      .join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?><products>${rows}</products>`
    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
  }

  return NextResponse.json({
    success: true,
    data: products,
    exportedAt: new Date().toISOString(),
  })
}
