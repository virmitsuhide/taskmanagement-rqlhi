'use client'

import { useEffect } from 'react'
import { markUjianSeenAction } from '@/app/actions/ujian'

/**
 * Komponen tak kasat mata: menandai antrian sudah dilihat begitu halaman
 * kelola terbuka, sehingga badge "pengajuan baru" di dashboard kembali nol.
 *
 * Dijalankan dari klien, bukan langsung di server component, supaya render
 * halaman tidak menulis ke database — render bisa terjadi berkali-kali
 * (prefetch, percobaan ulang) tanpa pengurusnya benar-benar membuka apa pun.
 */
export function TandaiUjianDilihat() {
  useEffect(() => {
    void markUjianSeenAction()
  }, [])
  return null
}
