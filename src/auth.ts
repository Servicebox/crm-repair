import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/auth.config'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'

class EmailNotVerifiedError extends CredentialsSignin {
  code = 'EMAIL_NOT_VERIFIED'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.avatar,
        }
      },
    }),
  ],
})
