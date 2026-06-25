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
    // Keep the jwt and authorized callbacks from authConfig unchanged.
    // Override only `session` to load role / companyId / dbName fresh from DB
    // on every session reconstruction instead of reading stale values from the token.
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (!token?.id || !session.user) return session

      session.user.id = token.id as string

      await connectToDatabase()

      const dbUser = await User.findById(token.id)
        .select('role companyId isActive')
        .lean() as { role?: string; companyId?: { toString(): string }; isActive?: boolean } | null

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
        const fallbackCompany = await Company.findOne().select('_id dbName').lean() as { _id: { toString(): string }; dbName?: string } | null
        if (fallbackCompany) {
          session.user.companyId = fallbackCompany._id.toString()
          session.user.dbName = fallbackCompany.dbName ?? getDefaultDbName()
        }
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

        // Resolve companyId and dbName
        let companyId = user.companyId?.toString() ?? ''
        let dbName = getDefaultDbName()

        if (user.companyId) {
          const company = await Company.findById(user.companyId).select('dbName slug isActive').lean() as { dbName?: string; slug?: string; _id?: unknown; isActive?: boolean } | null
          if (!company) return null
          // Block login if the organization is deactivated by platform admin
          if (company.isActive === false) return null
          if (company?.dbName) dbName = company.dbName
          if (!companyId) companyId = company?._id?.toString() ?? ''
        } else {
          // Legacy user — assign to the singleton company
          const company = await Company.findOne().select('_id dbName').lean()
          if (company) {
            companyId = company._id.toString()
            if (company.dbName) dbName = company.dbName
          }
        }

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
