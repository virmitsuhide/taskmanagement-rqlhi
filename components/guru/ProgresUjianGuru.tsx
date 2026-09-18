'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ScrollText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sembunyikanKartu, useKartuTersembunyi } from './kartu-tersembunyi'
import {
  formatJadwalSingkat, formatTahsinLevels, formatTanggalSingkat, getPredikatLabel, getTahfidzLabel,
} from '@/lib/rq/ujian'
import type { UjianStatus, UjianTahfidz, UjianTahsin } from '@/types'

/**
 * Ujian selesai tetap tampil sekian hari supaya hasilnya sempat terbaca, lalu
 * hilang dari beranda — termasuk dari "tampilkan lagi". Dihitung dari
 * selesai_at (saat koordinator menandai selesai), bukan tanggal ujiannya.
 */
const HASIL_TAMPIL_HARI = 7

const RUANG = 'progres-ujian'

interface Baris {
  id: string
  ujian: 'Tahfidz' | 'Tahsin'
  judul: string
  rincian: string
  status: UjianStatus
  diajukan: string
  jadwal: string | null
  penguji: string | null
  hasil: string | null
  /** Diajukan orang lain (biasanya koordinator) untuk anak halaqoh ini. */
  olehLain: string | null
  /** Ujian kelompok tahsin: nama panggilan anak-anaknya, tampil sebagai chip. */
  anak?: { panggilan: string; lengkap: string }[]
}

/** Chip nama yang tampil sebelum tombol "+N lainnya". */
const CHIP_AWAL = 6

/**
 * Nama panggilan untuk chip: kata pertama, kecuali kata itu tidak cukup
 * membedakan — singkatan ("M."), atau "Muhammad" yang dipakai separuh kelas.
 * Nama pendek yang masih kembar di kelompok yang sama ditambah kata keduanya.
 */
const AWALAN_UMUM = new Set(['muhammad', 'mohammad', 'muhamad', 'moh', 'moch', 'm', 'ahmad', 'abdul'])
export function panggilanAnak(nama: string[]): string[] {
  const kata = nama.map(n => n.trim().split(/\s+/))
  const pendek = kata.map(k => {
    const awal = k[0] ?? ''
    const lemah = awal.length <= 2 || awal.endsWith('.') || AWALAN_UMUM.has(awal.toLowerCase().replace(/\.$/, ''))
    if (!lemah || !k[1]) return awal
    // "Muhammad Al" belum sebuah panggilan — sambung kata sesudah partikelnya.
    return k[1].length <= 2 && k[2] ? `${awal} ${k[1]} ${k[2]}` : `${awal} ${k[1]}`
  })
  return pendek.map((p, i) => pendek.indexOf(p) !== pendek.lastIndexOf(p) && kata[i].length > p.split(' ').length
    ? `${p} ${kata[i][p.split(' ').length][0]}.`
    : p)
}

const TAHAP: { status: UjianStatus; label: string }[] = [
  { status: 'diajukan', label: 'Diajukan' },
  { status: 'dijadwalkan', label: 'Dijadwalkan' },
  { status: 'selesai', label: 'Selesai' },
]
const URUTAN: Record<UjianStatus, number> = { diajukan: 0, dijadwalkan: 1, selesai: 2 }

function masihTampil(status: UjianStatus, selesaiAt: string | null | undefined, updatedAt: string): boolean {
  if (status !== 'selesai') return true
  const acuan = new Date(selesaiAt ?? updatedAt).getTime()
  return Date.now() - acuan <= HASIL_TAMPIL_HARI * 24 * 60 * 60 * 1000
}

/**
 * Progres ujian anak-anak guru ini, di beranda portal guru — baik yang ia
 * ajukan sendiri maupun yang diajukan koordinator untuk anak halaqohnya
 * (pengajuan sering disampaikan lisan lalu dimasukkan koordinator).
 *
 * Hanya yang masih berjalan, ditambah yang baru selesai sepekan terakhir —
 * riwayat lengkapnya ada di halaman Pengajuan Ujian. Beranda menjawab
 * "anak mana yang sedang menunggu apa", bukan "apa saja yang pernah terjadi".
 */
