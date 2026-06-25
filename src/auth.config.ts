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
        // Cache companyId + dbName in the JWT so the session callback can fall back
        // to these values if the DB lookup fails (cold start, connection busy).
        // role is intentionally NOT cached — stale role is a privilege-escalation risk.
        token.companyId = user.companyId ?? ''
        token.dbName = user.dbName ?? ''
      }
      return token
    },
    session({ session, token }) {
      // Minimal base: only map the stable user id.
      // role / companyId / dbName are populated by the session callback in auth.ts
      // which performs a fresh DB lookup on every session reconstruction.
      if (token?.id && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  providers: [],
}
