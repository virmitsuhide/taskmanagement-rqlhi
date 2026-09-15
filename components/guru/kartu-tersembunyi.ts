'use client'

import { useMemo, useSyncExternalStore } from 'react'

/**
 * Kartu beranda guru yang sudah ditutup (tombol ✕).
 *
 * Disimpan di peramban (localStorage), bukan database: menutup kartu hanyalah
 * merapikan beranda, tidak mengubah pengumuman atau pengajuan apa pun.
 * Akibatnya kartu yang ditutup di HP tetap tampil di laptop — harga yang wajar
 * untuk sesuatu yang tidak menghapus data.
 *
 * `ruang` memisahkan jenis kartu ('pengumuman', 'progres-ujian') supaya id
 * dari tabel berbeda tidak saling menutup.
 */

const PERISTIWA = 'kartu-beranda-tersembunyi'
const BATAS = 200

const kunciPenyimpanan = (ruang: string, teacherId: string) => `kartu-tersembunyi:${ruang}:${teacherId}`

function bacaMentah(ruang: string, teacherId: string): string {
  try {
    return localStorage.getItem(kunciPenyimpanan(ruang, teacherId)) ?? '[]'
  } catch {
    return '[]'
  }
}

function bacaDaftar(ruang: string, teacherId: string): string[] {
  try {
    const hasil = JSON.parse(bacaMentah(ruang, teacherId))
    return Array.isArray(hasil) ? hasil : []
  } catch {
    return []
  }
}

function tulis(ruang: string, teacherId: string, daftar: string[]) {
  try {
    // Dibatasi supaya kunci lama yang sudah tidak pernah tampil tidak menumpuk.
    localStorage.setItem(kunciPenyimpanan(ruang, teacherId), JSON.stringify(daftar.slice(-BATAS)))
  } catch {
    // Mode privat / penyimpanan penuh: kartu cukup tidak tersembunyi.
  }
  window.dispatchEvent(new Event(PERISTIWA))
}

export function sembunyikanKartu(ruang: string, teacherId: string, kunci: string) {
  const daftar = bacaDaftar(ruang, teacherId)
  if (!daftar.includes(kunci)) tulis(ruang, teacherId, [...daftar, kunci])
}

function berlangganan(ubah: () => void) {
  window.addEventListener(PERISTIWA, ubah)
  window.addEventListener('storage', ubah)
  return () => {
    window.removeEventListener(PERISTIWA, ubah)
    window.removeEventListener('storage', ubah)
  }
}

/**
 * useSyncExternalStore, bukan useState + useEffect: render server tidak punya
 * localStorage, dan membaca lewat efek berarti setState beruntun setelah
 * render pertama. Snapshot berupa string supaya perbandingannya stabil.
 */
export function useKartuTersembunyi(ruang: string, teacherId: string): Set<string> {
  const mentah = useSyncExternalStore(berlangganan, () => bacaMentah(ruang, teacherId), () => '[]')
  return useMemo(() => {
    try {
      const hasil = JSON.parse(mentah)
      return new Set<string>(Array.isArray(hasil) ? hasil : [])
    } catch {
      return new Set<string>()
    }
  }, [mentah])
}
