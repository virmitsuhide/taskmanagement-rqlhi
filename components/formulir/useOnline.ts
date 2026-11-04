'use client'

import { useSyncExternalStore } from 'react'

function langgan(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/**
 * Status koneksi perangkat. Di server selalu dianggap online — halaman
 * dirender tanpa peringatan, lalu browser yang memutuskan.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(langgan, () => navigator.onLine, () => true)
}
