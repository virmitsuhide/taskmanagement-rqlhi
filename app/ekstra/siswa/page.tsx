import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Search } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { Slicer, hrefDengan } from '@/components/dashboard/kit'
import { getBookingEkstra, getDataEkstra, getHadirEkstra, hariIniWIB, hitungSetoranEkstra, kunciOrang, labelSlot, type BookingEkstra } from '@/lib/data/ekstra'
import type { Jenjang } from '@/types'

const PATH = '/ekstra/siswa'

/**
 * Siswa ekstra — semua anak yang ikut ekstra (siswa LHI maupun bukan), satu
 * baris per anak. Detailnya memuat riwayat setoran & kehadiran ekstranya.
 */
export default async function SiswaEkstraPage({ searchParams }: {
  searchParams: Promise<{ asal?: string; jenis?: string; q?: string; status?: string }>
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
      aktif: bs.some(x => x.status === 'aktif'),
      ikut: bs.map(x => {
        const sl = x.slot_id ? slotById.get(x.slot_id) : undefined
        return { jenis: jenisById.get(x.jenis_id)?.nama ?? '—', halaqoh: sl ? `${sl.guru} · ${labelSlot(sl)}` : 'Belum ada halaqoh', berhenti: x.status === 'berhenti', jenis_id: x.jenis_id }
      }),
      setoran: b.student_id ? setoran.get(b.student_id) ?? 0 : null,
      hadir: hadir.filter(h => bs.some(x => x.id === h.booking_id) && h.status === 'hadir').length,
      pertemuan: hadir.filter(h => bs.some(x => x.id === h.booking_id)).length,
    }
  }).filter(o => !q || o.nama.toLowerCase().includes(q) || o.keterangan.toLowerCase().includes(q))
    .filter(o => !sp.jenis || o.ikut.some(i => i.jenis_id === sp.jenis))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))

  const asal = sp.asal === 'lhi' || sp.asal === 'luar' ? sp.asal : null
  const daftar = semua.filter(o => !asal || (asal === 'lhi') === o.lhi)
  const param = { asal: sp.asal, jenis: sp.jenis, q: sp.q, status: sp.status }
  const jenisDipakai = data.jenis.filter(j => booking.some(b => b.jenis_id === j.id))

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Siswa Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · siswa</p>
          <h1 className="mt-1 text-3xl leading-tight">Siswa ekstra</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Semua anak yang mengikuti ekstra, satu baris per anak. Buka untuk melihat halaqoh yang diikuti, kehadiran, dan riwayat setoran ekstranya.
          </p>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : (
          <>
            <div className="space-y-3">
              <Slicer label="Asal" options={[
                { label: 'Semua', href: hrefDengan(PATH, param, { asal: undefined }), active: !asal, count: semua.length },
                { label: 'Siswa LHI', href: hrefDengan(PATH, param, { asal: 'lhi' }), active: asal === 'lhi', count: semua.filter(o => o.lhi).length },
                { label: 'Non siswa LHI', href: hrefDengan(PATH, param, { asal: 'luar' }), active: asal === 'luar', count: semua.filter(o => !o.lhi).length },
              ]} />
              <form action={PATH} className="flex min-w-0 flex-wrap items-end gap-2">
                {sp.asal && <input type="hidden" name="asal" value={sp.asal} />}
                {sp.status && <input type="hidden" name="status" value={sp.status} />}
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis</span>
                  <select name="jenis" defaultValue={sp.jenis ?? ''} className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="">Semua jenis</option>
                    {jenisDipakai.map(j => <option key={j.id} value={j.id}>{j.nama}</option>)}
                  </select>
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-sm">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Cari</span>
                  <span className="flex h-9 items-center gap-2 rounded-md border bg-background px-2">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input name="q" defaultValue={sp.q ?? ''} placeholder="Nama atau kelas" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </span>
                </label>
                <button type="submit" className="h-9 rounded-md border bg-card px-3 text-sm font-semibold hover:bg-muted">Terapkan</button>
              </form>
            </div>

            <section className="rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
                <p className="text-sm font-semibold">{daftar.length} siswa ekstra</p>
                <Link href={hrefDengan(PATH, param, { status: tampilBerhenti ? undefined : 'semua' })} className="text-xs font-medium text-primary hover:underline">
                  {tampilBerhenti ? 'Sembunyikan yang sudah berhenti' : 'Tampilkan juga yang sudah berhenti'}
                </Link>
              </div>
              {daftar.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Tidak ada siswa ekstra yang cocok dengan saringan ini.</p>
              ) : (
                <ul className="divide-y">
                  {daftar.map(o => (
                    <li key={o.id}>
                      <Link href={`${PATH}/${o.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_130px_20px]">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{o.nama}</span>
                            <span className={o.lhi ? 'rounded bg-primary-wash px-1.5 py-0.5 text-[10px] font-semibold text-primary' : 'rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground'}>
                              {o.lhi ? (o.tertaut ? 'Siswa LHI' : 'LHI · belum tertaut') : 'Non LHI'}
                            </span>
                            {!o.aktif && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">berhenti</span>}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{o.keterangan || '—'}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground md:order-last" />
                        <span className="col-span-2 min-w-0 space-y-0.5 md:col-span-1">
                          {o.ikut.map((i, n) => (
                            <span key={n} className={i.berhenti ? 'block truncate text-xs text-muted-foreground line-through' : 'block truncate text-xs'}>
                              <b className="font-medium">{i.jenis}</b> · {i.halaqoh}
                            </span>
                          ))}
                        </span>
                        <span className="col-span-2 text-xs text-muted-foreground md:col-span-1 md:text-right">
                          {o.setoran !== null && <span className="block"><b className="tabular-nums text-foreground">{o.setoran}</b> setoran ekstra</span>}
                          <span className="block">{o.pertemuan ? <>hadir <b className="tabular-nums text-foreground">{o.hadir}/{o.pertemuan}</b> bulan ini</> : 'belum ada presensi bulan ini'}</span>
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
