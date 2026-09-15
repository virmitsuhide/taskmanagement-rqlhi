'use client'

import { useState } from 'react'
import { Star, StarHalf } from 'lucide-react'

/**
 * Penilaian setoran dengan bintang — lima bintang, kelipatan setengah.
 *
 * RUMUS RQ LHI: nilai = 50 + (bintang × 10)
 *
 *     0,5★ → 55      2★  → 70      3,5★ → 85      5★ → 100
 *     1★   → 60      3★  → 80      4★   → 90
 *
 * Di bawah 3 bintang berarti mengulang.
 *
 * YANG DISIMPAN TETAP ANGKA, BUKAN BINTANG
 *
 * Bintang hanyalah cara MENGISI; kolom `nilai_tahsin`, `nilai_tahfidz`, dan
 * `nilai_sikap` tetap menerima angka 0–100 seperti sebelumnya. Itu disengaja:
 * rapor KPI, rekap semester, dan seluruh analitik sudah berhitung dengan
 * skala itu, dan mengubah satuan penyimpanan berarti membongkar semuanya
 * demi perubahan yang sebenarnya hanya soal tampilan isian.
 *
 * ⚠️ KONSEKUENSI YANG PERLU DIKETAHUI
 *
 * Skala ini hanya bisa menghasilkan kelipatan lima: 55, 60, … 100. Nilai 88 —
 * yang dipakai pada 5 dari 27 setoran yang sudah tercatat — tidak lagi bisa
 * dimasukkan; yang terdekat 85 (3,5★) atau 90 (4★). Catatan lama tidak
 * berubah dan tetap terbaca; yang hilang adalah kemampuan MENULIS nilai
 * seperti itu. Komponen angka sebelumnya (ScoreInput) dibuat justru karena
 * alasan ini, jadi keputusan kembali ke bintang ditulis di sini apa adanya
 * supaya tidak terkesan luput.
 */

/** Nilai angka dari jumlah bintang. */
export function nilaiDariBintang(bintang: number): number {
  return 50 + bintang * 10
}

/** Jumlah bintang dari nilai angka — kebalikannya, untuk memuat data lama. */
export function bintangDariNilai(nilai: number | null | undefined): number {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) return 0
  // Dibulatkan ke setengah bintang terdekat: nilai lama seperti 88 tidak jatuh
  // persis di kisi bintang, dan menampilkannya sebagai 0 akan lebih
  // menyesatkan daripada menampilkannya sebagai 4★ yang mendekati.
  const b = (nilai - 50) / 10
  return Math.max(0, Math.min(5, Math.round(b * 2) / 2))
}

/** Di bawah tiga bintang berarti mengulang. */
export const BINTANG_MINIMAL_LULUS = 3

export function harusMengulang(bintang: number): boolean {
  return bintang > 0 && bintang < BINTANG_MINIMAL_LULUS
}

interface Props {
  name: string
  defaultValue?: number | null
  /** Diberi tahu tiap kali bintangnya berubah — dipakai form menyetel status. */
  onChange?: (bintang: number, nilai: number) => void
  disabled?: boolean
}

export function StarInput({ name, defaultValue = null, onChange, disabled }: Props) {
  const [bintang, setBintang] = useState<number>(bintangDariNilai(defaultValue))
  const [hover, setHover] = useState<number | null>(null)

  const tampil = hover ?? bintang
  const nilai = bintang > 0 ? nilaiDariBintang(bintang) : ''

  function pilih(nilaiBaru: number) {
    // Mengetuk bintang yang sama melepas penilaian — kosong berarti aspek itu
    // tidak dinilai, bukan bernilai nol.
    const next = nilaiBaru === bintang ? 0 : nilaiBaru
    setBintang(next)
    onChange?.(next, next > 0 ? nilaiDariBintang(next) : 0)
  }

  return (
    <div className="space-y-1.5">
      {/*
        Tiap bintang dua tombol berdampingan: separuh kiri dan separuh kanan.
        Cara ini membuat setengah bintang bisa diketuk langsung — termasuk di
        layar sentuh, tempat menebak posisi kursor di dalam satu ikon tidak
        pernah bekerja dengan baik.
      */}
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHover(null)}
        role="group"
        aria-label="Penilaian bintang"
      >
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className="relative inline-flex h-8 w-8 items-center justify-center">
            <Bintang terisi={tampil >= i ? 'penuh' : tampil >= i - 0.5 ? 'separuh' : 'kosong'} />
            <button
              type="button"
              disabled={disabled}
              aria-label={`${i - 0.5} bintang`}
              onMouseEnter={() => setHover(i - 0.5)}
              onClick={() => pilih(i - 0.5)}
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer disabled:cursor-default"
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`${i} bintang`}
              onMouseEnter={() => setHover(i)}
              onClick={() => pilih(i)}
              className="absolute inset-y-0 right-0 w-1/2 cursor-pointer disabled:cursor-default"
            />
          </span>
        ))}

        <span className="ml-2 text-sm tabular-nums">
          {bintang > 0 ? (
            <>
              <span className="font-semibold">{bintang}</span>
              <span className="text-muted-foreground">★ · nilai {nilaiDariBintang(bintang)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">belum dinilai</span>
          )}
        </span>
      </div>

      {harusMengulang(bintang) && (
        <p className="text-[11px] font-medium text-warning">
          Di bawah 3 bintang — setoran ini dihitung mengulang.
        </p>
      )}

      {/* Yang dikirim ke server tetap angkanya. Satu sumber nilai, sehingga
          bintang dan angka tidak mungkin berselisih. */}
      <input type="hidden" name={name} value={nilai} />
    </div>
  )
}

function Bintang({ terisi }: { terisi: 'penuh' | 'separuh' | 'kosong' }) {
  if (terisi === 'penuh') {
    return <Star className="h-7 w-7 fill-warning text-warning" aria-hidden />
  }
  if (terisi === 'separuh') {
    return (
      <span className="relative inline-flex" aria-hidden>
        <Star className="h-7 w-7 text-muted-foreground/40" />
        <StarHalf className="absolute inset-0 h-7 w-7 fill-warning text-warning" />
      </span>
    )
  }
  return <Star className="h-7 w-7 text-muted-foreground/40" aria-hidden />
}
