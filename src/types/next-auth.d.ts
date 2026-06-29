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
    // companyId / dbName / subscriptionStatus are cached in the token as a fallback
    // for when the DB lookup in the session callback fails (connection busy, cold start).
    // role is intentionally NOT cached here — stale role = privilege escalation risk.
    companyId?: string
    dbName?: string
    subscriptionStatus?: string
  }
}
