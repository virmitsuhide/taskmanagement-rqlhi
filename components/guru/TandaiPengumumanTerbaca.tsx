'use client'

import { useEffect, useRef } from 'react'
import { tandaiPengumumanTerbacaAction } from '@/app/actions/pengumuman-guru'

/**
 * Menandai pengumuman terbaca begitu berandanya benar-benar tampil.
 *
 * Tidak dilakukan saat merender di server: menulis ke database sebagai efek
 * samping render membuat halaman yang sama berperilaku berbeda tiap kali
 * dipanggil — termasuk saat Next memuatnya di muka atau mengulangnya. Di sini
 * pemicunya jelas: layar guru sudah menampilkannya.
 *
 * `sudah` menjaga agar hanya sekali per pemuatan, sebab efek bisa berjalan dua
 * kali di mode pengembangan.
 */
export function TandaiPengumumanTerbaca({ aktif }: { aktif: boolean }) {
  const sudah = useRef(false)

  useEffect(() => {
    if (!aktif || sudah.current) return
    sudah.current = true
    void tandaiPengumumanTerbacaAction()
  }, [aktif])

  return null
}
