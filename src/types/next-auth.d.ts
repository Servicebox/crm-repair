import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      companyId: string
      dbName: string
      subscriptionStatus?: string
      pastDueUntil?: Date
      isPlatformOwner?: boolean
      permissions?: Record<string, boolean>
    }
  }
  interface User {
    role?: string
    companyId?: string
    dbName?: string
    subscriptionStatus?: string
    pastDueUntil?: Date
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    companyId?: string
    dbName?: string
    subscriptionStatus?: string
    role?: string
  }
}
