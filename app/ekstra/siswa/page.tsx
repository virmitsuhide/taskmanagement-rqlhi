import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, ChevronRight, Search } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { hrefDengan } from '@/components/dashboard/kit'
import { getBookingEkstra, getDataEkstra, getHadirEkstra, hariIniWIB, hitungSetoranEkstra, kunciOrang, labelSlot, type BookingEkstra } from '@/lib/data/ekstra'
import type { Jenjang } from '@/types'
import { cn } from '@/lib/utils'

const PATH = '/ekstra/siswa'

/**
 * Siswa ekstra — semua anak yang ikut ekstra (siswa LHI maupun bukan), satu
 * baris per anak. Detailnya memuat riwayat setoran & kehadiran ekstranya.
 */
export default async function SiswaEkstraPage({ searchParams }: {
  searchParams: Promise<{ asal?: string; jenis?: string; guru?: string; q?: string; status?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const tampilBerhenti = sp.status === 'semua'
  const [data, booking] = await Promise.all([
    getDataEkstra(),
    getBookingEkstra(tampilBerhenti ? ['aktif', 'berhenti'] : ['aktif']),
  ])
  const slotById = new Map(data.slot.map(s => [s.id, s]))
  const jenisById = new Map(data.jenis.map(j => [j.id, j]))

  // Kelompokkan per anak; baris aktif lebih dulu sebagai wajah kelompok.
  const perOrang = new Map<string, BookingEkstra[]>()
  for (const b of [...booking].sort((x, y) => (x.status === 'aktif' ? 0 : 1) - (y.status === 'aktif' ? 0 : 1))) {
    const k = kunciOrang(b)
    perOrang.set(k, [...(perOrang.get(k) ?? []), b])
  }

  const idSiswa = [...new Set(booking.map(b => b.student_id).filter((x): x is string => !!x))]
  const hariIni = hariIniWIB()
  const [siswaRes, setoran, hadir] = await Promise.all([
    idSiswa.length ? createServerClient().from('students').select('id, full_name, kelas, jenjang').in('id', idSiswa) : Promise.resolve({ data: [] }),
    hitungSetoranEkstra(idSiswa),
    getHadirEkstra(booking.map(b => b.id), `${hariIni.slice(0, 7)}-01`, hariIni),
  ])
  const siswa = new Map(((siswaRes.data ?? []) as { id: string; full_name: string; kelas: string | null; jenjang: Jenjang }[]).map(s => [s.id, s]))

  const q = (sp.q ?? '').trim().toLowerCase()
  const semua = [...perOrang.values()].map(bs => {
    const b = bs[0]
    const s = b.student_id ? siswa.get(b.student_id) : undefined
    const lhi = b.asal === 'lhi'
    return {
      id: b.id,
      nama: s?.full_name ?? b.nama_anak,
      lhi,
      tertaut: !!s,
      keterangan: s ? [s.kelas ? `Kelas ${s.kelas}` : null, JENJANG_LABELS[s.jenjang] ?? s.jenjang].filter(Boolean).join(' · ') : b.kelas,
      posisi: b.posisi_bacaan,
      aktif: bs.some(x => x.status === 'aktif'),
      ikut: bs.map(x => {
        const sl = x.slot_id ? slotById.get(x.slot_id) : undefined
        return { jenis: jenisById.get(x.jenis_id)?.nama ?? '—', halaqoh: sl ? `${sl.guru} · ${labelSlot(sl)}` : 'Belum ada halaqoh', berhenti: x.status === 'berhenti', jenis_id: x.jenis_id, guru_id: sl?.teacher_id ?? null }
      }),
      setoran: b.student_id ? setoran.get(b.student_id) ?? 0 : null,
      hadir: hadir.filter(h => bs.some(x => x.id === h.booking_id) && h.status === 'hadir').length,
      pertemuan: hadir.filter(h => bs.some(x => x.id === h.booking_id)).length,
    }
  }).filter(o => !q || o.nama.toLowerCase().includes(q) || o.keterangan.toLowerCase().includes(q))
    .filter(o => !sp.jenis || o.ikut.some(i => i.jenis_id === sp.jenis))
    .filter(o => !sp.guru || o.ikut.some(i => i.guru_id === sp.guru))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))

  const asal = sp.asal === 'lhi' || sp.asal === 'luar' ? sp.asal : null
  const daftar = semua.filter(o => !asal || (asal === 'lhi') === o.lhi)
  const param = { asal: sp.asal, jenis: sp.jenis, guru: sp.guru, q: sp.q, status: sp.status }
  const jenisDipakai = data.jenis.filter(j => booking.some(b => b.jenis_id === j.id))
  const guruDipakai = [...new Map(data.slot.filter(s => booking.some(b => b.slot_id === s.id)).map(s => [s.teacher_id, s.guru ?? '—'])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'id'))
  // Siswa LHI aktif yang belum tertaut — guru belum bisa mencatat setorannya.
  const belumTertaut = booking.filter(b => b.status === 'aktif' && b.asal === 'lhi' && !b.student_id)

  const pill = (label: string, on: boolean, href: string, n?: number) => (
    <Link key={label} href={href} aria-current={on ? 'page' : undefined}
      className={cn('rounded-full border px-3.5 py-1.5 text-xs font-semibold', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
      {label}{n !== undefined && <span className="ml-1 tabular-nums opacity-70">{n}</span>}
    </Link>
  )

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Siswa Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · siswa</p>
          <h1 className="mt-1 font-heading text-3xl leading-tight md:text-[38px]">Siswa ekstra</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Satu baris per anak — siswa LHI maupun dari luar. Setoran ekstra ikut memajukan capaian sekolah, tetapi dilaporkan di laporan ekstra.
          </p>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : (
          <>
            {belumTertaut.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent-warm-wash px-5 py-4">
                <AlertCircle className="h-5 w-5 shrink-0 text-accent-warm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-accent-warm">{belumTertaut.length} siswa LHI belum tertaut ke data siswa</p>
                  <p className="text-sm">Guru belum bisa mencatat setoran mereka, dan capaian sekolahnya tidak ikut maju.</p>
                </div>
                <Link href={`/ekstra?status=aktif&id=${belumTertaut[0].id}`} className="inline-flex h-9 items-center rounded-xl bg-accent-warm px-4 text-sm font-bold text-white hover:opacity-90">
                  Tautkan sekarang
                </Link>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {pill('Semua', !asal, hrefDengan(PATH, param, { asal: undefined }), semua.length)}
              {pill('Siswa LHI', asal === 'lhi', hrefDengan(PATH, param, { asal: 'lhi' }), semua.filter(o => o.lhi).length)}
              {pill('Non LHI', asal === 'luar', hrefDengan(PATH, param, { asal: 'luar' }), semua.filter(o => !o.lhi).length)}
              <form action={PATH} className="flex w-full flex-wrap items-center gap-2 lg:ml-2 lg:w-auto lg:flex-1">
                {sp.asal && <input type="hidden" name="asal" value={sp.asal} />}
                {sp.status && <input type="hidden" name="status" value={sp.status} />}
                <label className="flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-xs text-muted-foreground">
                  Jenis
                  <select name="jenis" defaultValue={sp.jenis ?? ''} className="bg-transparent text-sm font-semibold text-foreground outline-none">
                    <option value="">Semua jenis</option>
                    {jenisDipakai.map(j => <option key={j.id} value={j.id}>{j.nama}</option>)}
                  </select>
                </label>
                <label className="flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-xs text-muted-foreground">
                  Guru
                  <select name="guru" defaultValue={sp.guru ?? ''} className="bg-transparent text-sm font-semibold text-foreground outline-none">
                    <option value="">Semua guru</option>
                    {guruDipakai.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
                  </select>
                </label>
                <span className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card px-3 sm:max-w-xs lg:ml-auto">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input name="q" defaultValue={sp.q ?? ''} placeholder="Nama atau kelas" aria-label="Cari siswa" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </span>
                <button type="submit" className="h-9 rounded-xl border bg-card px-3 text-sm font-semibold hover:bg-muted">Terapkan</button>
              </form>
            </div>

            <section className="rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <p className="text-sm font-bold">{daftar.length} siswa ekstra{tampilBerhenti ? '' : ' aktif'}</p>
                <Link href={hrefDengan(PATH, param, { status: tampilBerhenti ? undefined : 'semua' })} className="text-xs font-semibold text-primary hover:underline">
                  {tampilBerhenti ? 'Sembunyikan yang sudah berhenti' : 'Tampilkan juga yang sudah berhenti'}
                </Link>
              </div>
              <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_130px_110px_16px] gap-4 border-y px-5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground md:grid">
                <span>Anak</span><span>Ekstra yang diikuti</span><span>Hadir bulan ini</span><span className="text-right">Setoran ekstra</span><span />
              </div>
              {daftar.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Tidak ada siswa ekstra yang cocok dengan saringan ini.</p>
              ) : (
                <ul className="divide-y">
                  {daftar.map(o => (
                    <li key={o.id}>
                      <Link href={`${PATH}/${o.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-muted/40 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_130px_110px_16px]">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-bold">{o.nama}</span>
                            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', !o.lhi ? 'bg-muted text-muted-foreground' : o.tertaut ? 'bg-primary-wash text-primary' : 'bg-accent-warm-wash text-accent-warm')}>
                              {!o.lhi ? 'Non LHI' : o.tertaut ? 'Siswa LHI' : 'LHI · belum tertaut'}
                            </span>
                            {!o.aktif && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">berhenti</span>}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{o.keterangan || '—'}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground md:order-last" />
                        <span className="col-span-2 min-w-0 space-y-0.5 md:col-span-1">
                          {o.ikut.map((i, n) => (
                            <span key={n} className={cn('block truncate text-xs', i.berhenti && 'text-muted-foreground line-through')}>
                              <b className="font-bold">{i.jenis}</b> <span className="text-muted-foreground">· {i.halaqoh}</span>
                            </span>
                          ))}
                        </span>
                        <span className="text-xs">
                          {o.pertemuan ? (
                            <>
                              <span className="block"><b className="tabular-nums">{o.hadir}</b>/{o.pertemuan} pertemuan</span>
                              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                                <span className="block h-full rounded-full bg-primary" style={{ width: `${(o.hadir / o.pertemuan) * 100}%` }} />
                              </span>
                            </>
                          ) : <span className="text-muted-foreground">belum ada presensi</span>}
                        </span>
                        <span className="text-xs md:text-right">
                          {o.setoran !== null ? <><span className="font-heading text-xl tabular-nums">{o.setoran}</span> <span className="text-muted-foreground md:block">setoran</span></>
                            : <span className="text-muted-foreground">{o.lhi ? 'Belum tertaut' : o.posisi ? `Posisi: ${o.posisi}` : '—'}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
