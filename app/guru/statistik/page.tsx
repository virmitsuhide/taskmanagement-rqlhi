import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Trophy, Zap } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import {
  getStatistikGuru, LABEL_PERIODE, type KodePeriode, type PeringkatSiswa,
} from '@/lib/data/statistik-guru'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

const URUTAN: KodePeriode[] = ['ta', 'semester', 'tigabulan', 'bulan', 'minggu']

export default async function GuruStatistikPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { periode: diminta } = await searchParams
  const kode: KodePeriode = URUTAN.includes(diminta as KodePeriode) ? (diminta as KodePeriode) : 'bulan'
  const s = await getStatistikGuru(session.teacherId, kode)
  const maks = Math.max(1, ...s.aktivitas.map(a => a.tahsin + a.tahfidz))
  // Tinggi batang dalam piksel, bukan persen: persen di dalam kolom flex tidak
  // punya tinggi acuan yang pasti dan batangnya kempis ke tinggi minimum.
  const TINGGI = 120
  const px = (n: number) => Math.max(3, Math.round((n / maks) * TINGGI))
  // Sebulan = ±22 batang; angka di bawah tiap batang bertumpuk di layar HP.
  // Di sana angkanya disembunyikan — tetap terbaca lewat tooltip batang.
  const rapat = s.aktivitas.length > 12

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Statistik</p>
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Statistik Mengajar
          </h1>
        </div>

        {/* Filter periode */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Periode">
            {URUTAN.map(k => (
              <Link
                key={k}
                href={`/guru/statistik?periode=${k}`}
                aria-current={k === kode ? 'page' : undefined}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  k === kode ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
                )}
              >
                {LABEL_PERIODE[k]}
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{s.periode.keterangan} · {s.jumlahSiswa.toLocaleString('id-ID')} siswa di halaqoh Anda</p>
        </div>

        {s.jumlahSiswa === 0 ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh aktif, atau halaqohnya belum berisi siswa.
          </div>
        ) : (
          <>
            {/* Ringkasan */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Setoran Tahsin" angka={s.ringkas.setoranTahsin} />
              <Kpi label="Setoran Tahfidz" angka={s.ringkas.setoranTahfidz} />
              <Kpi label="Siswa setor" angka={s.ringkas.siswaSetor} dari={s.jumlahSiswa} />
              <Kpi label="Naik jilid / juz" teks={`${s.ringkas.naikJilid.toLocaleString('id-ID')} / ${s.ringkas.naikJuz.toLocaleString('id-ID')}`} />
            </div>

            {/* Aktivitas */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">
                Aktivitas Setoran
                <span className="ml-1 font-normal text-muted-foreground">
                  · {kode === 'semester' || kode === 'tigabulan' ? 'per pekan' : kode === 'ta' ? 'per bulan' : 'per hari sekolah'}
                </span>
              </h2>
              {s.ringkas.setoranTahsin + s.ringkas.setoranTahfidz === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada setoran pada periode ini.</p>
              ) : (
                <>
                  <div className="flex items-end justify-between gap-1">
                    {s.aktivitas.map(a => {
                      const total = a.tahsin + a.tahfidz
                      return (
                        <div key={a.judul} className="flex-1 min-w-0 flex flex-col items-center gap-1" title={`${a.judul}: ${a.tahsin} tahsin, ${a.tahfidz} tahfidz`}>
                          <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: TINGGI }}>
                            {a.tahfidz > 0 && (
                              <div className="w-full rounded-t" style={{ height: px(a.tahfidz), background: 'var(--seri-2)' }} />
                            )}
                            {a.tahsin > 0 && (
                              <div className="w-full rounded-t" style={{ height: px(a.tahsin), background: 'var(--seri-1)' }} />
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate max-w-full">{a.label}</span>
                          <span className={cn('min-h-[15px] text-[10px] font-semibold tabular-nums', rapat && 'hidden sm:block')}>{total || null}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--seri-1)' }} /> Tahsin</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--seri-2)' }} /> Tahfidz</span>
                  </div>
                </>
              )}
            </section>

            {/* Tertinggi — capaian saat ini */}
            <div className="grid gap-4 md:grid-cols-2">
              <Peringkat
                ikon={<Trophy className="h-4 w-4 text-primary" />}
                judul="Tahsin Tertinggi"
                sub="Capaian akhir tahsin saat ini"
                daftar={s.tahsinTertinggi}
                tanpaBatang
                kosong="Belum ada siswa dengan posisi tahsin tercatat."
              />
              <Peringkat
                ikon={<Trophy className="h-4 w-4 text-primary" />}
                judul="Tahfidz Tertinggi"
                sub="Total hafalan saat ini, dalam halaman mushaf"
                daftar={s.tahfidzTertinggi}
                kosong="Belum ada hafalan yang terukur."
              />
            </div>

            {/* Tercepat — mengikuti periode */}
            <div className="grid gap-4 md:grid-cols-2">
              <Peringkat
                ikon={<Zap className="h-4 w-4 text-primary" />}
                judul="Tahsin Tercepat"
                sub={`Halaman tahsin lulus terbanyak · ${LABEL_PERIODE[kode].toLowerCase()}`}
                daftar={s.tahsinTercepat}
                kosong="Belum ada setoran tahsin lulus pada periode ini."
              />
              <Peringkat
                ikon={<Zap className="h-4 w-4 text-primary" />}
                judul="Tahfidz Tercepat"
                sub={`Halaman hafalan baru (ziyadah) terbanyak · ${LABEL_PERIODE[kode].toLowerCase()}`}
                daftar={s.tahfidzTercepat}
                kosong="Belum ada ziyadah pada periode ini."
              />
            </div>

            {/* Perhatian */}
            <p className="text-xs text-muted-foreground">
              Perhatian dihitung dari posisi anak <b>hari ini</b> terhadap targetnya, jadi tidak berubah mengikuti filter periode.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Perhatian Tahsin
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{s.perhatianTahsin.length} anak</span>
                </h2>
                <p className="text-[11px] text-muted-foreground mb-3">Posisi di bawah target tahsin semester kelasnya.</p>
                {s.perhatianTahsin.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Semua anak yang terukur sudah mencapai target. 🎉</p>
                ) : (
                  <ul className="divide-y">
                    {s.perhatianTahsin.map(p => (
                      <li key={p.id}>
                        <Link href={`/guru/siswa/${p.id}`} className="flex items-baseline gap-2 py-2 hover:bg-muted/30">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p.nama}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {p.kelas ? `Kelas ${p.kelas} · ` : ''}{p.posisi} → target {p.target}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-warning-wash px-2 py-0.5 text-[11px] text-warning">
                            kurang {p.kurang} tahap
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {s.tahsinTakTerukur > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {s.tahsinTakTerukur} anak tidak dinilai: posisi tahsin atau target kelasnya belum tercatat.
                  </p>
                )}
              </section>

              <section className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Perhatian Tahfidz
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{s.perhatianTahfidz.length} anak</span>
                </h2>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Hafalan tertinggal lebih dari 2 pekan dari target bulanan programnya.
                </p>
                {s.perhatianTahfidz.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada anak yang tertinggal dari target. 🎉</p>
                ) : (
                  <ul className="divide-y">
                    {s.perhatianTahfidz.map(p => (
                      <li key={p.id}>
                        <Link href={`/guru/siswa/${p.id}`} className="flex items-baseline gap-2 py-2 hover:bg-muted/30">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p.nama}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {p.kelas ? `Kelas ${p.kelas} · ` : ''}{p.capaian ?? '—'} → target {p.target ?? '—'}
                            </span>
                          </span>
                          {p.selisihPekan !== null && (
                            <span className="shrink-0 rounded-full bg-warning-wash px-2 py-0.5 text-[11px] text-warning">
                              {Math.abs(p.selisihPekan).toLocaleString('id-ID', { maximumFractionDigits: 1 })} pekan
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {s.tahfidzTakTerukur > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {s.tahfidzTakTerukur} anak tidak dinilai: belum ada ziyadah tercatat atau programnya tanpa target.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, angka, dari, teks }: { label: string; angka?: number; dari?: number; teks?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1.5 leading-none tabular-nums">
        {teks ?? (angka ?? 0).toLocaleString('id-ID')}
        {dari !== undefined && <span className="ml-1 text-sm font-normal text-muted-foreground">/ {dari.toLocaleString('id-ID')}</span>}
      </p>
    </div>
  )
}

function Peringkat({ ikon, judul, sub, daftar, kosong, tanpaBatang = false }: {
  ikon: React.ReactNode
  judul: string
  sub: string
  daftar: PeringkatSiswa[]
  kosong: string
  /** Untuk peringkat berupa posisi (Jilid 6, Lulus Tahsin) — batang tidak bermakna. */
  tanpaBatang?: boolean
}) {
  const maks = Math.max(1, ...daftar.map(d => d.nilai))
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold flex items-center gap-2">{ikon} {judul}</h2>
      <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">{sub}</p>
      {daftar.length === 0 ? (
        <p className="text-sm text-muted-foreground">{kosong}</p>
      ) : (
        <ol className="space-y-3">
          {daftar.map((d, i) => (
            <li key={d.id}>
              <Link href={`/guru/siswa/${d.id}`} className="block hover:opacity-80">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="w-4 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{d.nama}</span>
                  <span className="shrink-0 tabular-nums font-semibold">{d.nilaiTeks}</span>
                  {d.satuan && <span className="shrink-0 text-[11px] text-muted-foreground">{d.satuan}</span>}
                </div>
                {!tanpaBatang && (
                  <div className="ml-6 mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.nilai / maks) * 100}%`, background: 'var(--primary)' }} />
                  </div>
                )}
                <p className="ml-6 mt-0.5 text-[11px] text-muted-foreground truncate">
                  {[d.kelas ? `Kelas ${d.kelas}` : null, d.keterangan].filter(Boolean).join(' · ')}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
