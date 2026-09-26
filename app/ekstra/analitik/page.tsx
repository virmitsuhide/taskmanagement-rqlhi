import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarChart3, BookOpen, CalendarClock, Clock, Inbox, UserCheck, UsersRound, Wallet } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { getAnalitikEkstra } from '@/lib/data/ekstra-analitik'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { DashTop, GroupLabel, KpiCard, MonthStepper, Panel } from '@/components/dashboard/kit'

import { CapaianKelompokPanel } from '@/components/dashboard/CapaianKelompok'
import { PerbandinganEkstra } from '@/components/ekstra/PerbandinganEkstra'
import { getCapaianKelas } from '@/lib/data/capaian-kelas'
import type { Jenjang } from '@/types'
import { cn } from '@/lib/utils'

const SEMUA_UNIT: Jenjang[] = ['paud', 'sd', 'sd_juara', 'smp', 'sma']

const PATH = '/ekstra/analitik'
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function bulanIniWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date())
}
function geser(p: string, n: number): string {
  const [y, m] = p.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
const rupiahJuta = (n: number) => (n >= 1_000_000 ? `Rp ${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : `Rp ${n.toLocaleString('id-ID')}`)
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

/**
 * Analitik Ekstra — dibaca Koordinator Ekstra (dan Kepala RQ): berapa yang
 * ikut, dari mana permintaan datang, kapan guru paling dibutuhkan, halaqoh
 * mana yang penuh atau kosong, dan permintaan mana yang terlalu lama menunggu.
 */
export default async function AnalitikEkstraPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const kini = bulanIniWIB()
  const diminta = (await searchParams).bulan
  const bulan = diminta && /^\d{4}-(0[1-9]|1[0-2])$/.test(diminta) && diminta <= kini ? diminta : kini
  const a = await getAnalitikEkstra(bulan)
  // Capaian dihitung dengan aturan yang sama dengan Analitik RQ: sekali untuk
  // peserta ekstra saja, sekali untuk seluruh angkatan sebagai pembanding.
  const [capEkstra, capSemua] = a.idSiswaLhi.length
    ? await Promise.all([getCapaianKelas(SEMUA_UNIT, { hanyaSiswa: a.idSiswaLhi }), getCapaianKelas(SEMUA_UNIT)])
    : [null, null]
  const kelompokEkstra = (capEkstra?.kelompok ?? []).filter(x => x.siswa > 0)
  const k = a.kpi
  const [y, m] = bulan.split('-').map(Number)
  const namaBulan = `${BULAN[m - 1]} ${y}`

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Analitik Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <DashTop
          eyebrow="Ekstra tahsin & tahfidz · analitik"
          title="Analitik Ekstra"
          context={<>Peserta & halaqoh per hari ini · kehadiran, setoran, dan permintaan: {namaBulan}</>}
          filters={<MonthStepper label="Bulan" current={namaBulan}
            prevHref={`${PATH}?bulan=${geser(bulan, -1)}`}
            nextHref={bulan < kini ? `${PATH}?bulan=${geser(bulan, 1)}` : null} />}
        />
        <EkstraSubNav />

        {!a.tabelAda ? <MigrasiEkstra /> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={<UsersRound className="h-3.5 w-3.5" />} label="Peserta aktif" value={k.pesertaAktif}
                sub={`${k.pesertaLhi} siswa LHI · ${k.pesertaNon} non siswa`} href="/ekstra/halaqoh" />
              <KpiCard icon={<CalendarClock className="h-3.5 w-3.5" />} label="Halaqoh berjalan" value={k.halaqoh}
                sub={`${k.guru} guru pengampu`} href="/ekstra/halaqoh" />
              <KpiCard icon={<Inbox className="h-3.5 w-3.5" />} label="Permintaan masuk" value={k.permintaanBulanIni}
                sub={k.menunggu ? `${k.menunggu} masih menunggu ditangani` : 'Tidak ada yang menunggu'} href="/ekstra" tone={k.menunggu ? 'warning' : undefined} />
              <KpiCard icon={<Wallet className="h-3.5 w-3.5" />} label="Estimasi pemasukan / bulan" value={rupiahJuta(k.pemasukanBulanan)}
                sub={k.pesertaTanpaBiayaBulanan ? `${k.pesertaTanpaBiayaBulanan} peserta di luar tarif bulanan` : 'Tarif jenis × peserta aktif; keluarga per keluarga'} />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={<UserCheck className="h-3.5 w-3.5" />} label="Permintaan diterima" value={k.diputus ? `${pct(k.diterima, k.diputus)}%` : '—'}
                sub={k.diputus ? `${k.diterima} dari ${k.diputus} yang diputuskan, 90 hari` : 'Belum ada permintaan dari formulir yang diputuskan'}
                ratio={k.diputus ? k.diterima / k.diputus : undefined} />
              <KpiCard icon={<Clock className="h-3.5 w-3.5" />} label="Lama menanggapi" value={k.tanggapHari === null ? '—' : `${k.tanggapHari.toLocaleString('id-ID', { maximumFractionDigits: 1 })} hari`}
                sub={k.tanggapHari === null ? 'Belum ada permintaan yang ditangani bulan ini' : 'Median, dari masuk sampai ditangani'} />
              <KpiCard icon={<UsersRound className="h-3.5 w-3.5" />} label="Kehadiran" value={k.catatanHadir ? `${pct(k.hadir, k.catatanHadir)}%` : '—'}
                sub={k.catatanHadir ? `${k.hadir} hadir dari ${k.catatanHadir} catatan` : 'Guru belum mencatat kehadiran bulan ini'}
                ratio={k.catatanHadir ? k.hadir / k.catatanHadir : undefined} />
              <KpiCard icon={<BarChart3 className="h-3.5 w-3.5" />} label="Setoran ekstra" value={k.setoran}
                sub="Setoran tahsin & tahfidz bertanda ekstra (siswa LHI)" />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-7" title="Tren 6 bulan" icon={<BarChart3 className="h-4 w-4" />}
                sub="Permintaan dari formulir, peserta mulai, dan peserta berhenti per bulan">
                <Tren data={a.tren} />
              </Panel>
              <Panel className="lg:col-span-5" title="Permintaan menurut waktu" icon={<CalendarClock className="h-4 w-4" />}
                sub="Hari & bagian hari yang dipilih orang tua — kapan guru paling dibutuhkan">
                {a.permintaanHari.every(x => x.jumlah === 0) ? (
                  <p className="text-sm text-muted-foreground">Belum ada permintaan lewat formulir baru (dengan pilihan waktu).</p>
                ) : (
                  <div className="space-y-4">
                    <Batang data={a.permintaanHari.map(x => ({ label: x.label, nilai: x.jumlah }))} satuan="permintaan" />
                    <Batang data={a.permintaanBagian.map(x => ({ label: x.label, nilai: x.jumlah }))} satuan="permintaan" />
                  </div>
                )}
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-6" title="Peserta per jenis" icon={<UsersRound className="h-4 w-4" />}
                sub="Peserta aktif / kapasitas halaqoh yang berjalan">
                {a.perJenis.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada peserta aktif.</p> : (
                  <ul className="space-y-3">
                    {a.perJenis.map(j => (
                      <li key={j.nama}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium">{j.nama}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground"><b className="text-foreground">{j.peserta}</b>/{j.kuota} · {j.halaqoh} halaqoh</span>
                        </div>
                        <Bar n={j.peserta} d={j.kuota} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel className="lg:col-span-6" title="Beban guru pengampu" icon={<UsersRound className="h-4 w-4" />}
                sub="Peserta aktif & jumlah halaqoh per guru">
                {a.perGuru.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada halaqoh berjalan.</p> : (
                  <Batang data={a.perGuru.map(g => ({ label: g.nama, nilai: g.peserta, ket: `${g.halaqoh} halaqoh` }))} satuan="peserta" />
                )}
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-7" title="Keterisian halaqoh" icon={<CalendarClock className="h-4 w-4" />}
                sub={`${a.keterisian.filter(h => h.peserta >= h.kuota).length} penuh · ${a.keterisian.filter(h => h.peserta === 0).length} kosong dari ${a.keterisian.length} halaqoh`}
                action={{ href: '/ekstra/halaqoh', label: 'Semua halaqoh' }}>
                {a.keterisian.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada halaqoh berjalan.</p> : (
                  <ul className="max-h-[420px] divide-y overflow-y-auto">
                    {[...a.keterisian].sort((x, z) => x.peserta / x.kuota - z.peserta / z.kuota).map(h => (
                      <li key={h.id}>
                        <Link href={`/ekstra/halaqoh/${h.id}`} className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-3 py-2 hover:bg-muted/40">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{h.nama}</span>
                            <span className="block truncate text-xs text-muted-foreground">{h.jadwal} · {h.jenis}</span>
                          </span>
                          <span>
                            <span className={cn('block text-right text-xs tabular-nums', h.peserta >= h.kuota ? 'font-semibold text-primary' : h.peserta === 0 ? 'text-warning' : '')}>
                              {h.peserta}/{h.kuota}{h.peserta >= h.kuota ? ' penuh' : h.peserta === 0 ? ' kosong' : ''}
                            </span>
                            <Bar n={h.peserta} d={h.kuota} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel className="lg:col-span-5" title="Menunggu lebih dari 3 hari" icon={<Inbox className="h-4 w-4" />}
                sub="Permintaan yang belum dimasukkan ke halaqoh atau belum dijawab orang tua" action={{ href: '/ekstra', label: 'Kotak masuk' }}>
                {a.menungguLama.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada permintaan yang tertahan. </p> : (
                  <ul className="divide-y">
                    {a.menungguLama.map(x => (
                      <li key={x.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0"><span className="block truncate font-medium">{x.nama}</span><span className="block truncate text-xs text-muted-foreground">{x.jenis} · {x.status === 'ditawarkan' ? 'menunggu balasan ortu' : 'belum ditangani'}</span></span>
                        <span className="shrink-0 font-semibold tabular-nums text-warning">{x.hari} hari</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <GroupLabel note="Posisi menurut setoran terakhir (sekolah maupun ekstra) · target = target kelas angkatannya">Capaian peserta ekstra — siswa LHI</GroupLabel>
            {kelompokEkstra.length === 0 ? (
              <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
                Belum ada peserta ekstra aktif yang tertaut ke data siswa LHI. Tautkan siswanya saat memasukkan ke halaqoh ekstra.
              </p>
            ) : (
              <>
                <PerbandinganEkstra pasangan={kelompokEkstra.map(x => ({ ekstra: x, angkatan: capSemua?.kelompok.find(z => z.kode === x.kode) }))} />
                {kelompokEkstra.map(x => (
                  <div key={x.kode} className="space-y-4">
                    <GroupLabel note={`${x.siswa.toLocaleString('id-ID')} peserta ekstra${x.metode.length ? ` · metode ${x.metode.join(', ')}` : ''}`}>{x.judul}</GroupLabel>
                    <CapaianKelompokPanel k={x} />
                  </div>
                ))}
              </>
            )}

            <Panel title="Capaian peserta non siswa LHI" icon={<BookOpen className="h-4 w-4" />}
              sub="Tanpa target — posisi bacaan terakhir yang dicatat di halaqoh ekstra">
              {a.nonLhi.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada peserta aktif dari luar LHI.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-muted-foreground">
                        <th className="pb-2 font-medium">Nama</th>
                        <th className="pb-2 font-medium">Jenis</th>
                        <th className="pb-2 font-medium">Halaqoh</th>
                        <th className="pb-2 font-medium">Posisi bacaan</th>
                        <th className="pb-2 text-right font-medium">Hadir {namaBulan}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.nonLhi.map(p => (
                        <tr key={p.id} className="border-t align-top">
                          <td className="py-2 pr-3">
                            <span className="block font-medium">{p.nama}</span>
                            <span className="block text-xs text-muted-foreground">{[p.keterangan, p.asal].filter(Boolean).join(' · ')}</span>
                          </td>
                          <td className="py-2 pr-3 text-xs">{p.jenis}</td>
                          <td className="py-2 pr-3 text-xs">{p.halaqoh}</td>
                          <td className="py-2 pr-3">{p.posisi || <span className="text-muted-foreground">Belum dicatat</span>}</td>
                          <td className="py-2 text-right tabular-nums">{p.pertemuan ? `${p.hadir}/${p.pertemuan}` : <span className="text-muted-foreground">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}

function Bar({ n, d }: { n: number; d: number }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${d > 0 ? Math.min(100, (n / d) * 100) : 0}%`, background: 'var(--primary)' }} />
    </div>
  )
}

