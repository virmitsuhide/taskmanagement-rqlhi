import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@/types'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined
        const password = credentials?.password as string | undefined
        if (!username || !password) return null

        const user = await db.query.users.findFirst({
          where: eq(users.username, username),
        })
        if (!user) return null

        const valid = await bcrypt.compare(password, user.password_hash)
        if (!valid) return null

        return {
          id: user.id,
          username: user.username,
          role: user.role as UserRole,
          displayName: user.display_name,
          canChangePassword: user.can_change_password ?? true,
        }
      },
    }),
  ],
  callbacks: {
    authorized({ auth: session }) {
      return !!session
    },
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id!
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any
        token.username = u.username
        token.role = u.role
        token.displayName = u.displayName
        token.canChangePassword = u.canChangePassword
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.userId as string
      session.user.username = token.username as string
      session.user.role = token.role as UserRole
      session.user.displayName = token.displayName as string
      session.user.canChangePassword = token.canChangePassword as boolean
      return session
    },
  },
})
