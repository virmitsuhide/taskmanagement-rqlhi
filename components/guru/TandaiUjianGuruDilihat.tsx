'use client'

import { useEffect, useRef } from 'react'
import { tandaiNotifUjianGuruDilihatAction } from '@/app/actions/ujian'

/**
 * Memadamkan lencana ujian guru begitu layar yang menampilkan progresnya
 * benar-benar terbuka. Pola yang sama dengan TandaiPengumumanTerbaca: tidak
 * menulis saat render server, dan hanya sekali per pemuatan.
 */
export function TandaiUjianGuruDilihat({ aktif }: { aktif: boolean }) {
  const sudah = useRef(false)

  useEffect(() => {
    if (!aktif || sudah.current) return
    sudah.current = true
    void tandaiNotifUjianGuruDilihatAction()
  }, [aktif])

  return null
}
