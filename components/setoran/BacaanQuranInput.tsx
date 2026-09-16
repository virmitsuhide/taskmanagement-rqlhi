'use client'

import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { HALAMAN_MAKS, HALAMAN_MIN, halamanDariBacaan, usulanDariHalaman } from '@/lib/rq/bacaan-quran'
import type { SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import { cn } from '@/lib/utils'

/**
 * Isian bacaan mushaf — halaman, surat, dan rentang ayat.
 *
 * KENAPA EMPAT KOLOM, BUKAN SATU
 *
 * Halaman dan surat/ayat menunjuk tempat yang sama tapi dipakai orang yang
 * berbeda. Guru dan koordinator mengukur laju dengan halaman, sebab 604
 * halaman bisa dipersentasekan; wali murid mengenali surat, dan tidak ada
 * orang tua yang bertanya anaknya sudah halaman berapa. Menyimpan satu lalu
 * menurunkan yang lain tidak cukup: tabel halaman hanya tahu ayat PERTAMA tiap
 * halaman, jadi dari halaman saja "berhenti di ayat berapa" hilang.
 *
 * KENAPA SALING MENGISI, BUKAN SALING MENGUNCI
 *
 * Guru mengetik yang paling dekat dengan ingatannya — kadang halaman, kadang
 * surat. Karena itu keduanya boleh diketik, dan yang satu mengusulkan isi yang
 * lain. Usulan itu tetap bisa ditimpa: bacaan boleh melewati batas halaman,
 * dan memaksakan kecocokan akan menolak catatan yang justru benar. Yang
 * menjaga kewarasan angkanya ada di server (periksaBacaanQuran), bukan di sini.
 *
 * Sinkronisasi dikerjakan di penangan ketikan, BUKAN di useEffect: efek yang
 * saling mengamati dua kolom yang saling menurunkan akan berkejaran, dan
 * kursor guru melompat setiap kali salah satunya menulis ulang yang lain.
 */
export interface IsianBacaan {
  halaman: string
  surat_id: string
  ayat_dari: string
  ayat_ke: string
}

export const BACAAN_KOSONG: IsianBacaan = { halaman: '', surat_id: '', ayat_dari: '', ayat_ke: '' }

/** Ubah isian layar menjadi bentuk yang dikirim ke server. */
export function keBacaanQuran(v: IsianBacaan) {
  const angka = (s: string) => (s.trim() === '' ? null : Number(s))
  return {
    halaman: angka(v.halaman),
    surat_id: angka(v.surat_id),
    ayat_dari: angka(v.ayat_dari),
    ayat_ke: angka(v.ayat_ke),
  }
}

interface Props {
  value: IsianBacaan
  onChange: (v: IsianBacaan) => void
  surat: SuratPilihan[]
  /** Ditampilkan sebagai keterangan kecil di bawah — mis. posisi terakhir anak. */
  petunjuk?: string
  disabled?: boolean
  className?: string
}

export function BacaanQuranInput({ value, onChange, surat, petunjuk, disabled, className }: Props) {
  const uid = useId()
  const info = value.surat_id ? surat.find(s => s.id === Number(value.surat_id)) : undefined

  // Halaman diketik → usulkan surat & ayat pembuka halaman itu.
  function ubahHalaman(halaman: string) {
    const n = Number(halaman)
    const usul = halaman.trim() !== '' && Number.isInteger(n) ? usulanDariHalaman(n) : null
    onChange(usul
      ? { ...value, halaman, surat_id: String(usul.surat_id), ayat_dari: String(usul.ayat_dari), ayat_ke: '' }
      : { ...value, halaman })
  }

  // Surat atau ayat awal diketik → usulkan halaman tempat ayat itu berada.
  function ubahPosisi(next: IsianBacaan) {
    const s = Number(next.surat_id)
    const a = Number(next.ayat_dari)
    const halaman = next.surat_id && next.ayat_dari && Number.isInteger(s) && Number.isInteger(a)
      ? halamanDariBacaan(s, a)
      : null
    onChange(halaman ? { ...next, halaman: String(halaman) } : next)
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor={`${uid}-hal`}>Hal. mushaf</label>
          <Input
            id={`${uid}-hal`} type="number" inputMode="numeric"
            min={HALAMAN_MIN} max={HALAMAN_MAKS}
            value={value.halaman} disabled={disabled}
            onChange={e => ubahHalaman(e.target.value)}
            className="h-9 w-24"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <label className="text-xs font-medium" htmlFor={`${uid}-surat`}>Surat</label>
          {/*
            <select> biasa, bukan komponen Select berbasis Radix seperti di
            formulir lain: 114 pilihan di dalam popover harus digulung dengan
            jari, sedangkan pemilih bawaan ponsel bisa dilompati dengan
            mengetik huruf awal. Di isian yang diulang belasan kali per sesi,
            selisihnya bukan soal selera.
          */}
          <select
            id={`${uid}-surat`}
            value={value.surat_id} disabled={disabled}
            onChange={e => ubahPosisi({ ...value, surat_id: e.target.value, ayat_ke: '' })}
            className="h-9 w-full min-w-40 rounded-md border bg-card px-2 text-sm"
          >
            <option value="">— pilih surat —</option>
            {surat.map(s => <option key={s.id} value={s.id}>{s.id}. {s.name_latin}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor={`${uid}-dari`}>Ayat</label>
          <div className="flex items-center gap-1">
            <Input
              id={`${uid}-dari`} type="number" inputMode="numeric" min={1} max={info?.total_ayat}
              value={value.ayat_dari} disabled={disabled}
              onChange={e => ubahPosisi({ ...value, ayat_dari: e.target.value })}
              className="h-9 w-20" placeholder="dari"
            />
            <span aria-hidden className="text-muted-foreground">–</span>
            <Input
              aria-label="Ayat terakhir"
              type="number" inputMode="numeric" min={1} max={info?.total_ayat}
              value={value.ayat_ke} disabled={disabled}
              onChange={e => onChange({ ...value, ayat_ke: e.target.value })}
              className="h-9 w-20" placeholder="ke"
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {info
          ? `${info.name_latin} · ${info.total_ayat} ayat`
          : petunjuk ?? 'Ketik halaman mushaf — surat & ayat awalnya terisi sendiri.'}
      </p>
    </div>
  )
}
