import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/auth.config'
import { connectToDatabase } from '@/lib/mongodb'
import { getTenantConnection, getDefaultDbName } from '@/lib/tenantDb'
import User, { getUserModel } from '@/models/User'
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
      if (token.companyId !== undefined) session.user.companyId = token.companyId as string
      if (token.dbName) session.user.dbName = token.dbName as string
      if (token.subscriptionStatus) session.user.subscriptionStatus = token.subscriptionStatus as string

      try {
        await connectToDatabase()

        // Use cached dbName to find user in the correct tenant DB.
        const cachedDbName = (token.dbName as string) || getDefaultDbName()
        let userModel = User
        if (cachedDbName !== getDefaultDbName()) {
          const tenantConn = await getTenantConnection(cachedDbName)
          userModel = getUserModel(tenantConn)
        }

        const dbUser = await userModel.findById(token.id)
          .select('role companyId isActive')
          .lean() as { role?: string; companyId?: { toString(): string }; isActive?: boolean } | null

        if (!dbUser?.isActive) return session

        session.user.role = dbUser.role ?? ''
        session.user.isPlatformOwner = (token.email as string | undefined) === process.env.PLATFORM_OWNER_EMAIL && !!process.env.PLATFORM_OWNER_EMAIL

        const rawCompanyId = dbUser.companyId?.toString() ?? ''
        if (rawCompanyId) {
          session.user.companyId = rawCompanyId
          const company = await Company.findById(rawCompanyId)
            .select('dbName subscriptionStatus pastDueUntil')
            .lean() as { dbName?: string; subscriptionStatus?: string; pastDueUntil?: Date } | null
          session.user.dbName = company?.dbName ?? getDefaultDbName()
          session.user.subscriptionStatus = company?.subscriptionStatus ?? 'trial'
          if (company?.pastDueUntil) {
            session.user.pastDueUntil = company.pastDueUntil
          }
        } else {
          // Super-admin / platform owner — no company assignment.
          session.user.companyId = ''
          session.user.dbName = getDefaultDbName()
        }
      } catch {
        // Never let the session callback throw — JWT-cached values remain active.
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

        // Search in default DB first (covers owners and platform admins).
        let user = await User.findOne({ email: credentials.email, isActive: true })
        let userDbName = getDefaultDbName()

        // If not found in default DB, search across all tenant databases.
        if (!user) {
          const companies = await Company.find(
            { dbName: { $exists: true, $ne: getDefaultDbName() } },
            { dbName: 1 }
          ).lean() as { dbName?: string }[]

          const distinctDbNames = [...new Set(
            companies.map(c => c.dbName).filter((n): n is string => !!n)
          )]

          for (const dbName of distinctDbNames) {
            const conn = await getTenantConnection(dbName)
            const TenantUser = getUserModel(conn)
            const found = await TenantUser.findOne({ email: credentials.email, isActive: true })
            if (found) {
              user = found
              userDbName = dbName
              break
            }
          }
        }

        if (!user) return null

        const isValid = await user.comparePassword(credentials.password as string)
        if (!isValid) return null

        if (!user.isEmailVerified) {
          throw new EmailNotVerifiedError()
        }

        let companyId = user.companyId?.toString() ?? ''
        let dbName = userDbName

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
