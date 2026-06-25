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
    }
  }
  interface User {
    role?: string
    companyId?: string
    dbName?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    // companyId / dbName are cached in the token as a fallback for when the
    // DB lookup in the session callback fails (connection busy, cold start).
    // role is intentionally NOT cached here — stale role = privilege escalation risk.
    companyId?: string
    dbName?: string
  }
}
