'use client'

import { useCallback } from 'react'
import { logoutAction } from '@/app/actions/auth'

export function useAuth() {
  const logout = useCallback(async () => {
    await logoutAction()
  }, [])

  return { logout }
}
