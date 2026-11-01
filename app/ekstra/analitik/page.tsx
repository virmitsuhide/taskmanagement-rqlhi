import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarChart3, BookOpen, CalendarClock, ClipboardCheck, Clock, Inbox, UserCheck, UsersRound, Wallet } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra, canViewEkstraAnalitik } from '@/lib/auth/permissions'
import { getAnalitikEkstra, type KelengkapanGuruEkstra } from '@/lib/data/ekstra-analitik'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { GroupLabel, KpiCard, MonthStepper, Panel } from '@/components/dashboard/kit'

import { CapaianKelompokPanel } from '@/components/dashboard/CapaianKelompok'
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
 * Analitik Ekstra — dibaca Koordinator Ekstra, Kepala RQ, dan Kumik: berapa yang
 * ikut, dari mana permintaan datang, kapan guru paling dibutuhkan, halaqoh
 * mana yang penuh atau kosong, dan permintaan mana yang terlalu lama menunggu.
 * Kumik hanya membaca: menu & tautan ke halaman kelola ekstra disembunyikan.
 */
export default async function AnalitikEkstraPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewEkstraAnalitik(session.role)) redirect('/dashboard')
  const kelola = canManageEkstra(session.role)
  /** Tautan ke halaman kelola ekstra — hanya untuk yang boleh membukanya. */
  const ke = (href: string) => (kelola ? href : undefined)
  const aksi = (href: string, label: string) => (kelola ? { href, label } : undefined)

  const kini = bulanIniWIB()
  const diminta = (await searchParams).bulan
  const bulan = diminta && /^\d{4}-(0[1-9]|1[0-2])$/.test(diminta) && diminta <= kini ? diminta : kini
  const a = await getAnalitikEkstra(bulan)
  // Capaian dihitung dengan aturan yang sama dengan Analitik RQ, hanya untuk peserta ekstra.
  const capEkstra = a.idSiswaLhi.length ? await getCapaianKelas(SEMUA_UNIT, { hanyaSiswa: a.idSiswaLhi, pengampuTambahan: [{ label: 'ekstra', nama: a.pengampuEkstra }] }) : null
  const kelompokEkstra = (capEkstra?.kelompok ?? []).filter(x => x.siswa > 0)
  const k = a.kpi
  const [y, m] = bulan.split('-').map(Number)
  const namaBulan = `${BULAN[m - 1]} ${y}`

  const judul = k.menunggu && a.menungguLama.length
    ? <>Ekstra {namaBulan.split(' ')[0]} — <i>{a.menungguLama.length} permintaan menunggu lebih dari tiga hari.</i></>
    : <>Ekstra {namaBulan.split(' ')[0]}: {k.pesertaAktif} peserta di {k.halaqoh} halaqoh.</>
  const penuh = a.keterisian.filter(h => h.peserta >= h.kuota).length
  const kosong = a.keterisian.filter(h => h.peserta === 0).length
  const sebagian = a.keterisian.length - penuh - kosong
  const masihAda = [...a.keterisian].filter(h => h.peserta < h.kuota).sort((x, z) => x.peserta / x.kuota - z.peserta / z.kuota)
  const trenLalu = a.tren[a.tren.length - 2]

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Analitik Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · analitik</p>
            <h1 className="mt-1 max-w-3xl font-heading text-3xl leading-tight md:text-[38px]">{judul}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Peserta &amp; halaqoh per hari ini · kehadiran, setoran, dan permintaan: {namaBulan}</p>
          </div>
          <MonthStepper label="Bulan" current={namaBulan}
            prevHref={`${PATH}?bulan=${geser(bulan, -1)}`}
            nextHref={bulan < kini ? `${PATH}?bulan=${geser(bulan, 1)}` : null} />
        </div>
        {kelola && <EkstraSubNav />}

        {!a.tabelAda ? <MigrasiEkstra /> : (
          <>
            <Bagian no="01" judul="Permintaan" tanya="Seberapa cepat orang tua mendapat jawaban?" ket="Dari formulir · impor lama tidak dihitung" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={<Inbox className="h-3.5 w-3.5" />} label="Permintaan masuk" value={k.permintaanBulanIni}
                sub={trenLalu ? `dari formulir · ${trenLalu.masuk} di ${trenLalu.label}` : 'dari formulir'} href={ke('/ekstra')} />
              <KpiCard icon={<UserCheck className="h-3.5 w-3.5" />} label="Diterima" value={k.diputus ? `${pct(k.diterima, k.diputus)}%` : '—'}
                sub={k.diputus ? `${k.diterima} dari ${k.diputus} yang diputuskan · 90 hari` : 'Belum ada permintaan yang diputuskan'}
                ratio={k.diputus ? k.diterima / k.diputus : undefined} />
              <KpiCard icon={<Clock className="h-3.5 w-3.5" />} label="Lama menanggapi" value={k.tanggapHari === null ? '—' : `${k.tanggapHari.toLocaleString('id-ID', { maximumFractionDigits: 1 })} hari`}
                sub={k.tanggapHari === null ? 'Belum ada yang ditangani bulan ini' : 'Median, masuk → ditangani'} />
              <KpiCard icon={<Inbox className="h-3.5 w-3.5" />} label="Menunggu > 3 hari" value={a.menungguLama.length}
                sub={a.menungguLama.length ? a.menungguLama.slice(0, 2).map(x => `${x.nama} ${x.hari} hari`).join(' · ') : 'Tidak ada yang tertahan'}
                href={ke('/ekstra')} tone={a.menungguLama.length ? 'destructive' : undefined} />
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-7" title="Tren 6 bulan" icon={<BarChart3 className="h-4 w-4" />}
                sub="Kolom berdampingan — tiga hitungan terpisah, bukan bagian dari satu keseluruhan">
                <Tren data={a.tren} />
              </Panel>
              <Panel className="lg:col-span-5" title="Kapan orang tua meminta" icon={<CalendarClock className="h-4 w-4" />}
                sub="Satu permintaan boleh memilih lebih dari satu hari">
                {a.permintaanHari.every(x => x.jumlah === 0) ? (
                  <p className="text-sm text-muted-foreground">Belum ada permintaan lewat formulir baru (dengan pilihan waktu).</p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Hari</p>
                    <Batang data={a.permintaanHari.map(x => ({ label: x.label, nilai: x.jumlah }))} satuan="permintaan" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Bagian hari</p>
                    <Batang data={a.permintaanBagian.map(x => ({ label: x.label, nilai: x.jumlah }))} satuan="permintaan" warna="var(--accent-warm)" />
                  </div>
                )}
              </Panel>
            </div>

            <Bagian no="02" judul="Halaqoh & guru" tanya="Di mana kursi masih ada, dan siapa yang paling sibuk?" ket={`Per hari ini · ${k.halaqoh} halaqoh · ${k.pesertaAktif} peserta`} />
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
                sub="Peserta aktif & jumlah halaqoh per guru" action={aksi('/ekstra/guru', 'Guru ekstra')}>
                {a.perGuru.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada halaqoh berjalan.</p> : (
                  <Batang data={a.perGuru.map(g => ({ label: g.nama, nilai: g.peserta, ket: `${g.halaqoh} halaqoh` }))} satuan="peserta" />
                )}
              </Panel>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-7" title="Keterisian halaqoh" icon={<CalendarClock className="h-4 w-4" />}
                sub="Yang masih punya kursi, dari paling kosong" action={aksi('/ekstra/halaqoh', 'Semua halaqoh')}>
                {a.keterisian.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada halaqoh berjalan.</p> : (
                  <>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      {[{ n: penuh, l: 'penuh', k: 'bg-primary-wash text-primary' }, { n: sebagian, l: 'sebagian terisi', k: 'bg-muted' }, { n: kosong, l: 'belum ada peserta', k: 'bg-accent-warm-wash text-accent-warm' }].map(x => (
                        <div key={x.l} className={cn('rounded-xl px-3.5 py-3', x.k)}>
                          <p className="font-heading text-[28px] leading-none tabular-nums">{x.n}</p>
                          <p className="mt-1 text-xs font-semibold">{x.l}</p>
                        </div>
                      ))}
                    </div>
                    {masihAda.length === 0 ? <p className="text-sm text-muted-foreground">Semua halaqoh sudah penuh.</p> : (
                      <ul className="max-h-[360px] divide-y overflow-y-auto">
                        {masihAda.map(h => (
                          <li key={h.id}>
                            <Tautan href={ke(`/ekstra/halaqoh/${h.id}`)} className="grid grid-cols-[minmax(0,1fr)_130px] items-center gap-3 py-2 hover:bg-muted/40">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{h.nama} · {h.jadwal}</span>
                                <span className="block truncate text-xs text-muted-foreground">{h.jenis}</span>
                              </span>
                              <span>
                                <span className={cn('block text-right text-xs tabular-nums', h.peserta === 0 && 'text-accent-warm')}>{h.peserta}/{h.kuota}</span>
                                <Bar n={h.peserta} d={h.kuota} />
                              </span>
                            </Tautan>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </Panel>
              <Panel className="lg:col-span-5" title="Menunggu lebih dari 3 hari" icon={<Inbox className="h-4 w-4" />}
                sub="Belum dimasukkan ke halaqoh atau belum dijawab orang tua" action={aksi('/ekstra', 'Kotak masuk')}>
                {a.menungguLama.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada permintaan yang tertahan.</p> : (
                  <ul className="divide-y">
                    {a.menungguLama.map(x => (
                      <li key={x.id}>
                        <Tautan href={ke(`/ekstra?${x.status === 'ditawarkan' ? 'status=ditawarkan&' : ''}id=${x.id}`)} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-muted/40">
                          <span className="min-w-0"><span className="block truncate font-bold">{x.nama}</span><span className="block truncate text-xs text-muted-foreground">{x.jenis} · {x.status === 'ditawarkan' ? 'menunggu balasan ortu' : 'belum ditangani'}</span></span>
                          <span className="shrink-0"><span className="font-heading text-xl tabular-nums text-destructive">{x.hari}</span> <span className="text-xs text-muted-foreground">hari</span></span>
                        </Tautan>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Bagian no="03" judul="Kehadiran & setoran" tanya="Apakah ekstra benar-benar berjalan?" ket={namaBulan} />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={<UsersRound className="h-3.5 w-3.5" />} label="Kehadiran" value={k.catatanHadir ? `${pct(k.hadir, k.catatanHadir)}%` : '—'}
                sub={k.catatanHadir ? `${k.hadir} hadir dari ${k.catatanHadir} catatan` : 'Guru belum mencatat kehadiran'}
                ratio={k.catatanHadir ? k.hadir / k.catatanHadir : undefined} />
              <KpiCard icon={<BarChart3 className="h-3.5 w-3.5" />} label="Setoran ekstra" value={k.setoran}
                sub={`tahsin ${k.setoranTahsin} · tahfidz ${k.setoranTahfidz} · siswa LHI${k.setoranLuarTahsin + k.setoranLuarTahfidz ? ` · +${k.setoranLuarTahsin + k.setoranLuarTahfidz} non-LHI` : ''}`} />
              <KpiCard icon={<CalendarClock className="h-3.5 w-3.5" />} label="Pertemuan tanpa presensi" value={k.tanpaPresensi}
                sub="Jadwal yang sudah lewat, belum ada presensinya" tone={k.tanpaPresensi ? 'warning' : undefined} href={ke('/ekstra/halaqoh')} />
              <KpiCard icon={<UsersRound className="h-3.5 w-3.5" />} label="Berhenti" value={k.berhentiBulanIni}
                sub={`peserta berhenti · ${namaBulan}`} />
            </div>

            <Panel title="Kelengkapan pengisian guru ekstra" icon={<ClipboardCheck className="h-4 w-4" />}
              sub="Jadwal yang sudah lewat dan punya presensi atau setoran. Ada setoran = hadir, jadi guru yang hanya menyetor sudah terhitung mengisi. Paling belum lengkap di atas; buka nama guru untuk tanggal yang kosong.">
              <KelengkapanGuru data={a.kelengkapan} namaBulan={namaBulan} keHalaqoh={id => ke(`/ekstra/halaqoh/${id}`)} />
            </Panel>

            <Bagian no="04" judul="Capaian" tanya="Di jilid dan juz mana peserta ekstra berada, dan berapa yang sudah mencapai target kelasnya?" ket="Siswa LHI yang tertaut" />
            {kelompokEkstra.length === 0 ? (
              <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
                Belum ada peserta ekstra aktif yang tertaut ke data siswa LHI. Tautkan siswanya saat memasukkan ke halaqoh ekstra.
              </p>
            ) : (
              <div className="space-y-6">
                {kelompokEkstra.map(x => (
                  <div key={x.kode} className="space-y-4">
                    <GroupLabel note={`${x.siswa.toLocaleString('id-ID')} peserta ekstra${x.metode.length ? ` · metode ${x.metode.join(', ')}` : ''}`}>{x.judul}</GroupLabel>
                    <CapaianKelompokPanel k={x} />
                  </div>
                ))}
              </div>
            )}
            <Panel title="Peserta dari luar LHI" icon={<BookOpen className="h-4 w-4" />}
              sub="Tanpa target — posisi bacaan terakhir yang dicatat di halaqoh ekstra">
              {a.nonLhi.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada peserta aktif dari luar LHI.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        <th className="pb-2 font-bold">Nama</th>
                        <th className="pb-2 font-bold">Jenis</th>
                        <th className="pb-2 font-bold">Halaqoh</th>
                        <th className="pb-2 font-bold">Posisi bacaan</th>
                        <th className="pb-2 text-right font-bold">Hadir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.nonLhi.map(p => (
                        <tr key={p.id} className="border-t align-top">
                          <td className="py-2 pr-3">
                            <span className="block font-semibold">{p.nama}</span>
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

            <Bagian no="05" judul="Pemasukan" tanya="Berapa perkiraan yang masuk tiap bulan?" ket="Estimasi, bukan catatan kas" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <section className="flex flex-col gap-2 rounded-2xl bg-[#0E3531] p-6 text-white lg:col-span-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#F2B27A]">Estimasi pemasukan / bulan</p>
                <p className="font-heading text-5xl leading-none">{rupiahJuta(k.pemasukanBulanan)}</p>
                <p className="text-sm leading-relaxed text-white/80">
                  Tarif jenis × peserta aktif. Privat Keluarga dihitung per keluarga, bukan per anak.
                  {k.pesertaTanpaBiayaBulanan ? ` ${k.pesertaTanpaBiayaBulanan} peserta di luar tarif bulanan tidak dihitung.` : ''}
                </p>
              </section>
              <Panel className="lg:col-span-7" title="Menurut jenis" icon={<Wallet className="h-4 w-4" />}>
                {a.pemasukanPerJenis.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada peserta dengan tarif bulanan.</p> : (
                  <Batang data={a.pemasukanPerJenis.map(x => ({ label: x.nama, nilai: x.jumlah, tampil: rupiahJuta(x.jumlah), ket: x.rumus }))} satuan="rupiah" warna="var(--accent-warm)" />
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const tglPendek = (t: string) => {
  const [, m, d] = t.split('-').map(Number)
  return `${d} ${BULAN[m - 1].slice(0, 3)}`
}

/**
 * Kelengkapan pengisian per guru → per halaqoh. Rincian dibuka dengan
 * <details> (tanpa JS klien). Halaqoh yang tidak terisi sama sekali ditandai
 * terpisah: bisa jadi halaqohnya tidak berjalan atau jadwalnya berubah,
 * bukan sekadar guru lupa.
 */
function KelengkapanGuru({ data, namaBulan, keHalaqoh }: { data: KelengkapanGuruEkstra[]; namaBulan: string; keHalaqoh: (id: string) => string | undefined }) {
  const adaJadwal = data.filter(g => g.jadwal > 0)
  if (adaJadwal.length === 0) return <p className="text-sm text-muted-foreground">Belum ada jadwal halaqoh ekstra yang lewat di {namaBulan}.</p>
  const jadwal = adaJadwal.reduce((n, g) => n + g.jadwal, 0)
  const terisi = adaJadwal.reduce((n, g) => n + g.terisi, 0)
  const halaqoh = adaJadwal.flatMap(g => g.halaqoh).filter(h => h.jadwal > 0)
  const nihil = halaqoh.filter(h => h.terisi === 0).length
  const lengkap = adaJadwal.filter(g => g.terisi === g.jadwal).length
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { n: `${pct(terisi, jadwal)}%`, l: `${terisi.toLocaleString('id-ID')} dari ${jadwal.toLocaleString('id-ID')} jadwal terisi`, k: 'bg-primary-wash text-primary' },
          { n: (jadwal - terisi).toLocaleString('id-ID'), l: 'jadwal kosong', k: 'bg-muted' },
          { n: lengkap.toLocaleString('id-ID'), l: `dari ${adaJadwal.length} guru lengkap`, k: 'bg-muted' },
          { n: nihil.toLocaleString('id-ID'), l: 'halaqoh tanpa isian sebulan', k: nihil ? 'bg-accent-warm-wash text-accent-warm' : 'bg-muted' },
        ].map(x => (
          <div key={x.l} className={cn('rounded-xl px-3.5 py-3', x.k)}>
            <p className="font-heading text-[28px] leading-none tabular-nums">{x.n}</p>
            <p className="mt-1 text-xs font-semibold">{x.l}</p>
          </div>
        ))}
      </div>
      <ul className="divide-y">
        {adaJadwal.map(g => {
          const kosong = g.jadwal - g.terisi
          return (
            <li key={g.teacherId}>
              <details className="group">
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_96px] items-center gap-3 py-2.5 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_160px_120px] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{g.nama}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {g.halaqoh.length} halaqoh · {g.terakhir ? `terakhir mengisi ${tglPendek(g.terakhir)}` : `belum mengisi di ${namaBulan}`}
                    </span>
                  </span>
                  <span className="hidden sm:block"><Bar n={g.terisi} d={g.jadwal} /></span>
                  <span className="text-right text-xs tabular-nums">
                    <b className={cn('text-sm', g.terisi === 0 ? 'text-accent-warm' : 'text-foreground')}>{g.terisi}/{g.jadwal}</b>
                    <span className="block text-muted-foreground">{kosong ? `${kosong} kosong` : 'lengkap'}</span>
                  </span>
                </summary>
                <ul className="mb-3 space-y-2 rounded-xl bg-muted/40 p-3">
                  {g.halaqoh.map(h => {
                    const href = keHalaqoh(h.id)
                    const judul = <span className="font-semibold">{h.jadwalLabel}</span>
                    return (
                      <li key={h.id} className="text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="min-w-0">
                            {href ? <Link href={href} className="hover:underline">{judul}</Link> : judul}
                            <span className="text-xs text-muted-foreground"> · {h.jenis} · {h.peserta} peserta</span>
                          </span>
                          <span className="text-xs tabular-nums">
                            <b>{h.terisi}/{h.jadwal}</b>
                            {h.jadwal > 0 && h.terisi === 0 && <span className="ml-1.5 rounded-full bg-accent-warm-wash px-2 py-0.5 font-semibold text-accent-warm">tanpa isian sebulan</span>}
                          </span>
                        </div>
                        {h.kosong.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            <span className="text-xs text-muted-foreground">Kosong:</span>
                            {h.kosong.map(t => <span key={t} className="rounded-md bg-card px-1.5 py-0.5 text-xs tabular-nums">{tglPendek(t)}</span>)}
                          </p>
                        )}
                        {h.luarJadwal.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Terisi di luar jadwal: {h.luarJadwal.map(tglPendek).join(', ')} — mungkin jadwal di aplikasi perlu diperbarui.
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </details>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Baris daftar: tautan bila boleh dibuka, teks biasa bila tidak (Kumik). */
function Tautan({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  return href ? <Link href={href} className={className}>{children}</Link> : <div className={className}>{children}</div>
}

/** Kepala bagian bernomor — angka serif besar, judul, dan pertanyaan yang dijawab. */
function Bagian({ no, judul, tanya, ket }: { no: string; judul: string; tanya: string; ket?: string }) {
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-1 border-t pt-4">
      <span className="font-heading text-5xl leading-[0.9] text-accent-warm">{no}</span>
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-2xl font-medium leading-tight md:text-[28px]">{judul}</h2>
        <p className="font-heading text-base italic text-primary">{tanya}</p>
      </div>
      {ket && <span className="text-xs text-muted-foreground">{ket}</span>}
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
function Batang({ data, satuan, warna = 'var(--primary)' }: { data: { label: string; nilai: number; ket?: string; tampil?: string }[]; satuan: string; warna?: string }) {
  const maks = Math.max(1, ...data.map(x => x.nilai))
  return (
    <ul className="space-y-2">
      {data.map(x => (
        <li key={x.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
          <span className="truncate" title={x.label}>{x.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${(x.nilai / maks) * 100}%`, background: warna }} />
          </span>
          <span className="tabular-nums text-muted-foreground" title={`${x.nilai} ${satuan}`}><b className="text-foreground">{x.tampil ?? x.nilai}</b>{x.ket ? ` · ${x.ket}` : ''}</span>
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
