'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Hourglass, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTahsinLevels, getTahfidzLabel, namaPublik, tanggalWIB } from '@/lib/rq/ujian'
import type { UjianTahfidz, UjianTahsin, UjianUnit } from '@/types'

interface Props {
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
}

/**
 * Antrian ujian untuk orang tua — tanpa akun.
 *
 * Dua daftar: yang sudah TERJADWAL (dikelompokkan per tanggal, jam paling
 * dekat di atas) dan yang MENUNGGU JADWAL (bernomor antrian menurut urutan
 * pengajuan). Nama anak tahfidz memakai namaPublik — nama singkat yang
 * memang disiapkan untuk beredar ke luar sekolah.
 *
 * Nomor antrian dihitung per unit & jenis dari seluruh pengajuan, bukan dari
 * hasil pencarian, supaya nomor seorang anak tidak berubah saat orang tua
 * mengetik namanya.
 */

interface Baris {
  id: string
  jenis: 'Tahfidz' | 'Tahsin'
  unit: UjianUnit
  judul: string
  rincian: string
  jadwal: string | null
  penguji: string | null
  dibuat: string
  cari: string
  nomor?: number
}

const JAM = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
const HARI = (tgl: string) =>
  new Date(`${tgl}T00:00:00+07:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })
const TGL = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

export function AntrianUjian({ tahfidz, tahsin }: Props) {
  const [unit, setUnit] = useState<UjianUnit | 'semua'>('semua')
  const [q, setQ] = useState('')

  const semua = useMemo<Baris[]>(() => {
    const tf: Baris[] = tahfidz.map(t => ({
      id: t.id, jenis: 'Tahfidz', unit: t.unit,
      judul: namaPublik(t),
      rincian: `${t.unit} · Kelas ${t.kelas} · ${getTahfidzLabel(t.tipe, t.juz)}`,
      jadwal: t.jadwal, penguji: t.penguji, dibuat: t.created_at,
      cari: namaPublik(t).toLowerCase(),
    }))
    const ts: Baris[] = tahsin.map(t => ({
      id: t.id, jenis: 'Tahsin', unit: t.unit,
      judul: t.nama_kelompok,
      rincian: `${t.unit} · ${formatTahsinLevels(t)} · ${t.siswa.length} siswa`,
      jadwal: t.jadwal, penguji: t.penguji, dibuat: t.created_at,
      // Anak ujian tahsin diuji berkelompok: nama anak dicari di anggota kelompoknya.
      cari: [t.nama_kelompok, ...t.siswa.map(s => s.nama)].join(' ').toLowerCase(),
    }))
    // Nomor antrian per unit & jenis, dari yang paling lama menunggu.
    const menunggu = [...tf, ...ts].filter(b => !b.jadwal).sort((a, b) => a.dibuat.localeCompare(b.dibuat))
    const hitung = new Map<string, number>()
    for (const b of menunggu) {
      const k = `${b.unit}|${b.jenis}`
      const n = (hitung.get(k) ?? 0) + 1
      hitung.set(k, n)
      b.nomor = n
    }
    return [...tf, ...ts]
  }, [tahfidz, tahsin])

  const kata = q.trim().toLowerCase()
  const tersaring = semua.filter(b => (unit === 'semua' || b.unit === unit) && (!kata || b.cari.includes(kata)))
  const terjadwal = tersaring.filter(b => b.jadwal).sort((a, b) => a.jadwal!.localeCompare(b.jadwal!))
  const menunggu = tersaring.filter(b => !b.jadwal).sort((a, b) => a.dibuat.localeCompare(b.dibuat))

  const perTanggal = new Map<string, Baris[]>()
  for (const b of terjadwal) {
    const t = tanggalWIB(b.jadwal!)
    perTanggal.set(t, [...(perTanggal.get(t) ?? []), b])
  }
  const hariIni = tanggalWIB(new Date())

  return (
    <div className="space-y-6">
      {/* ── Cari & saring ── */}
      <div className="rounded-[20px] border bg-card p-4 md:p-5">
        <label htmlFor="cari-anak" className="text-sm font-bold">Cari nama anak</label>
        <div className="mt-2 flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] border-primary px-3.5 focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <input
            id="cari-anak"
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="mis. Hana"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </div>
        <div role="group" aria-label="Unit" className="mt-3 flex flex-wrap gap-2">
          {([['semua', 'Semua unit'], ['SD', 'SDIT'], ['SMP', 'SMPIT']] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setUnit(v)}
              aria-pressed={unit === v}
              className={cn(
                'h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                unit === v ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {kata && (
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            {terjadwal.length + menunggu.length === 0
              ? <>Tidak ada ujian untuk &ldquo;{q.trim()}&rdquo;. Bila anak belum diajukan, tanyakan kepada pengampu halaqohnya.</>
              : <>{terjadwal.length + menunggu.length} hasil untuk &ldquo;{q.trim()}&rdquo;</>}
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* ── Terjadwal ── */}
        <section className="rounded-[22px] border bg-card p-5 md:p-7">
          <div className="flex items-baseline gap-2.5">
            <CalendarClock className="h-5 w-5 self-center text-info" />
            <h2 className="font-heading text-2xl">Jadwal ujian</h2>
            <span className="text-sm text-muted-foreground">{terjadwal.length} ujian</span>
          </div>
          {terjadwal.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              Belum ada ujian yang dijadwalkan.
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              {[...perTanggal.entries()].map(([tgl, isi]) => (
                <div key={tgl}>
                  <p className={cn('pb-1 text-xs font-bold uppercase tracking-[0.08em]', tgl < hariIni ? 'text-muted-foreground' : 'text-foreground/70')}>
                    {HARI(tgl)}{tgl === hariIni && ' · hari ini'}{tgl < hariIni && ' · menunggu hasil'}
                  </p>
                  <ul>
                    {isi.map(b => (
                      <li key={b.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 border-t py-3.5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
                        <span className="font-heading text-2xl tabular-nums text-primary">{JAM(b.jadwal!)}</span>
                        <span className="min-w-0">
                          <span className="block font-bold">{b.judul}</span>
                          <span className="block text-[13px] text-muted-foreground">
                            {b.jenis} · {b.rincian}{b.penguji ? ` · penguji ${b.penguji}` : ''}
                          </span>
                        </span>
                        <span className="col-start-2 w-fit rounded-md bg-info-wash px-2 py-0.5 text-xs font-semibold text-info sm:col-start-auto">Terjadwal</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Menunggu jadwal ── */}
        <section className="rounded-[22px] border bg-card p-5 md:p-6">
          <div className="flex items-baseline gap-2.5">
            <Hourglass className="h-5 w-5 self-center text-warning" />
            <h2 className="font-heading text-2xl">Menunggu jadwal</h2>
            <span className="text-sm text-muted-foreground">{menunggu.length}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Nomor = urutan pengajuan per unit dan jenis ujian.</p>
          {menunggu.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              Tidak ada pengajuan yang menunggu.
            </p>
          ) : (
            <ul className="mt-3">
              {menunggu.map(b => (
                <li key={b.id} className="flex items-start gap-3 border-t py-3">
                  <span className="mt-0.5 w-8 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">#{b.nomor}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{b.judul}</span>
                    <span className="block text-[13px] text-muted-foreground">{b.jenis} · {b.rincian}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">sejak {TGL(b.dibuat)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/ujian/rekap" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
            Lihat hasil ujian yang sudah selesai →
          </Link>
        </section>
      </div>
    </div>
  )
}
