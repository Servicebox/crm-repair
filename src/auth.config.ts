import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const PUBLIC_PATHS = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password']
      const PUBLIC_API = ['/api/auth', '/api/tracking', '/api/v1']

      const isPublicPath = PUBLIC_PATHS.some(p => nextUrl.pathname.startsWith(p))
      const isPublicApi = PUBLIC_API.some(p => nextUrl.pathname.startsWith(p))

      if (isPublicPath || isPublicApi) return true
      if (isLoggedIn) return true
      return false
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  providers: [],
}
