'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { sembunyikanKartuAction } from '@/app/actions/kartu-beranda'

/**
 * Kartu beranda guru yang sudah ditutup (tombol ✕).
 *
 * Sumber utamanya tabel guru_kartu_tersembunyi (0075), supaya kartu yang
 * ditutup di HP tidak muncul lagi saat guru login di laptop. localStorage
 * tetap dipakai sebagai catatan seketika: kartunya hilang begitu ✕ ditekan,
 * tanpa menunggu server — dan tetap tertutup di perangkat itu seandainya
 * migrasinya belum dijalankan.
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
  void sembunyikanKartuAction(ruang, [kunci])
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
 *
 * `dariServer` sudah dipakai sejak render server, jadi kartu yang pernah
 * ditutup di perangkat lain tidak sempat berkedip muncul lalu hilang.
 */
export function useKartuTersembunyi(ruang: string, teacherId: string, dariServer: string[]): Set<string> {
  const mentah = useSyncExternalStore(berlangganan, () => bacaMentah(ruang, teacherId), () => '[]')
  const kunciServer = dariServer.join('|')

  // Kartu yang ditutup sebelum pencatatan pindah ke server hanya ada di
  // localStorage perangkat ini. Setor sekali supaya ikut tertutup di
  // perangkat lain.
  useEffect(() => {
    const diServer = new Set(kunciServer ? kunciServer.split('|') : [])
    const kurang = bacaDaftar(ruang, teacherId).filter(k => !diServer.has(k))
    if (kurang.length > 0) void sembunyikanKartuAction(ruang, kurang)
  }, [ruang, teacherId, kunciServer])

  return useMemo(() => {
    const hasil = new Set<string>(kunciServer ? kunciServer.split('|') : [])
    try {
      const lokal = JSON.parse(mentah)
      if (Array.isArray(lokal)) for (const k of lokal) hasil.add(k)
    } catch {
      // Catatan lokal rusak: cukup pakai yang dari server.
    }
    return hasil
  }, [mentah, kunciServer])
}
