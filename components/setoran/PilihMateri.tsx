'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { HasilMateri, MateriTahsin } from '@/lib/data/materi-tahsin'

/**
 * Daftar periksa materi hafalan — Gharib & Tajwid UMMI.
 *
 * KENAPA KETUNTASAN MATERI, BUKAN NOMOR HALAMAN
 *
 * Buku ini dihafal, bukan dibaca. Satu halamannya memuat beberapa materi dan
 * bisa memakan sampai empat pertemuan, sehingga kolom halaman akan mengulang
 * angka yang sama tanpa ada yang bisa membedakannya. Yang bergerak di sini
 * bukan posisi melainkan himpunan materi yang tuntas. Nomor halaman tetap
 * ditampilkan sebagai keterangan kecil — gunanya hanya untuk menemukan
 * materinya di buku fisik, bukan untuk mengukur kemajuan.
 *
 * KENAPA TIGA HASIL, BUKAN DUA
 *
 * "Belum lulus" memuat dua keadaan yang nasibnya berbeda. MENGULANG berarti
 * materinya sudah dicoba utuh tapi belum lancar — pertemuan berikutnya
 * mengulang dari awal. LANJUT berarti materinya belum selesai dibahas —
 * pertemuan berikutnya meneruskan. Menyamakan keduanya membuat anak yang
 * berjalan normal melewati materi panjang terbaca seperti anak yang tersendat.
 *
 * LULUS DITARUH PALING KANAN karena ia ujung perjalanan sebuah materi, dan
 * karena tombol yang paling sering ditekan sebaiknya tidak bersebelahan dengan
 * tombol yang paling jarang: jempol yang meleset di "Ulang" mengembalikan anak
 * ke awal materi.
 */

export type PilihanMateri = Record<string, HasilMateri>

/**
 * Urutan tombol: dari yang paling jauh dari selesai ke yang paling dekat.
 *
 * Kelas warnanya ditulis utuh, bukan dirangkai `border-${warna}`: Tailwind
 * memindai kode sebagai teks dan tidak pernah melihat nama kelas yang baru
 * terbentuk saat program berjalan — yang dirangkai akan hilang saat build.
 */
const HASIL: { nilai: HasilMateri; label: string; aktif: string }[] = [
  { nilai: 'ulang',  label: 'Ulang',  aktif: 'border-warning text-warning' },
  { nilai: 'lanjut', label: '➡️ Lanjut', aktif: 'border-primary text-primary' },
  { nilai: 'lulus',  label: 'Lulus',  aktif: 'border-success text-success' },
]

interface Props {
  materi: MateriTahsin[]
  /** Keadaan terakhir tiap materi dari setoran sebelumnya. */
  hasilTerakhir: Record<string, HasilMateri>
  value: PilihanMateri
  onChange: (v: PilihanMateri) => void
  disabled?: boolean
}

export function PilihMateri({ materi, hasilTerakhir, value, onChange, disabled }: Props) {
  const [semua, setSemua] = useState(false)

  const { lulus, berjalan, fokus } = useMemo(() => {
    const lulus = materi.filter(m => hasilTerakhir[m.id] === 'lulus')
    const berjalan = materi.filter(m => {
      const h = hasilTerakhir[m.id]
      return h === 'ulang' || h === 'lanjut'
    })
    const belum = materi.find(m => !(m.id in hasilTerakhir)) ?? null
    /*
      Yang ditampilkan pertama: materi yang MASIH BERJALAN, baru sesudahnya
      satu materi baru. Anak yang materinya belum selesai harus meneruskannya,
      bukan melompat — dan menaruh materi baru di atas justru mengundang
      lompatan itu.
    */
    const fokus = [...berjalan, ...(belum ? [belum] : [])]
    return { lulus, berjalan, fokus }
  }, [materi, hasilTerakhir])

  const persen = materi.length > 0 ? Math.round((lulus.length / materi.length) * 100) : 0
  const tampil = semua ? materi : fokus

  function setel(id: string, hasil: HasilMateri) {
    const next = { ...value }
    // Menekan tombol yang sama dua kali berarti membatalkan — tanpa itu materi
    // yang tercentang keliru tidak punya jalan keluar selain memuat ulang.
    if (next[id] === hasil) delete next[id]
    else next[id] = hasil
    onChange(next)
  }

  if (materi.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Daftar materi tahap ini belum dimuat. Jalankan <code>npm run seed:materi</code>.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${persen}%` }} />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          {lulus.length}/{materi.length} materi lulus
          {berjalan.length > 0 ? ` · ${berjalan.length} berjalan` : ''}
        </span>
        <button
          type="button"
          onClick={() => setSemua(v => !v)}
          className="text-[11px] text-primary hover:underline"
        >
          {semua ? 'Ringkas' : 'Lihat semua'}
        </button>
      </div>

      {tampil.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Semua materi sudah lulus — anak siap diajukan ujian tahsin.
        </p>
      ) : (
        <ul className="space-y-1">
          {tampil.map(m => {
            const dipilih = value[m.id]
            const lalu = hasilTerakhir[m.id]
            return (
              <li
                key={m.id}
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5',
                  dipilih === 'lulus' && 'border-success bg-success-wash',
                  dipilih === 'ulang' && 'border-warning bg-warning-wash',
                  dipilih === 'lanjut' && 'border-primary bg-primary-wash',
                  !dipilih && lalu === 'lulus' && 'opacity-60',
                )}
              >
                <span className="w-8 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {m.nomor}.
                </span>
                <span className="min-w-0 flex-1">
                  {/* dir="auto" wajib: tanpa itu tanda baca di ujung potongan
                      mushaf melompat ke sisi yang salah. */}
                  <span dir="auto" className="block truncate text-sm">{m.nama}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    hal. {m.halaman}
                    {m.keterangan ? ` · ${m.keterangan}` : ''}
                    {lalu === 'lulus' ? ' · sudah lulus' : ''}
                    {lalu === 'ulang' ? ' · terakhir: mengulang' : ''}
                    {lalu === 'lanjut' ? ' · terakhir: belum selesai' : ''}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {HASIL.map(h => (
                    <button
                      key={h.nilai}
                      type="button"
                      disabled={disabled}
                      onClick={() => setel(m.id, h.nilai)}
                      aria-pressed={dipilih === h.nilai}
                      className={cn(
                        'rounded border px-2 py-1 text-[11px]',
                        dipilih === h.nilai ? h.aktif : 'bg-card text-muted-foreground',
                      )}
                    >
                      {h.label}
                    </button>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {!semua && tampil.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Menampilkan materi yang sedang berjalan dan materi berikutnya. Sisanya di “Lihat semua”.
        </p>
      )}
    </div>
  )
}
