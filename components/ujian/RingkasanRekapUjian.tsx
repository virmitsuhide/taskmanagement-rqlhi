'use client'

import { useState } from 'react'
import { BookOpen, ClipboardList, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BULAN_ID, PREDIKAT_OPTIONS, getPredikatClass } from '@/lib/rq/ujian'
import type { UjianTahfidz, UjianTahsin } from '@/types'

/**
 * Ringkasan rekap ujian sebulan untuk pengurus: berapa anak diuji tahfidz &
 * tahsin, sebaran nilainya, dan unduhan Excel. Pindahan dari halaman publik
 * Rekap Hasil, yang dihapus karena memuat nama lengkap siswa.
 */
export function RingkasanRekapUjian({ tahfidz, tahsin, month, year }: {
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
  month: number
  year: number
}) {
  const [mengekspor, setMengekspor] = useState(false)

  // Modul xlsx baru dimuat saat tombol ditekan — kebanyakan orang hanya membaca.
  async function ekspor() {
    setMengekspor(true)
    try {
      const { exportRekapUjian } = await import('@/lib/rq/ujian-export')
      exportRekapUjian(tahfidz, tahsin, month, year)
    } finally {
      setMengekspor(false)
    }
  }

  const tfAnak = new Set(tahfidz.map(t => t.student_id ?? t.nama_siswa)).size
  const tfNilai = PREDIKAT_OPTIONS.map(p => ({ ...p, n: tahfidz.filter(t => t.predikat === p.value).length }))
  const tfBelum = tahfidz.filter(t => !t.predikat).length

  const siswaTahsin = tahsin.flatMap(t => t.siswa)
  const tsNilai = [
    { label: 'Lulus', n: siswaTahsin.filter(s => s.predikat === 'lulus').length, kelas: 'text-success font-semibold' },
    { label: 'Mengulang', n: siswaTahsin.filter(s => s.predikat === 'mengulang').length, kelas: 'text-destructive font-semibold' },
  ]
  const tsBelum = siswaTahsin.filter(s => !s.predikat).length
  const periode = `${BULAN_ID[month - 1]} ${year}`

  if (tahfidz.length + tahsin.length === 0) return null

  return (
    <section aria-label={`Rekap ujian ${periode}`} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KartuNilai
          ikon={<BookOpen className="h-3.5 w-3.5" />}
          judul="Ujian tahfidz"
          angka={tahfidz.length}
          satuan={`ujian · ${tfAnak} anak`}
          baris={[
            ...tfNilai.map(p => ({ label: p.label, n: p.n, kelas: getPredikatClass(p.value) })),
            ...(tfBelum ? [{ label: 'Belum dinilai', n: tfBelum, kelas: 'text-muted-foreground' }] : []),
          ]}
          total={tahfidz.length}
        />
        <KartuNilai
          ikon={<ClipboardList className="h-3.5 w-3.5" />}
          judul="Ujian tahsin"
          angka={siswaTahsin.length}
          satuan={`anak · ${tahsin.length} kelompok`}
          baris={[...tsNilai, ...(tsBelum ? [{ label: 'Belum dinilai', n: tsBelum, kelas: 'text-muted-foreground' }] : [])]}
          total={siswaTahsin.length}
        />
      </div>
      <Button variant="outline" className="w-full" onClick={ekspor} disabled={mengekspor}>
        <FileSpreadsheet className="mr-1.5 h-4 w-4" />
        {mengekspor ? 'Menyiapkan…' : `Unduh rekap ${periode} (Excel)`}
      </Button>
    </section>
  )
}

function KartuNilai({ ikon, judul, angka, satuan, baris, total }: {
  ikon: React.ReactNode
  judul: string
  angka: number
  satuan: string
  baris: { label: string; n: number; kelas: string }[]
  total: number
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{ikon}{judul}</p>
      <p className="mt-1.5 text-2xl font-bold leading-none">
        {angka.toLocaleString('id-ID')} <span className="text-xs font-normal text-muted-foreground">{satuan}</span>
      </p>
      <ul className="mt-3 space-y-1.5">
        {baris.map(b => (
          <li key={b.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs">
            <span className={cn('truncate', b.kelas)}>{b.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full" style={{ width: `${total ? (b.n / total) * 100 : 0}%`, background: 'var(--primary)' }} />
            </span>
            <span className="text-right tabular-nums">{b.n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
