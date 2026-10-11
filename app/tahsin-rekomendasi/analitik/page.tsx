import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, BarChart3, BookOpen, Settings2, TrendingUp, UsersRound } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageTahsinRekomendasi, canViewTahsinRekomendasiAnalitik } from '@/lib/auth/permissions'
import { getAnalitikTR, type JumatAnalitik, type RentangTR } from '@/lib/data/tahsin-rekomendasi-analitik'
import { getKelompokTR } from '@/lib/data/tahsin-rekomendasi'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Panel } from '@/components/dashboard/kit'
import { cn } from '@/lib/utils'

const PATH = '/tahsin-rekomendasi/analitik'
const RENTANG: { k: RentangTR; l: string }[] = [{ k: 'semester', l: 'Semester' }, { k: 'bulan', l: 'Bulan ini' }, { k: 'empat', l: '4 pekan terakhir' }]
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tglPendek = (t: string) => `${Number(t.slice(8))} ${BULAN[Number(t.slice(5, 7)) - 1]}`
const tglPanjang = (t: string) => new Date(`${t}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })
const angka1 = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 })

// Sama dengan Analitik Riyadhoh, supaya dua program tambahan terbaca dengan bahasa yang sama.
const W_HADIR = [
  { k: 'hadir', l: 'Hadir', c: 'var(--primary)' },
  { k: 'izin', l: 'Izin', c: '#7FA6D6' },
  { k: 'sakit', l: 'Sakit', c: '#E8B45C' },
  { k: 'alfa', l: 'Alfa', c: 'var(--destructive)' },
  { k: 'belum', l: 'Belum dicatat', c: '#CFC8B8' },
] as const
const W_SETOR = [
  { k: 'setor', l: 'Hadir & setor', c: '#0E3531' },
  { k: 'tidakSetor', l: 'Hadir, tidak setor', c: '#E4DFD3' },
] as const

/**
 * Analitik Tahsin Rekomendasi — Koordinator SD, Kurikulum, Kepala RQ.
 * Mengatur kelompok & peserta tetap di /tahsin-rekomendasi (Koor SD).
 */
export default async function AnalitikTRPage({ searchParams }: { searchParams: Promise<{ rentang?: string; kelompok?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewTahsinRekomendasiAnalitik(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const rentang: RentangTR = RENTANG.some(r => r.k === sp.rentang) ? (sp.rentang as RentangTR) : 'semester'
  const daftar = (await getKelompokTR()) ?? []
  const kelompokId = daftar.some(k => k.teacher_id === sp.kelompok) ? sp.kelompok! : null
  const a = await getAnalitikTR({ rentang, kelompok: kelompokId })
  const bolehKelola = canManageTahsinRekomendasi(session.role)

  const param = { rentang: rentang === 'semester' ? undefined : rentang, kelompok: kelompokId ?? undefined }
  const href = (ubah: Record<string, string | undefined>) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...param, ...ubah })) if (v) u.set(k, v)
    const s = u.toString()
    return s ? `${PATH}?${s}` : PATH
  }
  const r = a.ringkas
  const terakhir = [...a.jumat].reverse().find(j => j.berjalan) ?? null
  const kelompokTerpilih = daftar.find(k => k.teacher_id === kelompokId)

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Analitik Tahsin Rekomendasi" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Tahsin Rekomendasi SDIT · analitik</p>
          <h1 className="mt-1 max-w-3xl font-heading text-3xl leading-tight md:text-[38px]">
            {kelompokTerpilih ? `Kelompok ${kelompokTerpilih.username}` : 'Tahsin Rekomendasi'} {RENTANG.find(x => x.k === rentang)?.l.toLowerCase()}
            {r.hadirPersen !== null && <> — <i>kehadiran {r.hadirPersen}%, {r.setoran.toLocaleString('id-ID')} setoran.</i></>}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {tglPanjang(a.dari)} – {tglPanjang(a.sampai)} · {a.peserta} siswa di {a.kelompokJumlah} kelompok · {r.jumatBerjalan} Jum&apos;at berjalan.
            Jum&apos;at tanpa satu catatan pun dihitung libur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Seg label="Rentang" items={RENTANG.map(x => ({ l: x.l, href: href({ rentang: x.k === 'semester' ? undefined : x.k }), on: x.k === rentang }))} />
          <form action={PATH} className="flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-xs text-muted-foreground">
            {param.rentang && <input type="hidden" name="rentang" value={param.rentang} />}
            Kelompok
            <select name="kelompok" defaultValue={kelompokId ?? ''} className="bg-transparent text-sm font-semibold text-foreground outline-none">
              <option value="">Semua</option>
              {daftar.map(k => <option key={k.teacher_id} value={k.teacher_id}>{k.username} · {k.full_name}</option>)}
            </select>
            <button type="submit" className="font-semibold text-primary">Terapkan</button>
          </form>
          {bolehKelola && (
            <Link href="/tahsin-rekomendasi" className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3.5 text-sm font-semibold hover:bg-muted">
              <Settings2 className="h-4 w-4 text-primary" />Kelola kelompok
            </Link>
          )}
        </div>

        {!a.tabelAda ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            Tabel Tahsin Rekomendasi belum ada. Jalankan <code className="text-xs">drizzle/0115_tahsin_rekomendasi_PASTE_TO_SUPABASE.sql</code> lebih dulu.
          </p>
        ) : a.peserta === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">Belum ada peserta Tahsin Rekomendasi{kelompokTerpilih ? ' di kelompok ini' : ''}.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Kehadiran" nilai={r.hadirPersen === null ? '—' : `${r.hadirPersen}%`} ket={r.tercatat ? `dari ${r.tercatat.toLocaleString('id-ID')} kehadiran tercatat` : 'belum ada presensi'} />
              <Kpi label="Setoran TR" nilai={r.setoran.toLocaleString('id-ID')} ket={`${r.anakPernahSetor} dari ${a.peserta} anak pernah setor`} />
              <Kpi label="Setoran lulus" nilai={r.persenLulus === null ? '—' : `${r.persenLulus}%`} ket="sisanya ulang / lanjut" />
              <Kpi label="Rata-rata nilai" nilai={r.rataBintang === null ? '—' : `★ ${angka1(r.rataBintang)}`} ket={r.nilaiSampel ? `dari ${r.nilaiSampel} setoran bernilai` : 'belum ada nilai'} />
            </div>

            {terakhir && (
              <section className="rounded-[20px] bg-[#0E3531] p-6 text-white md:p-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#F2B27A]">Jum&apos;at terakhir · {tglPanjang(terakhir.tanggal)}</p>
                <h2 className="mt-1 font-heading text-2xl font-normal leading-tight md:text-[30px]">
                  {terakhir.hadir} dari {terakhir.total} hadir, <i>{terakhir.setor} menyetor</i>
                  {terakhir.belum ? <> — {terakhir.belum} anak belum dicatat.</> : '.'}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[{ l: 'Hadir', v: terakhir.hadir }, { l: 'Setor', v: terakhir.setor }, { l: 'Tidak setor', v: terakhir.tidakSetor },
                    { l: 'Izin', v: terakhir.izin }, { l: 'Sakit', v: terakhir.sakit }, { l: 'Alfa', v: terakhir.alfa }, { l: 'Belum dicatat', v: terakhir.belum }]
                    .filter(x => x.l === 'Hadir' || x.v > 0).map(x => (
                      <span key={x.l} className="min-w-[76px] rounded-xl border border-white/10 bg-white/[0.08] px-3.5 py-2.5">
                        <span className="block font-heading text-2xl leading-none tabular-nums">{x.v}</span>
                        <span className="text-[11.5px] text-white/75">{x.l}</span>
                      </span>
                    ))}
                </div>
              </section>
            )}

            <Bagian no="01" judul="Kehadiran & setoran" tanya="Apakah anak datang, dan apakah yang datang benar-benar setor?" ket={`${r.jumatBerjalan} Jum'at berjalan`} />
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-7" title="Kehadiran tiap Jum'at" icon={<BarChart3 />} sub="Kolom 100% · angka putih = persen hadir">
                <Legenda items={W_HADIR.map(x => ({ l: x.l, c: x.c }))} />
                <Tumpuk jumat={a.jumat} seri={W_HADIR.map(x => ({ l: x.l, c: x.c, v: (j: JumatAnalitik) => j[x.k] }))} label="Kehadiran tiap Jum'at" />
              </Panel>
              <Panel className="lg:col-span-5" title="Anak yang perlu perhatian" icon={<AlertCircle />} sub="Alfa beruntun, hadir tanpa setor, izin beruntun, atau belum pernah setor">
                {a.perhatian.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada pola yang mengkhawatirkan.</p> : (
                  <ul className="max-h-[420px] divide-y overflow-y-auto">
                    {a.perhatian.map(p => (
                      <li key={p.id} className="flex items-center gap-3 py-2.5">
                        <Link href={`/siswa/${p.id}`} className="min-w-0 flex-1 hover:underline">
                          <span className="block truncate text-sm font-bold">{p.nama}</span>
                          <span className="block truncate text-xs text-muted-foreground">{[p.kelas, p.kelompok].filter(Boolean).join(' · ')}</span>
                        </Link>
                        <span className={cn('shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold',
                          p.nada === 'bahaya' ? 'bg-destructive-wash text-destructive' : p.nada === 'waspada' ? 'bg-accent-warm-wash text-accent-warm' : 'bg-muted text-muted-foreground')}>{p.alasan}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
            <Panel title="Anak yang hadir: setor atau tidak" icon={<BookOpen />} sub="Tiap kolom = anak yang hadir pada Jum'at itu">
              <Legenda items={W_SETOR.map(x => ({ l: x.l, c: x.c }))} />
              <Tumpuk jumat={a.jumat} seri={W_SETOR.map(x => ({ l: x.l, c: x.c, v: (j: JumatAnalitik) => j[x.k] }))} label="Setoran anak yang hadir tiap Jum'at" />
            </Panel>

            <Bagian no="02" judul="Kelompok" tanya="Kelompok mana yang tertinggal, dan apakah pencatatannya lengkap?" />
            <Panel title="Per kelompok" icon={<UsersRound />} sub="Hadir dari anak yang tercatat · halaman lulus = halaman buku lulus lewat TR (bukan drill) · pencatatan 6 Jum'at terakhir"
              action={bolehKelola ? { href: '/tahsin-rekomendasi', label: 'Kelola kelompok' } : undefined}>
              {a.kelompok.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada kelompok.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        <th className="pb-2 font-bold">Kelompok</th><th className="pb-2 font-bold">Anak</th><th className="pb-2 font-bold">Hadir</th>
                        <th className="pb-2 text-right font-bold">Setoran</th><th className="pb-2 text-right font-bold">Lulus</th>
                        <th className="pb-2 text-right font-bold">Hal. lulus</th><th className="pb-2 text-right font-bold">Rata ★</th><th className="pb-2 pl-4 font-bold">Pencatatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.kelompok.map(k => (
                        <tr key={k.id} className="border-t">
                          <td className="py-2.5 pr-3">
                            <Link href={href({ kelompok: k.id })} className="font-bold hover:underline">{k.username} · {k.nama}</Link>
                            {k.tempat && <span className="block text-xs text-muted-foreground">{k.tempat}</span>}
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{k.anak}</td>
                          <td className="w-44 py-2.5 pr-4"><Batang n={k.hadirPersen} /></td>
                          <td className="py-2.5 text-right font-semibold tabular-nums">{k.setoran}</td>
                          <td className="py-2.5 text-right tabular-nums">{k.persenLulus === null ? '—' : `${k.persenLulus}%`}</td>
                          <td className="py-2.5 text-right font-semibold tabular-nums">{k.halamanLulus}</td>
                          <td className="py-2.5 text-right font-bold tabular-nums text-accent-warm">{k.rataBintang === null ? '—' : angka1(k.rataBintang)}</td>
                          <td className="py-2.5 pl-4"><Pencatatan daftar={k.pencatatan} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Bagian no="03" judul="Perkembangan siswa" tanya="Sudah sejauh mana anak sejak direkomendasikan?" ket="Posisi kini ikut setoran sekolah maupun TR" />
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-9" title="Per siswa" icon={<TrendingUp />} sub="Urut dari yang paling sedikit halaman lulus lewat TR">
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        <th className="pb-2 font-bold">Siswa</th><th className="pb-2 font-bold">Capaian awal</th><th className="pb-2 font-bold">Posisi kini</th>
                        <th className="pb-2 text-right font-bold">Hadir</th><th className="pb-2 text-right font-bold">Setoran</th>
                        <th className="pb-2 text-right font-bold">Hal. lulus</th><th className="pb-2 pl-3 font-bold">Setor terakhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...a.siswa].sort((x, y) => x.halamanLulus - y.halamanLulus || x.setoran - y.setoran || x.nama.localeCompare(y.nama, 'id')).map(s => (
                        <tr key={s.id} className="border-t">
                          <td className="py-2 pr-3">
                            <Link href={`/siswa/${s.id}`} className="font-bold hover:underline">{s.nama}</Link>
                            <span className="block text-xs text-muted-foreground">{s.kelas ?? '—'} · {s.kelompok}</span>
                          </td>
                          <td className="py-2 pr-3 text-[13px] text-muted-foreground">{s.capaianAwal || '—'}</td>
                          <td className="py-2 pr-3 text-[13px] font-semibold">{s.posisi ?? '—'}</td>
                          <td className="py-2 text-right tabular-nums">{s.pertemuan ? `${s.hadir}/${s.pertemuan}` : '—'}</td>
                          <td className="py-2 text-right tabular-nums">{s.setoran}</td>
                          <td className={cn('py-2 text-right font-bold tabular-nums', s.halamanLulus === 0 && 'text-accent-warm')}>{s.halamanLulus}</td>
                          <td className="py-2 pl-3 text-xs text-muted-foreground">{s.terakhir ? tglPendek(s.terakhir) : 'belum pernah'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel className="lg:col-span-3" title="Per tingkat" icon={<UsersRound />} sub="Kehadiran · setoran per anak">
                <ul className="space-y-3">
                  {a.kelas.map(k => (
                    <li key={k.tingkat}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="font-bold">Kelas {k.tingkat}</span>
                        <span className="text-xs text-muted-foreground">{k.anak} anak · {k.setoranPerAnak === null ? '—' : angka1(k.setoranPerAnak)} setoran/anak</span>
                      </div>
                      <Batang n={k.hadirPersen} />
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, nilai, ket }: { label: string; nilai: string; ket: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-heading text-3xl leading-none tabular-nums">{nilai}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{ket}</p>
    </div>
  )
}

function Pencatatan({ daftar }: { daftar: ('lengkap' | 'sebagian' | 'kosong')[] }) {
  const tanda = { lengkap: ['✓', 'bg-primary text-primary-foreground', 'presensi lengkap'], sebagian: ['½', 'bg-accent-warm-wash text-accent-warm', 'sebagian tercatat'], kosong: ['–', 'bg-destructive-wash text-destructive', 'belum dicatat'] } as const
  if (daftar.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="flex gap-1">
      {daftar.map((x, i) => (
        <span key={i} title={tanda[x][2]} className={cn('flex h-[22px] w-[22px] items-center justify-center rounded-md text-[11px] font-bold', tanda[x][1])}>{tanda[x][0]}</span>
      ))}
    </span>
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

function Batang({ n }: { n: number | null }) {
  const nada = n === null ? 'bg-muted' : n >= 85 ? 'bg-primary' : n >= 75 ? 'bg-accent-warm' : 'bg-destructive'
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', nada)} style={{ width: `${n ?? 0}%` }} /></span>
      <b className="w-10 text-right text-xs tabular-nums">{n === null ? '—' : `${n}%`}</b>
    </span>
  )
}

/** Kolom 100% bertumpuk per Jum'at; Jum'at tanpa catatan digambar sebagai libur. */
function Tumpuk({ jumat, seri, label }: { jumat: JumatAnalitik[]; seri: { l: string; c: string; v: (j: JumatAnalitik) => number }[]; label: string }) {
  if (jumat.length === 0) return <p className="text-sm text-muted-foreground">Belum ada Jum&apos;at pada rentang ini.</p>
  const W = Math.max(360, jumat.length * 52 + 44), H = 230, top = 12, bot = 30, ph = H - top - bot
  const cw = (W - 44) / jumat.length
  const bw = Math.min(32, cw - 12)
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
        {jumat.map((j, i) => {
          const x = 44 + i * cw + cw / 2 - bw / 2
          const vals = seri.map(s => s.v(j))
          const tot = vals.reduce((p, q) => p + q, 0)
          let y = top + ph
          return (
            <g key={j.tanggal}>
              {!j.berjalan ? (
                <>
                  <rect x={x} y={top} width={bw} height={ph} rx={6} fill="var(--muted)" />
                  <text x={x + bw / 2} y={top + ph / 2} fontSize={11} textAnchor="middle" fill="var(--muted-foreground)" transform={`rotate(-90 ${x + bw / 2} ${top + ph / 2})`}>libur</text>
                </>
              ) : tot === 0 ? (
                <rect x={x} y={top} width={bw} height={ph} rx={6} fill="none" stroke="var(--border)" strokeDasharray="4 3" />
              ) : (
                <>
                  {vals.map((v, k) => {
                    const h = (v / tot) * ph
                    y -= h
                    return <rect key={k} x={x} y={y} width={bw} height={h} fill={seri[k].c}><title>{`${tglPendek(j.tanggal)} · ${seri[k].l}: ${v}`}</title></rect>
                  })}
                  {vals[0] / tot > 0.12 && (
                    <text x={x + bw / 2} y={top + ph - ((vals[0] / tot) * ph) / 2 + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill="#fff">{Math.round((vals[0] / tot) * 100)}</text>
                  )}
                </>
              )}
              <text x={x + bw / 2} y={H - 10} fontSize={11} textAnchor="middle" fill="var(--muted-foreground)">{tglPendek(j.tanggal)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
