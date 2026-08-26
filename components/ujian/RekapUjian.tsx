'use client'

import { useMemo, useState } from 'react'
import {
  BookOpen, ChevronDown, ChevronUp, ClipboardList, FileSpreadsheet, Trophy, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PilihPeriode } from './PilihPeriode'
import { Segmen } from './Segmen'
import {
  BULAN_ID,
  formatJadwal,
  formatTahsinLevels,
  getPredikatClass,
  getPredikatLabel,
  getTahfidzLabel,
  groupSiswaByLevel,
} from '@/lib/rq/ujian'
import type { UjianPredikat, UjianTahfidz, UjianTahsin, UjianUnit } from '@/types'

interface Props {
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
  month: number
  year: number
  /** Tombol ekspor hanya untuk pengurus — pengunjung publik tidak melihatnya. */
  bolehEkspor?: boolean
}

type Saringan = UjianUnit | 'Semua'

export function RekapUjian({ tahfidz, tahsin, month, year, bolehEkspor }: Props) {
  const [unit, setUnit] = useState<Saringan>('Semua')
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set())
  const [mengekspor, setMengekspor] = useState(false)

  function toggle(id: string) {
    setTerbuka(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /**
   * Modul xlsx baru diunduh saat tombolnya benar-benar ditekan.
   *
   * Kebanyakan orang membuka rekap untuk membaca, bukan mengunduh; memuatnya
   * di awal berarti setiap pengunjung menanggung ratusan kilobyte yang tak
   * pernah dipakai.
   */
  async function ekspor() {
    setMengekspor(true)
    try {
      const { exportRekapUjian } = await import('@/lib/rq/ujian-export')
      exportRekapUjian(tahfidz, tahsin, month, year)
    } finally {
      setMengekspor(false)
    }
  }

  const tfTampil = unit === 'Semua' ? tahfidz : tahfidz.filter(t => t.unit === unit)
  const tsTampil = unit === 'Semua' ? tahsin : tahsin.filter(t => t.unit === unit)
  const total = tahfidz.length + tahsin.length

  const predikatCount = useMemo(() => {
    const counts: Partial<Record<UjianPredikat, number>> = {}
    for (const t of tahfidz) {
      if (t.predikat) counts[t.predikat] = (counts[t.predikat] ?? 0) + 1
    }
    return counts
  }, [tahfidz])

  const tahsinLulus = useMemo(
    () => tahsin.reduce((n, t) => n + t.siswa.filter(s => s.predikat === 'lulus').length, 0),
    [tahsin],
  )
  const tahsinSiswa = useMemo(
    () => tahsin.reduce((n, t) => n + t.siswa.length, 0),
    [tahsin],
  )

  return (
    <div className="space-y-5">
      <PilihPeriode month={month} year={year} />

      {total === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">Belum ada ujian selesai</p>
          <p className="mt-1 text-xs text-muted-foreground">
            di {BULAN_ID[month - 1]} {year}
          </p>
        </div>
      ) : (
        <>
          {bolehEkspor && (
            <Button variant="outline" className="w-full" onClick={ekspor} disabled={mengekspor}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              {mengekspor ? 'Menyiapkan…' : 'Unduh rekap (Excel)'}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-2xl font-semibold">{tahfidz.length}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" /> Tahfidz selesai
              </p>
              {Object.keys(predikatCount).length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {(Object.entries(predikatCount) as [UjianPredikat, number][]).map(([p, n]) => (
                    <li key={p} className={cn('text-xs', getPredikatClass(p))}>
                      {getPredikatLabel(p)}: {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-2xl font-semibold">{tahsin.length}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" /> Kelompok tahsin selesai
              </p>
              {tahsinSiswa > 0 && (
                <p className="mt-2 text-xs text-success">
                  Lulus: {tahsinLulus} dari {tahsinSiswa} siswa
                </p>
              )}
            </div>
          </div>

          <Segmen
            label="Saring unit"
            value={unit}
            onChange={setUnit}
            className="sm:w-80"
            options={[
              { value: 'Semua', label: 'Semua' },
              { value: 'SD',    label: 'SD'    },
              { value: 'SMP',   label: 'SMP'   },
            ]}
          />

          {tfTampil.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="h-4 w-4 text-info" />
                Tahfidz <span className="font-normal text-muted-foreground">({tfTampil.length})</span>
              </h2>
              <div className="space-y-2">
                {tfTampil.map(item => (
                  <article key={item.id} className="rounded-xl border bg-card p-4">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.unit}</Badge>
                      {item.is_quls && <Badge variant="info">QULS</Badge>}
                      {item.predikat && (
                        <span className={cn('text-xs', getPredikatClass(item.predikat))}>
                          {getPredikatLabel(item.predikat)}
                        </span>
                      )}
                    </div>
                    <p className="font-medium">{item.nama_siswa}</p>
                    <p className="text-xs text-muted-foreground">
                      {getTahfidzLabel(item.tipe, item.juz)} · Kelas {item.kelas}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Ayah: {item.nama_ayah}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatJadwal(item.jadwal)}
                      {item.penguji && ` · ${item.penguji}`}
                    </p>
                    {item.catatan && (
                      <p className="mt-1.5 rounded-md bg-muted px-2 py-1 text-xs italic text-muted-foreground">
                        {item.catatan}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {tsTampil.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="h-4 w-4 text-primary" />
                Tahsin <span className="font-normal text-muted-foreground">({tsTampil.length})</span>
              </h2>
              <div className="space-y-2">
                {tsTampil.map(item => {
                  const dibuka = terbuka.has(item.id)
                  const lulus = item.siswa.filter(s => s.predikat === 'lulus').length
                  const mengulang = item.siswa.filter(s => s.predikat === 'mengulang').length

                  return (
                    <article key={item.id} className="rounded-xl border bg-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{item.unit}</Badge>
                            {lulus > 0 && <span className="text-xs text-success">{lulus} lulus</span>}
                            {mengulang > 0 && (
                              <span className="text-xs text-destructive">{mengulang} mengulang</span>
                            )}
                          </div>
                          <p className="font-medium">{item.nama_kelompok}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTahsinLevels(item)} · Sesi {item.sesi}
                          </p>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {formatJadwal(item.jadwal)}
                            {item.penguji && ` · ${item.penguji}`}
                          </p>
                        </div>
                        <button
                          onClick={() => toggle(item.id)}
                          aria-expanded={dibuka}
                          aria-label={dibuka ? 'Sembunyikan anggota' : 'Lihat anggota'}
                          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {dibuka ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {dibuka && (
                        <div className="mt-3 space-y-3 border-t pt-3">
                          {groupSiswaByLevel(item).map(group => (
                            <div key={group.level}>
                              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <Users className="h-3.5 w-3.5" /> {group.level} · {group.siswa.length} siswa
                              </p>
                              <ul className="space-y-1">
                                {group.siswa.map((s, i) => (
                                  <li key={`${s.nama}-${i}`} className="flex items-center justify-between text-sm">
                                    <span>{s.nama}</span>
                                    <span
                                      className={cn(
                                        'text-xs',
                                        s.predikat === 'lulus' ? 'text-success'
                                          : s.predikat === 'mengulang' ? 'text-destructive'
                                          : 'text-muted-foreground',
                                      )}
                                    >
                                      {s.predikat === 'lulus' ? 'Lulus'
                                        : s.predikat === 'mengulang' ? 'Mengulang' : '-'}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                          {item.catatan && (
                            <p className="rounded-md bg-muted px-2 py-1 text-xs italic text-muted-foreground">
                              {item.catatan}
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
