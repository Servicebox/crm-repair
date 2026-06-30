import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import Providers from '@/components/Providers'
import FloatingChat from '@/components/layout/FloatingChat'
import { SubscriptionBlockedScreen } from '@/components/subscription/SubscriptionBlockedScreen'
import { connectToDatabase } from '@/lib/mongodb'
import Company from '@/models/Company'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  // Check subscription status directly from DB (not JWT cache which may lag)
  let isBlocked = false
  let companyName: string | undefined
  if (session.user?.companyId) {
    await connectToDatabase()
    const company = await Company.findById(session.user.companyId)
      .select('subscriptionStatus name')
      .lean() as { subscriptionStatus?: string; name?: string } | null
    isBlocked = company?.subscriptionStatus === 'blocked'
    companyName = company?.name
  }

  if (isBlocked) {
    return (
      <Providers session={session}>
        <SubscriptionBlockedScreen companyName={companyName} />
      </Providers>
    )
  }

  return (
    <Providers session={session}>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            {children}
          </main>
        </div>
      </div>
      <FloatingChat />
    </Providers>
  )
}
