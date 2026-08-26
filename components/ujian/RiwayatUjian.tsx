'use client'

import { useMemo, useState } from 'react'
import { BookOpen, ClipboardList, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERIODE_SELECT_CLASS, PilihPeriode } from './PilihPeriode'
import {
  BULAN_ID, formatTanggal, formatTahsinLevels,
  getPredikatClass, getPredikatLabel, getTahfidzLabel,
} from '@/lib/rq/ujian'
import type { UjianTahfidz, UjianTahsin } from '@/types'

interface Props {
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
  month: number
  year: number
}

const TANPA_PENGUJI = 'Tanpa penguji'

interface Baris {
  id: string
  penguji: string
  nama: string
  jadwal: string | null
  jenis: 'tahfidz' | 'tahsin'
  rincian: string
  hasil: string
  hasilKelas: string
}

/**
 * Rekap ujian selesai satu bulan, dikelompokkan per penguji.
 *
 * Sudut pandangnya sengaja berbeda dari halaman rekap publik: yang dicari di
 * sini bukan "anak mana yang lulus" melainkan "berapa banyak yang diuji siapa"
 * — dipakai koordinator untuk membagi beban penguji bulan berikutnya.
 */
export function RiwayatUjian({ tahfidz, tahsin, month, year }: Props) {
  const [saring, setSaring] = useState('semua')

  const baris = useMemo<Baris[]>(() => {
    const tf: Baris[] = tahfidz.map(t => ({
      id: `tf-${t.id}`,
      penguji: t.penguji?.trim() || TANPA_PENGUJI,
      nama: t.nama_siswa,
      jadwal: t.jadwal,
      jenis: 'tahfidz',
      rincian: `${getTahfidzLabel(t.tipe, t.juz)} · ${t.unit} kelas ${t.kelas}${t.is_quls ? ' · QULS' : ''}`,
      hasil: getPredikatLabel(t.predikat),
      hasilKelas: getPredikatClass(t.predikat),
    }))

    const ts: Baris[] = tahsin.map(t => {
      const lulus = t.siswa.filter(s => s.predikat === 'lulus').length
      return {
        id: `ts-${t.id}`,
        penguji: t.penguji?.trim() || TANPA_PENGUJI,
        nama: t.nama_kelompok,
        jadwal: t.jadwal,
        jenis: 'tahsin',
        rincian: `${formatTahsinLevels(t)} · ${t.unit} · ${t.siswa.length} siswa · Sesi ${t.sesi}`,
        hasil: `${lulus}/${t.siswa.length} lulus`,
        hasilKelas: 'text-success font-medium',
      }
    })

    return [...tf, ...ts]
  }, [tahfidz, tahsin])

  // "Tanpa penguji" selalu di urutan terakhir — ia bukan nama orang, dan
  // menaruhnya di antara nama-nama membuat daftarnya sulit dibaca.
  const urutPenguji = (a: string, b: string) =>
    a === TANPA_PENGUJI ? 1 : b === TANPA_PENGUJI ? -1 : a.localeCompare(b)

  const namaPenguji = useMemo(
    () => [...new Set(baris.map(r => r.penguji))].sort(urutPenguji),
    [baris],
  )

  const tampil = saring === 'semua' ? baris : baris.filter(r => r.penguji === saring)

  const perPenguji = useMemo(() => {
    const peta = new Map<string, Baris[]>()
    for (const r of tampil) {
      const arr = peta.get(r.penguji) ?? []
      arr.push(r)
      peta.set(r.penguji, arr)
    }
    return [...peta.entries()].sort((a, b) => urutPenguji(a[0], b[0]))
  }, [tampil])

  return (
    <div className="space-y-4">
      <PilihPeriode month={month} year={year}>
        <select
          aria-label="Saring penguji"
          value={saring}
          onChange={e => setSaring(e.target.value)}
          className={`${PERIODE_SELECT_CLASS} w-full sm:w-56`}
        >
          <option value="semua">Semua penguji</option>
          {namaPenguji.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </PilihPeriode>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{tampil.length}</span> ujian selesai pada{' '}
        {BULAN_ID[month - 1]} {year}
      </p>

      {tampil.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center">
          <UserCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">Belum ada ujian selesai pada periode ini</p>
        </div>
      ) : (
        <div className="space-y-5">
          {perPenguji.map(([penguji, items]) => (
            <section key={penguji}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <UserCheck className="h-4 w-4 text-primary" />
                {penguji}
                <span className="font-normal text-muted-foreground">({items.length} ujian)</span>
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {items.map(r => (
                  <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium">
                        {r.jenis === 'tahfidz'
                          ? <BookOpen className="h-3.5 w-3.5 shrink-0 text-info" />
                          : <ClipboardList className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        <span className="truncate">{r.nama}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.rincian}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        Diuji {formatTanggal(r.jadwal)}
                      </p>
                    </div>
                    <span className={cn('shrink-0 text-right text-xs', r.hasilKelas)}>
                      {r.hasil}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
