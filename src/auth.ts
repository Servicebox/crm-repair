import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/auth.config'
import { connectToDatabase } from '@/lib/mongodb'
import { getDefaultDbName } from '@/lib/tenantDb'
import User from '@/models/User'
import Company from '@/models/Company'

class EmailNotVerifiedError extends CredentialsSignin {
  code = 'EMAIL_NOT_VERIFIED'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (!token?.id || !session.user) return session

      session.user.id = token.id as string

      // Apply JWT-cached values immediately as fallback.
      // If the DB lookup below succeeds, these will be overwritten with fresh data.
      // If it fails, the user still gets a working session from their last login.
      if (token.companyId !== undefined) session.user.companyId = token.companyId as string
      if (token.dbName) session.user.dbName = token.dbName as string

      try {
        await connectToDatabase()

        const dbUser = await User.findById(token.id)
          .select('role companyId isActive')
          .lean() as { role?: string; companyId?: { toString(): string }; isActive?: boolean } | null

        // Deactivated user: return minimal session — role will be empty,
        // requireTenantAuth() will return 401 on the next request.
        if (!dbUser?.isActive) return session

        session.user.role = dbUser.role ?? ''

        const rawCompanyId = dbUser.companyId?.toString() ?? ''
        if (rawCompanyId) {
          session.user.companyId = rawCompanyId
          const company = await Company.findById(rawCompanyId)
            .select('dbName')
            .lean() as { dbName?: string } | null
          session.user.dbName = company?.dbName ?? getDefaultDbName()
        } else {
          // Super-admin / platform owner — no company assignment.
          // Use the main platform DB; do NOT pick a random tenant.
          session.user.companyId = ''
          session.user.dbName = getDefaultDbName()
        }
      } catch {
        // Never let the session callback throw — Auth.js v5 wraps uncaught errors
        // in callbacks as CredentialsSignin, which masks the real cause and blocks
        // all auth() calls in Route Handlers. JWT-cached values remain active.
      }

      return session
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        await connectToDatabase()

        const user = await User.findOne({ email: credentials.email, isActive: true })
        if (!user) return null

        const isValid = await user.comparePassword(credentials.password as string)
        if (!isValid) return null

        if (!user.isEmailVerified) {
          throw new EmailNotVerifiedError()
        }

        let companyId = user.companyId?.toString() ?? ''
        let dbName = getDefaultDbName()

        if (user.companyId) {
          const company = await Company.findById(user.companyId)
            .select('dbName isActive')
            .lean() as { _id: { toString(): string }; dbName?: string; isActive?: boolean } | null
          if (!company) return null
          if (company.isActive === false) return null
          if (company.dbName) dbName = company.dbName
          if (!companyId) companyId = company._id.toString()
        }
        // Super-admin without companyId: companyId stays '', dbName stays default.
        // No random Company.findOne() — that would bind them to a specific tenant.

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.avatar,
          companyId,
          dbName,
        }
      },
    }),
  ],
})
