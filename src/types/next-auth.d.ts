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
    // role, companyId, dbName are intentionally absent — they are loaded
    // fresh from DB in the auth.ts session callback, never from the token.
  }
}
