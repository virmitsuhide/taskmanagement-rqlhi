'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Award, BookOpen, CalendarClock, ChevronDown, ChevronUp,
  ClipboardList, Settings2, UserCheck, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EditTahfidzDialog } from './EditTahfidzDialog'
import { EditTahsinDialog } from './EditTahsinDialog'
import { Segmen } from './Segmen'
import {
  TAHSIN_LEVELS,
  formatJadwalSingkat, formatTahsinLevels, formatTanggalSingkat,
  getPredikatClass, getPredikatLabel, getStatusLabel, getStatusVariant,
  getTahfidzLabel, getTahsinLevels, groupSiswaByLevel,
} from '@/lib/rq/ujian'
import type { UjianStatus, UjianTahfidz, UjianTahsin, UjianUnit } from '@/types'

interface Props {
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
  /** Unit yang boleh dikelola — menentukan tampil-tidaknya penyaring unit. */
  units: UjianUnit[]
  pengujiOptions: string[]
  /** Kunci "teacher:<id>" / "user:<id>" → nama pengaju. */
  namaPengaju: Record<string, string>
  /**
   * Tab yang dibuka lebih dulu. Datang dari ?jenis= di URL karena menu
   * sidebar "Ujian Tahsin" dan "Ujian Tahfidz" menunjuk halaman yang sama.
   */
  jenisAwal: Jenis
}

type SaringStatus = 'semua' | UjianStatus
type Jenis = 'tahfidz' | 'tahsin'

const STATUS_TABS: { value: SaringStatus; label: string }[] = [
  { value: 'semua',       label: 'Semua'       },
  { value: 'diajukan',    label: 'Diajukan'    },
  { value: 'dijadwalkan', label: 'Dijadwalkan' },
  { value: 'selesai',     label: 'Selesai'     },
]

const TIPE_TABS = [
  { value: 'semua', label: 'Semua' },
  { value: '1_juz', label: '1 Juz' },
  { value: '3_juz', label: '3 Juz' },
  { value: '5_juz', label: '5 Juz' },
] as const

function kunciPengaju(item: { created_by_teacher: string | null; created_by_user: string | null }) {
  if (item.created_by_teacher) return `teacher:${item.created_by_teacher}`
  if (item.created_by_user) return `user:${item.created_by_user}`
  return null
}

/** Penyaring yang berlaku untuk kedua jenis: status dan unit. */
function saringUmum<T extends { status: UjianStatus; unit: UjianUnit }>(
  items: T[],
  status: SaringStatus,
  unit: UjianUnit | 'semua',
) {
  return items.filter(i =>
    (status === 'semua' || i.status === status) &&
    (unit === 'semua' || i.unit === unit))
}

