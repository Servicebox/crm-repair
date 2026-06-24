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
    role?: string
    id?: string
    companyId?: string
    dbName?: string
  }
}