export function ProgresUjianGuru({ teacherId, tahfidz, tahsin, idSiswa, tersembunyiAwal }: {
  teacherId: string
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
  /** Anak halaqoh guru ini — pada ujian kelompok, hanya merekalah yang disebut. */
  idSiswa: string[]
  /** Kartu yang sudah ditutup guru ini, dari server — berlaku di semua perangkat. */
  tersembunyiAwal: string[]
}) {
  const milik = new Set(idSiswa)
  const baris: Baris[] = [
    ...tahfidz
      .filter(t => masihTampil(t.status, t.selesai_at, t.updated_at))
      .map((t): Baris => ({
        id: `tahfidz:${t.id}`, ujian: 'Tahfidz', judul: t.nama_siswa,
        rincian: `${getTahfidzLabel(t.tipe, t.juz)} · Kelas ${t.kelas}`,
        status: t.status, diajukan: t.created_at, jadwal: t.jadwal, penguji: t.penguji,
        hasil: t.predikat ? getPredikatLabel(t.predikat) : null,
        olehLain: t.created_by_teacher === teacherId ? null : t.created_by_user ? 'koordinator' : 'guru lain',
      })),
    ...tahsin
      .filter(t => masihTampil(t.status, t.selesai_at, t.updated_at))
      .map((t): Baris => {
        // Kelompok bisa berisi anak ustadz lain bila koordinator yang
        // menyusunnya; yang disebut dan dihitung hanya anak guru ini.
        const sendiri = t.created_by_teacher === teacherId
        const anak = sendiri ? t.siswa : t.siswa.filter(s => s.student_id && milik.has(s.student_id))
        const lulus = anak.filter(s => s.predikat === 'lulus').length
        const panggilan = panggilanAnak(anak.map(s => s.nama))
        return {
          id: `tahsin:${t.id}`, ujian: 'Tahsin',
          // Satu anak: namanya judul. Kelompok: judulnya ringkasan, dan nama-nama
          // tampil sebagai chip — sebelas nama dalam satu baris judul terpotong
          // setelah tiga-empat nama di layar HP.
          judul: anak.length === 1 ? anak[0].nama : `${formatTahsinLevels(t)} · ${anak.length} siswa`,
          rincian: anak.length === 1 ? `${formatTahsinLevels(t)} · Sesi ${t.sesi}` : `Sesi ${t.sesi}`,
          anak: anak.length > 1 ? anak.map((s, i) => ({ panggilan: panggilan[i], lengkap: s.nama })) : undefined,
          status: t.status, diajukan: t.created_at, jadwal: t.jadwal, penguji: t.penguji,
          hasil: t.status === 'selesai' ? `${lulus}/${anak.length} lulus` : null,
          olehLain: sendiri ? null : t.created_by_user ? 'koordinator' : 'guru lain',
        }
      }),
  ].sort((a, b) => URUTAN[a.status] - URUTAN[b.status] || b.diajukan.localeCompare(a.diajukan))

  // Kunci memuat status: kartu yang disembunyikan saat "Diajukan" muncul lagi
  // begitu dijadwalkan — tahap baru adalah kabar baru yang tidak boleh
  // tertelan oleh tombol tutup yang ditekan untuk tahap sebelumnya.
  const kunci = (b: Baris) => `${b.id}:${b.status}`
  const tersembunyi = useKartuTersembunyi(RUANG, teacherId, tersembunyiAwal)
  // Kartu yang ditutup tidak bisa dimunculkan kembali dari beranda; riwayat
  // lengkapnya tetap ada di halaman Pengajuan Ujian.
  const tampil = baris.filter(b => !tersembunyi.has(kunci(b)))
  const berjalan = tampil.filter(b => b.status !== 'selesai').length
  const [terbuka, setTerbuka] = useState<Set<string>>(() => new Set())

  return (
    <section className="mb-6 rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <ScrollText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Progres Ujian Anak</h2>
        {berjalan > 0 && (
          <span className="rounded-full bg-primary-wash px-2 py-0.5 text-[11px] font-medium text-primary">
            {berjalan} berjalan
          </span>
        )}
        <Link href="/guru/ujian" className="ml-auto text-xs text-muted-foreground hover:underline">
          Semua pengajuan →
        </Link>
      </div>

      {tampil.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Tidak ada anak yang sedang diajukan ujian.</p>
          <Link href="/guru/ujian/baru" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
            Ajukan ujian →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 p-3 sm:grid-cols-2">
          {tampil.map(b => (
            <li key={b.id} className="relative min-w-0 rounded-lg border bg-background p-3">
              <button
                type="button"
                onClick={() => sembunyikanKartu(RUANG, teacherId, kunci(b))}
                aria-label={`Sembunyikan ${b.judul} dari beranda`}
                title="Sembunyikan dari beranda"
                className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Hanya baris judul yang memberi ruang untuk tombol ✕ — sisanya
                  memakai lebar penuh kartu, yang sempit di layar HP. */}
              <p className="truncate pr-7 text-sm font-medium">{b.judul}</p>
              <p className="mt-0.5 line-clamp-2 pr-7 text-xs text-muted-foreground">
                {b.ujian} · {b.rincian}{b.olehLain ? ` · diajukan ${b.olehLain}` : ''}
              </p>
              {b.anak && (() => {
                const semua = terbuka.has(b.id)
                const tampilAnak = semua ? b.anak : b.anak.slice(0, CHIP_AWAL)
                const sisa = b.anak.length - tampilAnak.length
                return (
                  <ul className="mt-2 flex flex-wrap gap-1" aria-label="Siswa yang diajukan">
                    {tampilAnak.map((a, i) => (
                      <li key={i} title={a.lengkap} className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[11px]">
                        {a.panggilan}
                      </li>
                    ))}
                    {(sisa > 0 || semua) && b.anak.length > CHIP_AWAL && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setTerbuka(prev => {
                            const baru = new Set(prev)
                            if (semua) baru.delete(b.id)
                            else baru.add(b.id)
                            return baru
                          })}
                          className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-accent"
                        >
                          {semua ? 'Ringkas' : `+${sisa} lainnya`}
                        </button>
                      </li>
                    )}
                  </ul>
                )
              })()}
              {b.hasil && <p className="mt-1 text-xs font-medium text-success">{b.hasil}</p>}

              <Tahapan status={b.status} />

              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {b.status === 'diajukan'
                  ? `Diajukan ${formatTanggalSingkat(b.diajukan)} · menunggu dijadwalkan`
                  : `${formatJadwalSingkat(b.jadwal)} · ${b.penguji || 'Penguji belum ditentukan'}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Tahapan({ status }: { status: UjianStatus }) {
  const posisi = URUTAN[status]
  return (
    <ol className="mt-2 flex items-center gap-1" aria-label={`Tahap: ${TAHAP[posisi].label}`}>
      {TAHAP.map((t, i) => {
        const lewat = i <= posisi
        return (
          <li key={t.status} className="flex flex-1 items-center gap-1 last:flex-none">
            <span
              className={cn(
                'flex items-center gap-1 whitespace-nowrap text-[11px]',
                i === posisi ? 'font-semibold text-foreground' : lewat ? 'text-success' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full border',
                  lewat ? 'border-success bg-success text-white' : 'border-border bg-transparent',
                )}
              >
                {lewat && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              {t.label}
            </span>
            {i < TAHAP.length - 1 && (
              <span className={cn('h-px flex-1', i < posisi ? 'bg-success' : 'bg-border')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
