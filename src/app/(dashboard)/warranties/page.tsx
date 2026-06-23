'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function WarrantiesPage() {
  const { data } = useQuery({
    queryKey: ['warranties'],
    queryFn: async () => {
      const res = await fetch('/api/orders?status=issued&limit=100')
      const json = await res.json()
      return json.data?.orders ?? []
    },
  })

  const orders = (data ?? []).filter((o: { warrantyExpires?: string }) => o.warrantyExpires)
  const now = new Date()
  const active = orders.filter((o: { warrantyExpires: string }) => new Date(o.warrantyExpires) > now)
  const expired = orders.filter((o: { warrantyExpires: string }) => new Date(o.warrantyExpires) <= now)
  const soonExpiring = active.filter((o: { warrantyExpires: string }) => new Date(o.warrantyExpires).getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold">Гарантии</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-green-700">{active.length}</div>
          <div className="text-sm text-green-600">Активных гарантий</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-orange-600">{soonExpiring.length}</div>
          <div className="text-sm text-orange-600">Истекают через 7 дней</div>
        </div>
        <div className="bg-slate-50 border rounded-xl p-4 text-center">
          <Shield className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-slate-600">{expired.length}</div>
          <div className="text-sm text-slate-500">Истекших гарантий</div>
        </div>
      </div>

      {soonExpiring.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-orange-700 mb-3">Истекают в ближайшие 7 дней</h3>
          <div className="space-y-2">
            {soonExpiring.map((o: { _id: string; number: string; clientName: string; deviceType: string; deviceModel?: string; warrantyExpires: string }) => (
              <Link key={o._id} href={`/orders/${o._id}`} className="flex items-center justify-between hover:bg-orange-100 rounded-lg p-2 transition">
                <div>
                  <span className="font-mono text-sm font-medium text-blue-600">{o.number}</span>
                  <span className="ml-2 text-sm">{o.clientName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{o.deviceType} {o.deviceModel}</span>
                </div>
                <span className="text-sm font-medium text-orange-700">{formatDate(o.warrantyExpires)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b font-semibold">Все активные гарантии ({active.length})</div>
        {active.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Нет активных гарантий</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Заказ</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Клиент</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Устройство</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Истекает</th>
                </tr>
              </thead>
              <tbody>
                {active.map((o: { _id: string; number: string; clientName: string; deviceType: string; deviceModel?: string; warrantyExpires: string }) => (
                  <tr key={o._id} className="border-b hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o._id}`} className="font-mono text-blue-600 hover:underline">{o.number}</Link>
                    </td>
                    <td className="px-4 py-3">{o.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.deviceType} {o.deviceModel}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${new Date(o.warrantyExpires).getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000 ? 'text-orange-600' : 'text-green-600'}`}>
                        {formatDate(o.warrantyExpires)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
