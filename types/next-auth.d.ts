import type { UserRole } from '@/types'

declare module 'next-auth' {
  interface User {
    username: string
    role: UserRole
    displayName: string
    canChangePassword: boolean
  }
  interface Session {
    user: {
      id: string
      username: string
      role: UserRole
      displayName: string
      canChangePassword: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    username: string
    role: UserRole
    displayName: string
    canChangePassword: boolean
  }
}
