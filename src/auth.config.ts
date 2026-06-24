import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const PUBLIC_PATHS = ['/login', '/register', '/register-org', '/verify-email', '/forgot-password', '/reset-password']
      const PUBLIC_API = ['/api/auth', '/api/tracking', '/api/v1', '/api/orgs/register']

      const isPublicPath = PUBLIC_PATHS.some(p => nextUrl.pathname.startsWith(p))
      const isPublicApi = PUBLIC_API.some(p => nextUrl.pathname.startsWith(p))

      if (isPublicPath || isPublicApi) return true
      if (isLoggedIn) return true
      return false
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.companyId = user.companyId
        token.dbName = user.dbName
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        if (token.id) session.user.id = token.id as string
        if (token.role) session.user.role = token.role as string
        if (token.companyId) session.user.companyId = token.companyId as string
        if (token.dbName) session.user.dbName = token.dbName as string
      }
      return session
    },
  },
  providers: [],
}
