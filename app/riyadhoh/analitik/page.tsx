import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, BarChart3, BookOpen, CalendarDays, Gauge, UsersRound } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageRiyadhoh, canViewRiyadhohAnalitik } from '@/lib/auth/permissions'
import { getAnalitikRiyadhoh, type CapaianUtama, type RentangRiyadhoh, type SabtuAnalitik } from '@/lib/data/riyadhoh-analitik'
import { getPengampuRiyadhoh } from '@/lib/data/riyadhoh'
import { LABEL_KELOMPOK, type KelompokRiyadhoh } from '@/lib/rq/riyadhoh'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Panel } from '@/components/dashboard/kit'
import { cn } from '@/lib/utils'

const PATH = '/riyadhoh/analitik'
const RENTANG: { k: RentangRiyadhoh; l: string }[] = [{ k: 'semester', l: 'Semester' }, { k: 'bulan', l: 'Bulan ini' }, { k: 'empat', l: '4 pekan terakhir' }]
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tglPendek = (t: string) => `${Number(t.slice(8))} ${BULAN[Number(t.slice(5, 7)) - 1]}`
const tglPanjang = (t: string) => new Date(`${t}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })
const bintang = (b: number | null) => (b === null ? '—' : `★ ${b.toLocaleString('id-ID', { maximumFractionDigits: 1 })}`)

// Warna seri — hijau Teduh untuk hadir/ziyadah, gradasi untuk muroja'ah & tahsin.
const W_HADIR = [
  { k: 'hadir', l: 'Hadir', c: 'var(--primary)' },
  { k: 'izin', l: 'Izin', c: '#7FA6D6' },
  { k: 'sakit', l: 'Sakit', c: '#E8B45C' },
  { k: 'alfa', l: 'Alfa', c: 'var(--destructive)' },
  { k: 'belum', l: 'Belum dicatat', c: '#CFC8B8' },
] as const
const W_CAPAIAN: { k: CapaianUtama; l: string; c: string }[] = [
  { k: 'ziyadah', l: 'Ziyadah', c: '#0E3531' },
  { k: 'murojaah_baru', l: "Muroja'ah baru", c: '#256B60' },
  { k: 'murojaah_lama', l: "Muroja'ah lama", c: '#8FBFB2' },
  { k: 'tahsin', l: 'Tahsin saja', c: '#C9D9A6' },
  { k: 'tidak_setor', l: 'Tidak setor', c: '#E4DFD3' },
]
const WARNA_KELOMPOK: Record<KelompokRiyadhoh, string> = { L: '#2E5A8F', P: '#BC5A0B' }

/**
 * Analitik Riyadhoh Sabtu — dibaca Kurikulum dan Koordinator SMP (juga
 * Kepala RQ). Kategori capaian sama dengan Laporan Riyadhoh pengampu.
 * Mengatur jadwal, pengampu, dan peserta tetap di halaman Riyadhoh (Koor SMP).
 */
export default async function AnalitikRiyadhohPage({ searchParams }: {
  searchParams: Promise<{ rentang?: string; kelompok?: string; pengampu?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewRiyadhohAnalitik(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const rentang: RentangRiyadhoh = RENTANG.some(r => r.k === sp.rentang) ? (sp.rentang as RentangRiyadhoh) : 'semester'
  const kelompok: KelompokRiyadhoh | null = sp.kelompok === 'L' || sp.kelompok === 'P' ? sp.kelompok : null
  const [daftarPengampu] = await Promise.all([getPengampuRiyadhoh()])
  const pengampuId = daftarPengampu.some(p => p.teacher_id === sp.pengampu) ? sp.pengampu! : null
  const a = await getAnalitikRiyadhoh({ rentang, kelompok, pengampu: pengampuId })
  const bolehKelola = canManageRiyadhoh(session.role)

  const param = { rentang: rentang === 'semester' ? undefined : rentang, kelompok: kelompok ?? undefined, pengampu: pengampuId ?? undefined }
  const href = (ubah: Record<string, string | undefined>) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...param, ...ubah })) if (v) u.set(k, v)
    const s = u.toString()
    return s ? `${PATH}?${s}` : PATH
  }

  const aktif = a.sabtu.filter(s => s.kelompok)
  const persenHadir = (ss: SabtuAnalitik[]) => {
    const catat = ss.reduce((n, s) => n + s.total - s.belum, 0)
    return catat ? Math.round((ss.reduce((n, s) => n + s.hadir, 0) / catat) * 100) : null
  }
  const hPutra = persenHadir(aktif.filter(s => s.kelompok === 'L'))
  const hPutri = persenHadir(aktif.filter(s => s.kelompok === 'P'))
  const tren = (g: KelompokRiyadhoh) => {
    const ss = aktif.filter(s => s.kelompok === g && s.total - s.belum > 0)
    if (ss.length < 3) return null
    const p = ss.map(s => Math.round((s.hadir / (s.total - s.belum)) * 100))
    return { awal: p[0], akhir: p[p.length - 1] }
  }
  const tPutra = tren('L'), tPutri = tren('P')
  const kalimat = (g: string, t: { awal: number; akhir: number } | null) =>
    !t ? null : t.akhir <= t.awal - 5 ? `${g} turun ${t.awal} → ${t.akhir}%` : t.akhir >= t.awal + 5 ? `${g} naik ${t.awal} → ${t.akhir}%` : `${g} stabil`
  const judulBagian = [kalimat('putri', tPutri), kalimat('putra', tPutra)].filter(Boolean).join(', ')
  const rentangTeks = `${tglPanjang(a.dari)} – ${tglPanjang(a.sampai)}`

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Analitik Riyadhoh" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Riyadhoh Qur&apos;an Sabtu · analitik</p>
          <h1 className="mt-1 max-w-3xl font-heading text-3xl leading-tight md:text-[38px]">
            Riyadhoh {RENTANG.find(r => r.k === rentang)?.l.toLowerCase()}{judulBagian ? <> — <i>{judulBagian}.</i></> : null}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {rentangTeks} · {a.peserta.total} peserta ({a.peserta.putra} putra · {a.peserta.putri} putri). Kategori capaian sama dengan Laporan Riyadhoh yang disalin pengampu ke grup WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Seg label="Rentang" items={RENTANG.map(r => ({ l: r.l, href: href({ rentang: r.k === 'semester' ? undefined : r.k }), on: r.k === rentang }))} />
          <Seg label="Kelompok" items={[{ l: 'Semua', v: undefined }, { l: 'Putra', v: 'L' }, { l: 'Putri', v: 'P' }].map(x => ({ l: x.l, href: href({ kelompok: x.v, pengampu: undefined }), on: (kelompok ?? undefined) === x.v }))} />
          <form action={PATH} className="flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-xs text-muted-foreground">
            {param.rentang && <input type="hidden" name="rentang" value={param.rentang} />}
            {kelompok && <input type="hidden" name="kelompok" value={kelompok} />}
            Pengampu
            <select name="pengampu" defaultValue={pengampuId ?? ''} className="bg-transparent text-sm font-semibold text-foreground outline-none">
              <option value="">Semua</option>
              {daftarPengampu.filter(p => !kelompok || p.kelompok.includes(kelompok)).map(p => <option key={p.teacher_id} value={p.teacher_id}>{p.full_name}</option>)}
            </select>
            <button type="submit" className="font-semibold text-primary">Terapkan</button>
          </form>
          {bolehKelola && (
            <Link href="/riyadhoh" className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3.5 text-sm font-semibold hover:bg-muted">
              <CalendarDays className="h-4 w-4 text-primary" />Kelola Riyadhoh
            </Link>
          )}
        </div>

        {!a.tabelAda ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            Tabel Riyadhoh belum ada. Jalankan <code className="text-xs">drizzle/0087_riyadhoh_PASTE_TO_SUPABASE.sql</code> lebih dulu.
          </p>
        ) : (
          <>
            {a.terakhir && <KartuTerakhir t={a.terakhir} />}

            <Bagian no="01" judul="Kehadiran" tanya="Apakah anak datang pada Sabtunya?" ket={`${aktif.length} Sabtu terjadwal`} />
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-7" title="Kehadiran tiap Sabtu" icon={<BarChart3 />}
                sub={[hPutra !== null ? `putra ${hPutra}%` : null, hPutri !== null ? `putri ${hPutri}%` : null].filter(Boolean).join(' · ') || 'Belum ada presensi tercatat'}>
                <Legenda items={[...W_HADIR.map(x => ({ l: x.l, c: x.c })), { l: '● putra', c: WARNA_KELOMPOK.L }, { l: '● putri', c: WARNA_KELOMPOK.P }]} />
                <Tumpuk sabtu={a.sabtu} seri={W_HADIR.map(x => ({ l: x.l, c: x.c, v: (s: SabtuAnalitik) => s[x.k] }))} label="Kehadiran tiap Sabtu" />
              </Panel>
              <Panel className="lg:col-span-5" title="Anak yang perlu perhatian" icon={<AlertCircle />} sub="Alfa ≥ 2 berturut-turut, hadir tanpa setoran, atau izin/sakit beruntun">
                {a.perhatian.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada pola yang mengkhawatirkan.</p> : (
                  <ul className="max-h-[420px] divide-y overflow-y-auto">
                    {a.perhatian.map(p => (
                      <li key={p.id} className="flex items-center gap-3 py-2.5">
                        <Link href={`/siswa/${p.id}`} className="min-w-0 flex-1 hover:underline">
                          <span className="block truncate text-sm font-bold">{p.nama}</span>
                          <span className="block truncate text-xs text-muted-foreground">{[p.kelas, p.pengampu ?? 'tanpa pengampu'].filter(Boolean).join(' · ')}</span>
                        </Link>
                        <span className={cn('shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold',
                          p.nada === 'bahaya' ? 'bg-destructive-wash text-destructive' : p.nada === 'waspada' ? 'bg-accent-warm-wash text-accent-warm' : 'bg-muted text-muted-foreground')}>{p.alasan}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Bagian no="02" judul="Capaian Sabtu" tanya="Apa yang dikerjakan anak yang hadir?" ket="Ziyadah · muroja'ah · tahsin" />
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-8" title="Capaian anak yang hadir" icon={<BookOpen />}
                sub="Tiap anak dihitung sekali menurut capaian tertingginya pada Sabtu itu">
                <Legenda items={W_CAPAIAN.map(x => ({ l: x.l, c: x.c }))} />
                <Tumpuk sabtu={a.sabtu} seri={W_CAPAIAN.map(x => ({ l: x.l, c: x.c, v: (s: SabtuAnalitik) => s.capaian[x.k] }))} label="Capaian anak yang hadir tiap Sabtu" />
              </Panel>
              <Panel className="lg:col-span-4" title="Mutu setoran" icon={<Gauge />} sub="Dari setoran bertanda Riyadhoh">
                <div className="space-y-2.5">
                  <Angka label="Rata-rata nilai" nilai={bintang(a.mutu.rataBintang)} ket="dari 5 bintang · tahsin & tahfidz" />
                  <Angka label="Setoran tahsin diulang" nilai={a.mutu.persenUlang === null ? '—' : `${a.mutu.persenUlang}%`} ket="bertanda ulang oleh pengampu" warm />
                  <Angka label="Anak ziyadah per Sabtu" nilai={a.mutu.ziyadahPerSabtu.semua === null ? '—' : Math.round(a.mutu.ziyadahPerSabtu.semua).toString()}
                    ket={[a.mutu.ziyadahPerSabtu.putri !== null ? `putri ${Math.round(a.mutu.ziyadahPerSabtu.putri)}` : null, a.mutu.ziyadahPerSabtu.putra !== null ? `putra ${Math.round(a.mutu.ziyadahPerSabtu.putra)}` : null].filter(Boolean).join(' · ') || 'rata-rata tiap Sabtu'} />
                </div>
              </Panel>
            </div>

            <Bagian no="03" judul="Kelompok pengampu" tanya="Kelompok mana yang tertinggal, dan apakah pencatatannya lengkap?" ket="Pembagian per pengampu" />
            <Panel title="Per kelompok pengampu" icon={<UsersRound />} sub="Hadir dari anak yang tercatat · pencatatan 5 Sabtu terakhir kelompoknya"
              action={bolehKelola ? { href: '/riyadhoh', label: 'Kelola Riyadhoh' } : undefined}>
              {a.pengampu.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pengampu Riyadhoh.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        <th className="pb-2 font-bold">Pengampu</th>
                        <th className="pb-2 font-bold">Anak</th>
                        <th className="pb-2 font-bold">Hadir</th>
                        <th className="pb-2 text-right font-bold">Ziyadah</th>
                        <th className="pb-2 text-right font-bold">Muroja&apos;ah</th>
                        <th className="pb-2 text-right font-bold">Tdk setor</th>
                        <th className="pb-2 text-right font-bold">Rata ★</th>
                        <th className="pb-2 pl-4 font-bold">Pencatatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['L', 'P'] as KelompokRiyadhoh[]).filter(g => a.pengampu.some(p => p.kelompok === g)).map(g => (
                        <FragmenKelompok key={g} g={g} rows={a.pengampu.filter(p => p.kelompok === g)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {a.tanpaPengampu > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-accent-warm-wash px-4 py-3 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 text-accent-warm" />
                  <span className="min-w-0 flex-1"><b className="text-accent-warm">{a.tanpaPengampu} peserta belum punya pengampu</b> — belum bisa dicatat pengampu mana pun.</span>
                  {bolehKelola && <Link href="/riyadhoh" className="font-bold text-accent-warm hover:underline">Tetapkan di Kelola Riyadhoh →</Link>}
                </div>
              )}
            </Panel>

            <Bagian no="04" judul="Kelas & jadwal" tanya="Kelas mana yang perlu disapa wali kelasnya?" />
            <Panel title="Per kelas" icon={<UsersRound />} sub="Rata-rata rentang terpilih · putra dan putri masuk bergantian">
              {a.kelas.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada peserta.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        <th className="pb-2 font-bold">Kelas</th><th className="pb-2 font-bold">Anak</th><th className="pb-2 font-bold">Kehadiran</th>
                        <th className="pb-2 font-bold">Anak ziyadah (dari yang hadir)</th><th className="pb-2 text-right font-bold">Tdk setor / Sabtu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.kelas.map(k => (
                        <tr key={k.kelas} className="border-t">
                          <td className="py-2.5 pr-3 font-bold">
                            <span className="inline-flex items-center gap-2">
                              {k.kelompok && <span className="h-2 w-2 rounded-full" style={{ background: WARNA_KELOMPOK[k.kelompok] }} />}{k.kelas}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{k.anak}</td>
                          <td className="py-2.5 pr-4"><Batang n={k.hadirPersen} nada={nadaHadir(k.hadirPersen)} /></td>
                          <td className="py-2.5 pr-4"><Batang n={k.ziyadahPersen} nada="bg-[#0E3531]" /></td>
                          <td className={cn('py-2.5 text-right font-bold tabular-nums', (k.tidakSetorPerSabtu ?? 0) >= 4 && 'text-accent-warm')}>
                            {k.tidakSetorPerSabtu === null ? '—' : k.tidakSetorPerSabtu.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Jadwal Sabtu" icon={<CalendarDays />} action={bolehKelola ? { href: '/riyadhoh', label: 'Atur jadwal' } : undefined}>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[...a.sabtu.map(s => ({ tanggal: s.tanggal, kelompok: s.kelompok, lalu: true })), ...a.mendatang.map(m => ({ ...m, lalu: false }))].map(s => (
                  <div key={s.tanggal} className={cn('flex min-w-[64px] flex-1 flex-col items-center rounded-xl px-1 py-2',
                    s.kelompok === 'L' ? 'bg-info-wash' : s.kelompok === 'P' ? 'bg-accent-warm-wash' : s.lalu ? 'bg-muted' : 'border border-dashed')}>
                    <span className="font-heading text-lg leading-none">{Number(s.tanggal.slice(8))}</span>
                    <span className="text-[10.5px] text-muted-foreground">{BULAN[Number(s.tanggal.slice(5, 7)) - 1]}</span>
                    <span className={cn('text-[10.5px] font-bold', s.kelompok === 'L' ? 'text-info' : s.kelompok === 'P' ? 'text-accent-warm' : s.lalu ? 'text-muted-foreground' : 'text-accent-warm')}>
                      {s.kelompok ? LABEL_KELOMPOK[s.kelompok] : s.lalu ? 'Libur' : 'belum diatur'}
                    </span>
                  </div>
                ))}
              </div>
              {a.mendatang.some(m => !m.kelompok) && (
                <p className="mt-3 text-sm text-muted-foreground">
                  <b className="text-accent-warm">{a.mendatang.filter(m => !m.kelompok).length} Sabtu mendatang belum diatur</b> — diatur Koordinator SMP.
                </p>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}

function nadaHadir(n: number | null) {
  return n === null ? 'bg-muted' : n >= 85 ? 'bg-primary' : n >= 75 ? 'bg-accent-warm' : 'bg-destructive'
}

function FragmenKelompok({ g, rows }: { g: KelompokRiyadhoh; rows: { id: string; nama: string; anak: number; hadirPersen: number | null; ziyadah: number; murojaah: number; tidakSetor: number; rataBintang: number | null; pencatatan: ('lengkap' | 'sebagian' | 'kosong')[] }[] }) {
  const tanda = { lengkap: ['✓', 'bg-primary text-primary-foreground', 'presensi lengkap'], sebagian: ['½', 'bg-accent-warm-wash text-accent-warm', 'sebagian tercatat'], kosong: ['–', 'bg-destructive-wash text-destructive', 'belum dicatat'] } as const
  return (
    <>
      <tr className="border-t"><td colSpan={8} className="pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: WARNA_KELOMPOK[g] }}>{LABEL_KELOMPOK[g]}</td></tr>
      {rows.map(p => (
        <tr key={`${p.id}-${g}`} className="border-t">
          <td className="py-2.5 pr-3 font-bold">{p.nama}</td>
          <td className="py-2.5 pr-3 text-muted-foreground">{p.anak}</td>
          <td className="w-44 py-2.5 pr-4"><Batang n={p.hadirPersen} nada={nadaHadir(p.hadirPersen)} /></td>
          <td className="py-2.5 text-right font-semibold tabular-nums">{p.ziyadah}</td>
          <td className="py-2.5 text-right font-semibold tabular-nums">{p.murojaah}</td>
          <td className={cn('py-2.5 text-right font-semibold tabular-nums', p.tidakSetor >= 3 && 'text-accent-warm')}>{p.tidakSetor}</td>
          <td className="py-2.5 text-right font-bold tabular-nums text-accent-warm">{p.rataBintang === null ? '—' : p.rataBintang.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</td>
          <td className="py-2.5 pl-4">
            <span className="flex gap-1">
              {p.pencatatan.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : p.pencatatan.map((x, i) => (
                <span key={i} title={tanda[x][2]} className={cn('flex h-[22px] w-[22px] items-center justify-center rounded-md text-[11px] font-bold', tanda[x][1])}>{tanda[x][0]}</span>
              ))}
            </span>
          </td>
        </tr>
      ))}
    </>
  )
}

function KartuTerakhir({ t }: { t: NonNullable<Awaited<ReturnType<typeof getAnalitikRiyadhoh>>['terakhir']> }) {
  const chip = [
    { l: 'Hadir', v: `${t.hadir}/${t.total}` }, { l: 'Ziyadah', v: t.jenis.ziyadah }, { l: "Muroja'ah baru", v: t.jenis.murojaah_baru },
    { l: "Muroja'ah lama", v: t.jenis.murojaah_lama }, { l: 'Tahsin', v: t.jenis.tahsin }, { l: 'Tidak setor', v: t.tidakSetor },
    { l: 'Izin', v: t.izin }, { l: 'Sakit', v: t.sakit }, { l: 'Alfa', v: t.alfa }, { l: 'Belum dicatat', v: t.belum },
  ].filter(x => x.l === 'Hadir' || Number(x.v) > 0)
  const lengkap = t.pengampu.filter(p => p.lengkap).length
  return (
    <section className="space-y-4 rounded-[20px] bg-[#0E3531] p-6 text-white md:p-7">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#F2B27A]">Sabtu terakhir · {tglPanjang(t.tanggal)} · {LABEL_KELOMPOK[t.kelompok]}</p>
          <h2 className="mt-1 font-heading text-2xl font-normal leading-tight md:text-[30px]">
            {t.hadir} dari {t.total} hadir, <i>{t.setor} menyetor</i>{t.jenis.ziyadah ? <> — {t.jenis.ziyadah} anak ziyadah.</> : '.'}
          </h2>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {chip.map(x => (
          <span key={x.l} className="min-w-[76px] rounded-xl border border-white/10 bg-white/[0.08] px-3.5 py-2.5">
            <span className="block font-heading text-2xl leading-none tabular-nums">{x.v}</span>
            <span className="text-[11.5px] text-white/75">{x.l}</span>
          </span>
        ))}
      </div>
      {t.pengampu.length > 0 && (
        <div className="border-t border-white/10 pt-3.5">
          <p className="text-xs font-bold text-white/60">Pencatatan pengampu Sabtu ini · {lengkap} dari {t.pengampu.length} lengkap</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            {t.pengampu.map(p => (
              <span key={p.nama} className="inline-flex items-center gap-2 text-[13px]">
                <span className={cn('h-2 w-2 rounded-full', p.lengkap ? 'bg-[#9FE0C9]' : 'bg-[#F2B27A]')} />{p.nama} <span className="text-white/60">· {p.ket}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Seg({ label, items }: { label: string; items: { l: string; href: string; on: boolean }[] }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-xl bg-muted p-[3px]">
      {items.map(x => (
        <Link key={x.l} href={x.href} aria-current={x.on ? 'page' : undefined}
          className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold', x.on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{x.l}</Link>
      ))}
    </div>
  )
}

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

function Legenda({ items }: { items: { l: string; c: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map(x => (
        <span key={x.l} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-3 w-3 rounded-sm" style={{ background: x.c }} />{x.l}
        </span>
      ))}
    </div>
  )
}

function Angka({ label, nilai, ket, warm }: { label: string; nilai: string; ket: string; warm?: boolean }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-heading text-3xl leading-none tabular-nums', warm && 'text-accent-warm')}>{nilai}</p>
      <p className="mt-1 text-xs text-muted-foreground">{ket}</p>
    </div>
  )
}

function Batang({ n, nada }: { n: number | null; nada: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', nada)} style={{ width: `${n ?? 0}%` }} /></span>
      <b className="w-10 text-right text-xs tabular-nums">{n === null ? '—' : `${n}%`}</b>
    </span>
  )
}

/**
 * Kolom 100% bertumpuk per Sabtu — tiap kolom satu Sabtu (putra/putri
 * bergantian), Sabtu tanpa jadwal digambar sebagai libur. Angka di kaki
 * kolom = persen seri pertama.
 */
function Tumpuk({ sabtu, seri, label }: { sabtu: SabtuAnalitik[]; seri: { l: string; c: string; v: (s: SabtuAnalitik) => number }[]; label: string }) {
  if (sabtu.length === 0) return <p className="text-sm text-muted-foreground">Belum ada Sabtu pada rentang ini.</p>
  const W = Math.max(360, sabtu.length * 56 + 44), H = 250, top = 12, bot = 44, ph = H - top - bot
  const cw = (W - 44) / sabtu.length
  const bw = Math.min(34, cw - 12)
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[360px]" role="img" aria-label={label}>
        {[0, 25, 50, 75, 100].map(y => {
          const yy = top + (1 - y / 100) * ph
          return (
            <g key={y}>
              <line x1={36} x2={W} y1={yy} y2={yy} stroke="var(--border)" />
              <text x={0} y={yy + 4} fontSize={11} fill="var(--muted-foreground)">{y}%</text>
            </g>
          )
        })}
        {sabtu.map((s, i) => {
          const x = 44 + i * cw + cw / 2 - bw / 2
          const vals = seri.map(r => r.v(s))
          const tot = vals.reduce((a, b) => a + b, 0)
          let y = top + ph
          return (
            <g key={s.tanggal}>
              {!s.kelompok ? (
                <>
                  <rect x={x} y={top} width={bw} height={ph} rx={6} fill="var(--muted)" />
                  <text x={x + bw / 2} y={top + ph / 2} fontSize={11} textAnchor="middle" fill="var(--muted-foreground)" transform={`rotate(-90 ${x + bw / 2} ${top + ph / 2})`}>libur</text>
                </>
              ) : tot === 0 ? (
                <rect x={x} y={top} width={bw} height={ph} rx={6} fill="none" stroke="var(--border)" strokeDasharray="4 3" />
              ) : (
                <>
                  {vals.map((v, j) => {
                    const h = (v / tot) * ph
                    y -= h
                    return <rect key={j} x={x} y={y} width={bw} height={h} fill={seri[j].c}><title>{`${tglPendek(s.tanggal)} · ${seri[j].l}: ${v}`}</title></rect>
                  })}
                  {vals[0] / tot > 0.12 && (
                    <text x={x + bw / 2} y={top + ph - ((vals[0] / tot) * ph) / 2 + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill="#fff">{Math.round((vals[0] / tot) * 100)}</text>
                  )}
                </>
              )}
              <text x={x + bw / 2} y={H - 24} fontSize={11} textAnchor="middle" fill="var(--muted-foreground)">{tglPendek(s.tanggal)}</text>
              <circle cx={x + bw / 2} cy={H - 10} r={4} fill={s.kelompok ? WARNA_KELOMPOK[s.kelompok] : 'var(--border)'} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
