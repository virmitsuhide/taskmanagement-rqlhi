/**
 * Draf Pembaruan Sistem dari pesan commit (0128) — murni, tanpa basis data.
 *
 * Pesan commit ditulis untuk pengembang ("getPosisiUnit", "0127", "kisi").
 * Teks untuk pengguna ditulis terpisah di blok `Pembaruan:` dalam pesan yang
 * sama, berbahasa sederhana (setara anak SMP), di atas baris Co-Authored-By:
 *
 *   feat(siswa): urut menurut capaian resmi & unduh capaian Excel
 *
 *   - catatan teknis untuk pengembang …
 *
 *   Pembaruan: Daftar siswa bisa diurutkan menurut capaian
 *   Pembaca: pengurus, guru
 *   - Di halaman Siswa ada pilihan "Urutkan" …
 *   - Tombol "Unduh Excel" menyimpan daftar yang sedang tampil.
 *
 *   Co-Authored-By: …
 *
 * `Pembaruan: -` = perubahan internal, tidak perlu dikabarkan.
 * Commit feat/fix/perf TANPA blok tetap menjadi draf dengan judul dari
 * subjeknya dan isi kosong — Kepala RQ menulis isinya sebelum menerbitkan.
 * Jenis lain (ci, chore, refactor, docs, test, …) tanpa blok dilewati.
 */
import { URUTAN_PEMBACA, type JenisChangelog, type PembacaChangelog } from './changelog'

export interface DrafCommit {
  judul: string
  isi: string
  jenis: JenisChangelog
  untuk: PembacaChangelog[]
  /** false = belum ada versi sederhana; isi perlu ditulis Kepala RQ. */
  sederhana: boolean
}

const SUBJEK = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/
const JENIS_DARI_TIPE: Record<string, JenisChangelog> = { feat: 'baru', fix: 'perbaikan', perf: 'perubahan' }
/** Baris trailer git (Co-Authored-By, Signed-off-by, …) menutup blok. */
const TRAILER = /^[A-Za-z][\w-]*-by:\s/i
const TANPA_KABAR = /^(-|tidak|tidak ada|internal)$/i

function bacaPembaca(teks: string): PembacaChangelog[] {
  const ada = new Set(teks.toLowerCase().split(/[,\s]+/).filter(Boolean))
  if (ada.has('semua')) return [...URUTAN_PEMBACA]
  return URUTAN_PEMBACA.filter(p => ada.has(p))
}

const hurufBesarAwal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** null = commit ini tidak dikabarkan. */
export function drafDariCommit(pesan: string): DrafCommit | null {
  // BOM: beberapa commit lama ditulis lewat PowerShell dan diawali U+FEFF.
  const baris = pesan.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n')
  const subjek = baris[0]?.trim() ?? ''
  if (!subjek || /^(Merge|Revert) /.test(subjek)) return null

  const m = SUBJEK.exec(subjek)
  const tipe = m?.[1].toLowerCase() ?? ''
  const jenis: JenisChangelog = JENIS_DARI_TIPE[tipe] ?? 'perubahan'

  const awal = baris.findIndex((b, i) => i > 0 && /^Pembaruan:/i.test(b.trim()))
  if (awal === -1) {
    if (!(tipe in JENIS_DARI_TIPE) || !m) return null
    return { judul: hurufBesarAwal(m[4].trim()).slice(0, 200), isi: '', jenis, untuk: ['pengurus'], sederhana: false }
  }

  const judul = baris[awal].trim().replace(/^Pembaruan:\s*/i, '').trim()
  if (!judul || TANPA_KABAR.test(judul)) return null

  let untuk: PembacaChangelog[] = ['pengurus']
  const isi: string[] = []
  for (const b of baris.slice(awal + 1)) {
    if (TRAILER.test(b.trim())) break
    const pb = /^Pembaca:\s*(.*)$/i.exec(b.trim())
    if (pb) {
      const terbaca = bacaPembaca(pb[1])
      if (terbaca.length) untuk = terbaca
      continue
    }
    isi.push(b.trimEnd())
  }

  return {
    judul: judul.slice(0, 200),
    isi: isi.join('\n').trim().slice(0, 5000),
    jenis,
    untuk,
    sederhana: true,
  }
}
