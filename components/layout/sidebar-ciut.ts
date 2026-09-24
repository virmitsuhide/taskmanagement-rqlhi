'use client'

import { useState } from 'react'
import { COOKIE_SIDEBAR_CIUT } from './sidebar-ciut-cookie'

/**
 * Sidebar yang bisa diciutkan menjadi deretan ikon — dipakai sidebar pengurus
 * dan Portal Guru.
 *
 * Pilihannya disimpan di cookie, bukan localStorage: kerangka halaman dirender
 * di server, dan hanya cookie yang terbaca di sana. Dengan localStorage,
 * sidebar selalu tergambar lebar dulu lalu melompat ciut sesudah hidrasi.
 * Satu cookie untuk kedua portal — ini selera orang terhadap layarnya, bukan
 * terhadap portalnya.
 */
export function useSidebarCiut(awal: boolean): [boolean, () => void] {
  const [ciut, setCiut] = useState(awal)
  const ganti = () => {
    const baru = !ciut
    setCiut(baru)
    document.cookie = `${COOKIE_SIDEBAR_CIUT}=${baru ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  }
  return [ciut, ganti]
}

/*
 * Kelas bersama. Keduanya bergantung pada `group/sb` + data-ciut di <aside>,
 * jadi laci mobile — yang memakai isi navigasi yang sama tanpa pembungkus
 * itu — tetap menampilkan nama menu lengkap.
 */

/** Teks yang hilang saat ciut (tetap terbaca pembaca layar). */
export const SEMBUNYI_SAAT_CIUT = 'group-data-[ciut=true]/sb:sr-only'
/** Hiasan yang hilang sama sekali saat ciut. */
export const HILANG_SAAT_CIUT = 'group-data-[ciut=true]/sb:hidden'
/** Tautan menu: ikonnya ke tengah saat ciut. */
export const TAUTAN_CIUT = 'relative group-data-[ciut=true]/sb:justify-center group-data-[ciut=true]/sb:px-0'
/** Lencana angka: menempel di pojok ikon saat ciut. */
export const LENCANA_CIUT =
  'group-data-[ciut=true]/sb:absolute group-data-[ciut=true]/sb:right-1 group-data-[ciut=true]/sb:top-0.5 group-data-[ciut=true]/sb:ml-0'