export function KelolaUjian({
  tahfidz, tahsin, units, pengujiOptions, namaPengaju, jenisAwal,
}: Props) {
  const router = useRouter()
  const [jenis, setJenis] = useState<Jenis>(jenisAwal)
  const [status, setStatus] = useState<SaringStatus>('semua')
  const [unit, setUnit] = useState<UjianUnit | 'semua'>('semua')
  const [tipe, setTipe] = useState<(typeof TIPE_TABS)[number]['value']>('semua')
  const [level, setLevel] = useState('semua')
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set())
  const [editTahfidz, setEditTahfidz] = useState<UjianTahfidz | null>(null)
  const [editTahsin, setEditTahsin] = useState<UjianTahsin | null>(null)

  function gantiJenis(baru: Jenis) {
    setJenis(baru)
    // URL ikut berubah supaya menyegarkan halaman tidak melempar balik ke tab
    // semula, dan tautan yang disalin membuka tab yang sedang dilihat.
    router.replace(`?jenis=${baru}`, { scroll: false })
  }

  function toggle(id: string) {
    setTerbuka(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const tfTampil = useMemo(
    () => saringUmum(tipe === 'semua' ? tahfidz : tahfidz.filter(t => t.tipe === tipe), status, unit),
    [tahfidz, tipe, status, unit],
  )

  // Level yang dikenal bergantung unit; saat kepala RQ melihat dua unit
  // sekaligus, keduanya digabung supaya tab levelnya tidak hilang sebelah.
  const levelDikenal = useMemo(
    () => [...new Set(units.flatMap(u => TAHSIN_LEVELS[u]))],
    [units],
  )

  const tsTampil = useMemo(() => {
    const dasar = saringUmum(tahsin, status, unit)
    if (level === 'semua') return dasar
    if (level === 'lainnya') {
      return dasar.filter(t => getTahsinLevels(t).some(l => !levelDikenal.includes(l)))
    }
    return dasar.filter(t => getTahsinLevels(t).includes(level))
  }, [tahsin, level, status, unit, levelDikenal])

  const lainnyaCount = tahsin.filter(t =>
    getTahsinLevels(t).some(l => !levelDikenal.includes(l))).length

  return (
    <div className="space-y-4">
      <Segmen
        label="Jenis ujian"
        value={jenis}
        onChange={gantiJenis}
        className="sm:w-96"
        options={[
          {
            value: 'tahfidz', label: 'Ujian Tahfidz', jumlah: tfTampil.length,
            icon: <BookOpen className="h-4 w-4" />,
          },
          {
            value: 'tahsin', label: 'Ujian Tahsin', jumlah: tsTampil.length,
            icon: <ClipboardList className="h-4 w-4" />,
          },
        ]}
      />

      {/* Penyaring status — dan unit, bila rolenya memegang keduanya */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BarisSaringan judul="Status">
          {STATUS_TABS.map(({ value, label }) => (
            <Chip key={value} aktif={status === value} onClick={() => setStatus(value)}>
              {label}
            </Chip>
          ))}
        </BarisSaringan>

        {units.length > 1 && (
          <BarisSaringan judul="Unit">
            <Chip aktif={unit === 'semua'} onClick={() => setUnit('semua')}>Semua</Chip>
            {units.map(u => (
              <Chip key={u} aktif={unit === u} onClick={() => setUnit(u)}>{u}</Chip>
            ))}
          </BarisSaringan>
        )}
      </div>

      {jenis === 'tahfidz' ? (
        <section className="space-y-3">
          <BarisSaringan judul="Tipe">
            {TIPE_TABS.map(({ value, label }) => (
              <Chip key={value} aktif={tipe === value} onClick={() => setTipe(value)} kecil>
                {label}
              </Chip>
            ))}
          </BarisSaringan>

          {tfTampil.length === 0 ? <Kosong /> : (
            <ul className="space-y-2">
              {tfTampil.map((item, i) => {
                const kunci = kunciPengaju(item)
                return (
                  <li key={item.id} className="rounded-xl border bg-card p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="mt-0.5 shrink-0 text-xs font-medium text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium">
                            {item.nama_siswa}
                            {item.is_quls && <Badge variant="info" className="ml-1.5 align-middle">QULS</Badge>}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.unit} · Kelas {item.kelas} · {getTahfidzLabel(item.tipe, item.juz)}
                          </p>
                          {kunci && namaPengaju[kunci] && (
                            <p className="mt-0.5 text-xs text-muted-foreground/70">
                              Diajukan oleh {namaPengaju[kunci]}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={getStatusVariant(item.status)} className="shrink-0">
                        {getStatusLabel(item.status)}
                      </Badge>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 gap-2 border-t pt-2.5 text-xs sm:grid-cols-3">
                      <Rincian icon={<CalendarClock className="h-3.5 w-3.5" />}
                        nilai={formatJadwalSingkat(item.jadwal)} ada={Boolean(item.jadwal)} />
                      <Rincian icon={<UserCheck className="h-3.5 w-3.5" />}
                        nilai={item.penguji || 'Penguji belum ditentukan'} ada={Boolean(item.penguji)} />
                      <Rincian icon={<Award className="h-3.5 w-3.5" />}
                        nilai={item.predikat ? getPredikatLabel(item.predikat) : 'Belum dinilai'}
                        ada={Boolean(item.predikat)}
                        kelas={item.predikat ? getPredikatClass(item.predikat) : undefined} />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2.5">
                      <span className="text-xs text-muted-foreground">
                        Masuk {formatTanggalSingkat(item.created_at)}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setEditTahfidz(item)}>
                        <Settings2 className="mr-1 h-3.5 w-3.5" /> Kelola
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <BarisSaringan judul="Level">
            <Chip aktif={level === 'semua'} onClick={() => setLevel('semua')} kecil>Semua</Chip>
            {levelDikenal.map(l => (
              <Chip key={l} aktif={level === l} onClick={() => setLevel(l)} kecil>{l}</Chip>
            ))}
            {lainnyaCount > 0 && (
              <Chip aktif={level === 'lainnya'} onClick={() => setLevel('lainnya')} kecil>
                Lainnya ({lainnyaCount})
              </Chip>
            )}
          </BarisSaringan>

          {tsTampil.length === 0 ? <Kosong /> : (
            <ul className="space-y-2">
              {tsTampil.map((item, i) => {
                const dibuka = terbuka.has(item.id)
                const lulus = item.siswa.filter(s => s.predikat === 'lulus').length
                const kunci = kunciPengaju(item)
                return (
                  <li key={item.id} className="rounded-xl border bg-card p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="mt-0.5 shrink-0 text-xs font-medium text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.nama_kelompok}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.unit} · {formatTahsinLevels(item)} · {item.siswa.length} siswa · Sesi {item.sesi}
                          </p>
                          {kunci && namaPengaju[kunci] && (
                            <p className="mt-0.5 text-xs text-muted-foreground/70">
                              Diajukan oleh {namaPengaju[kunci]}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={getStatusVariant(item.status)} className="shrink-0">
                        {getStatusLabel(item.status)}
                      </Badge>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 gap-2 border-t pt-2.5 text-xs sm:grid-cols-3">
                      <Rincian icon={<CalendarClock className="h-3.5 w-3.5" />}
                        nilai={formatJadwalSingkat(item.jadwal)} ada={Boolean(item.jadwal)} />
                      <Rincian icon={<UserCheck className="h-3.5 w-3.5" />}
                        nilai={item.penguji || 'Penguji belum ditentukan'} ada={Boolean(item.penguji)} />
                      <Rincian icon={<Award className="h-3.5 w-3.5" />}
                        nilai={item.status === 'selesai'
                          ? `${lulus}/${item.siswa.length} lulus`
                          : 'Belum dinilai'}
                        ada={item.status === 'selesai'}
                        kelas={item.status === 'selesai' ? 'text-success font-medium' : undefined} />
                    </div>

                    {dibuka && (
                      <div className="mt-2.5 space-y-3 border-t pt-2.5">
                        {groupSiswaByLevel(item).map(group => (
                          <div key={group.level}>
                            <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" /> {group.level} · {group.siswa.length} siswa
                            </p>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {group.siswa.map((s, idx) => (
                                <div key={`${s.nama}-${idx}`}
                                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                                  <span className="truncate">{s.nama}</span>
                                  <span className={cn('shrink-0 text-xs',
                                    s.predikat === 'lulus' ? 'text-success'
                                      : s.predikat === 'mengulang' ? 'text-destructive'
                                      : 'text-muted-foreground')}>
                                    {s.predikat === 'lulus' ? 'Lulus'
                                      : s.predikat === 'mengulang' ? 'Mengulang' : 'Belum'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2.5">
                      <button
                        onClick={() => toggle(item.id)}
                        aria-expanded={dibuka}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {dibuka ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {dibuka ? 'Sembunyikan anggota' : 'Lihat anggota'}
                      </button>
                      <Button size="sm" variant="outline" onClick={() => setEditTahsin(item)}>
                        <Settings2 className="mr-1 h-3.5 w-3.5" /> Kelola
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {editTahfidz && (
        <EditTahfidzDialog
          item={editTahfidz}
          pengujiOptions={pengujiOptions}
          onClose={() => setEditTahfidz(null)}
        />
      )}
      {editTahsin && (
        <EditTahsinDialog
          item={editTahsin}
          pengujiOptions={pengujiOptions}
          onClose={() => setEditTahsin(null)}
        />
      )}
    </div>
  )
}

/** Satu baris penyaring berlabel, mis. "Status: Semua / Diajukan / …". */
function BarisSaringan({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{judul}</span>
      {children}
    </div>
  )
}

function Chip({
  aktif, onClick, kecil, children,
}: {
  aktif: boolean
  onClick: () => void
  kecil?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={aktif}
      className={cn(
        'shrink-0 rounded-md border transition-colors',
        kecil ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs font-medium',
        aktif
          ? 'border-primary bg-primary/10 text-primary'
          : 'bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Rincian({
  icon, nilai, ada, kelas,
}: {
  icon: React.ReactNode
  nilai: string
  ada: boolean
  kelas?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground/50">{icon}</span>
      <span className={cn('truncate', kelas ?? (ada ? 'text-foreground' : 'text-muted-foreground'))}>
        {nilai}
      </span>
    </div>
  )
}

function Kosong() {
  return (
    <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
      Tidak ada pengajuan yang cocok dengan penyaring ini.
    </p>
  )
}