/** Batang horizontal satu seri; lebar relatif terhadap nilai terbesar. */
function Batang({ data, satuan }: { data: { label: string; nilai: number; ket?: string }[]; satuan: string }) {
  const maks = Math.max(1, ...data.map(x => x.nilai))
  return (
    <ul className="space-y-2">
      {data.map(x => (
        <li key={x.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
          <span className="truncate" title={x.label}>{x.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${(x.nilai / maks) * 100}%`, background: 'var(--primary)' }} />
          </span>
          <span className="tabular-nums text-muted-foreground" title={`${x.nilai} ${satuan}`}><b className="text-foreground">{x.nilai}</b>{x.ket ? ` · ${x.ket}` : ''}</span>
        </li>
      ))}
    </ul>
  )
}

/** Tiga seri per bulan sebagai kolom berdampingan (bukan bertumpuk: bukan bagian dari satu keseluruhan). */
function Tren({ data }: { data: { label: string; masuk: number; mulai: number; berhenti: number }[] }) {
  const maks = Math.max(1, ...data.flatMap(d => [d.masuk, d.mulai, d.berhenti]))
  const seri = [
    { k: 'masuk' as const, label: 'Permintaan masuk', warna: 'var(--chart-1)' },
    { k: 'mulai' as const, label: 'Peserta mulai', warna: 'var(--chart-2)' },
    { k: 'berhenti' as const, label: 'Berhenti', warna: 'var(--chart-4)' },
  ]
  if (data.every(d => !d.masuk && !d.mulai && !d.berhenti)) return <p className="text-sm text-muted-foreground">Belum ada pergerakan dalam 6 bulan ini.</p>
  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {data.map(d => (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end justify-center gap-0.5">
              {seri.map(s => (
                <div key={s.k} title={`${d.label} · ${s.label}: ${d[s.k]}`} className="w-1/4 max-w-4 rounded-t"
                  style={{ height: `${(d[s.k] / maks) * 100}%`, minHeight: d[s.k] ? 2 : 0, background: s.warna }} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {seri.map(s => <span key={s.k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.warna }} />{s.label}</span>)}
      </div>
    </div>
  )
}
