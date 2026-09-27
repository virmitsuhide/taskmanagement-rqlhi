import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { FormSlotEkstra } from '@/components/ekstra/FormEkstra'
import { Slicer, hrefDengan } from '@/components/dashboard/kit'
import { bolehGuruEkstra, getBookingEkstra, getDataEkstra, getGuruEkstra, HARI_EKSTRA, HARI_PENDEK, jam, kiniWIB, labelSlot } from '@/lib/data/ekstra'
import { cn } from '@/lib/utils'

const PATH = '/ekstra/halaqoh'

/**
 * Halaqoh ekstra — padanan halaman Halaqoh untuk ekstra: satu baris per
 * halaqoh (pengampu + hari + jam + tempat), dengan jumlah pesertanya.
 * Pesertanya dibuka di halaman detail.
 */
export default async function HalaqohEkstraPage({ searchParams }: {
  searchParams: Promise<{ hari?: string; jenis?: string; q?: string; status?: string; tampil?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const [data, peserta, guruRes, { ids: guruEkstra }] = await Promise.all([
    getDataEkstra(),
    getBookingEkstra(['aktif']),
    createServerClient().from('teachers').select('id, full_name').eq('is_active', true).is('deleted_at', null).order('full_name'),
    getGuruEkstra(),
  ])
  // Calon pengampu halaqoh baru: hanya guru ekstra.
  const guru = ((guruRes.data ?? []) as { id: string; full_name: string }[]).filter(g => bolehGuruEkstra(guruEkstra, g.id))

  const tampilNonaktif = sp.status === 'semua'
  const q = (sp.q ?? '').trim().toLowerCase()
  // Pencarian juga menembus nama peserta: koordinator sering mencari "anak ini di halaqoh mana".
  const pesertaPerSlot = new Map<string, typeof peserta>()
  for (const p of peserta) if (p.slot_id) pesertaPerSlot.set(p.slot_id, [...(pesertaPerSlot.get(p.slot_id) ?? []), p])

  const dasar = data.slot
    .filter(s => tampilNonaktif || s.aktif)
    .filter(s => !sp.jenis || s.jenis_id === sp.jenis)
    .filter(s => !q
      || (s.guru ?? '').toLowerCase().includes(q)
      || s.tempat.toLowerCase().includes(q)
      || (pesertaPerSlot.get(s.id) ?? []).some(p => p.nama_anak.toLowerCase().includes(q)))
  const hariAda = [1, 2, 3, 4, 5, 6, 7].filter(h => dasar.some(s => s.hari === h))
  const hari = Number(sp.hari)
  const hariDipilih = hariAda.includes(hari) ? hari : null
  const daftar = dasar.filter(s => !hariDipilih || s.hari === hariDipilih)
    .sort((a, b) => a.hari - b.hari || a.jam_mulai.localeCompare(b.jam_mulai) || (a.guru ?? '').localeCompare(b.guru ?? ''))

  const papan = sp.tampil !== 'daftar'
  const param = { hari: sp.hari, jenis: sp.jenis, q: sp.q, status: sp.status, tampil: sp.tampil }
  const aktifDasar = dasar.filter(s => s.aktif)
  const ringkas = [
    { n: aktifDasar.length, l: 'halaqoh berjalan', c: '' },
    { n: aktifDasar.reduce((n, s) => n + s.peserta, 0), l: 'peserta aktif', c: '' },
    { n: aktifDasar.filter(s => s.peserta >= s.kuotaEfektif).length, l: 'halaqoh penuh', c: 'text-primary' },
    { n: aktifDasar.filter(s => s.peserta === 0).length, l: 'belum ada peserta', c: 'text-accent-warm' },
    { n: new Set(aktifDasar.map(s => s.teacher_id)).size, l: 'guru pengampu', c: '' },
  ]
  const hariIniNo = ((kiniWIB().getUTCDay() + 6) % 7) + 1
  const jenisDipakai = data.jenis.filter(j => data.slot.some(s => s.jenis_id === j.id))
  const totalPeserta = daftar.reduce((n, s) => n + s.peserta, 0)

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Halaqoh Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · halaqoh</p>
          <h1 className="mt-1 font-heading text-3xl leading-tight md:text-[38px]">Halaqoh ekstra sepekan</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Satu kartu = satu pengampu pada satu jadwal pekanan. Kartu bergaris putus belum punya peserta — tawarkan ke permintaan yang cocok.
            Buka kartu untuk melihat peserta, kehadiran, dan setoran bulan ini.
          </p>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Tampilan" className="flex rounded-xl bg-muted p-1">
                {[{ k: 'pekan', l: 'Pekan', on: papan }, { k: 'daftar', l: 'Daftar', on: !papan }].map(t => (
                  <Link key={t.k} href={hrefDengan(PATH, param, { tampil: t.k === 'daftar' ? 'daftar' : undefined, hari: undefined })} aria-current={t.on ? 'page' : undefined}
                    className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', t.on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{t.l}</Link>
                ))}
              </div>
              <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
              {[{ id: '', nama: 'Semua jenis' }, ...jenisDipakai].map(j => {
                const on = (sp.jenis ?? '') === j.id
                return (
                  <Link key={j.id || 'semua'} href={hrefDengan(PATH, param, { jenis: j.id || undefined })} aria-current={on ? 'page' : undefined}
                    className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
                    {j.nama}
                  </Link>
                )
              })}
              <form action={PATH} className="flex h-9 w-full items-center gap-2 rounded-xl border bg-card px-3 sm:ml-auto sm:w-72">
                {sp.jenis && <input type="hidden" name="jenis" value={sp.jenis} />}
                {sp.tampil && <input type="hidden" name="tampil" value={sp.tampil} />}
                {sp.status && <input type="hidden" name="status" value={sp.status} />}
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input name="q" defaultValue={sp.q ?? ''} placeholder="Guru, tempat, atau nama peserta" aria-label="Cari halaqoh" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </form>
            </div>
            {!papan && (
              <Slicer label="Hari" options={[
                { label: 'Semua', href: hrefDengan(PATH, param, { hari: undefined }), active: !hariDipilih, count: dasar.length },
                ...hariAda.map(h => ({
                  label: HARI_EKSTRA[h], href: hrefDengan(PATH, param, { hari: String(h) }),
                  active: hariDipilih === h, count: dasar.filter(s => s.hari === h).length,
                })),
              ]} />
            )}

            <details className="group rounded-2xl border bg-card">
              <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-sm font-semibold">
                <Plus className="h-4 w-4 text-primary" />Buat halaqoh ekstra
                <span className="ml-auto text-xs font-normal text-muted-foreground">tanpa menunggu permintaan orang tua</span>
              </summary>
              <div className="border-t p-5">
                {data.jenis.length === 0
                  ? <p className="text-sm text-muted-foreground">Buat jenis ekstra lebih dulu di tab Jenis ekstra.</p>
                  : <FormSlotEkstra jenis={data.jenis} guru={guru} />}
              </div>
            </details>


            <div className="grid grid-cols-2 gap-y-3 rounded-2xl border bg-card py-4 sm:grid-cols-5">
              {ringkas.map(r => (
                <div key={r.l} className="px-5 sm:border-l sm:first:border-l-0">
                  <p className={cn('font-heading text-3xl leading-none tabular-nums', r.c)}>{r.n}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.l}</p>
                </div>
              ))}
            </div>

            {papan && (
              <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                <div className="grid min-w-[980px] grid-cols-7 items-start gap-2.5">
                  {[1, 2, 3, 4, 5, 6, 7].map(h => {
                    const isi = daftar.filter(s => s.hari === h)
                    const hariIni = h === hariIniNo
                    return (
                      <div key={h} className="flex min-w-0 flex-col gap-2">
                        <div className={cn('flex items-baseline gap-1.5 rounded-xl px-2.5 py-2', hariIni ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                          <span className="text-sm font-bold">{HARI_PENDEK[h]}</span>
                          <span className="truncate text-[11px] opacity-75">{isi.length} halaqoh · {isi.reduce((n, s) => n + s.peserta, 0)}</span>
                        </div>
                        {isi.map(s => {
                          const penuh = s.peserta >= s.kuotaEfektif
                          const kosong = s.peserta === 0
                          return (
                            <Link key={s.id} href={`${PATH}/${s.id}`}
                              className={cn('flex flex-col gap-1.5 rounded-xl border bg-card p-2.5 transition-colors hover:border-primary/50',
                                kosong && 'border-dashed border-accent-warm', !s.aktif && 'opacity-60')}>
                              <span className="flex items-center gap-1">
                                <span className="font-heading text-lg leading-none">{jam(s.jam_mulai)}</span>
                                <span className="flex-1" />
                                {!s.aktif ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">nonaktif</span>
                                  : penuh ? <span className="rounded bg-primary-wash px-1.5 py-0.5 text-[10px] font-semibold text-primary">Penuh</span>
                                  : kosong ? <span className="rounded bg-accent-warm-wash px-1.5 py-0.5 text-[10px] font-semibold text-accent-warm">Kosong</span> : null}
                              </span>
                              <span className="text-xs font-bold leading-snug">{s.guru}</span>
                              <span className="text-[11px] leading-snug text-muted-foreground">{s.jenis?.nama ?? '—'}{s.tempat ? <><br />{s.tempat}</> : null}</span>
                              <span className="flex items-center gap-1.5">
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                  <span className={cn('block h-full rounded-full', kosong ? 'bg-accent-warm' : 'bg-primary')} style={{ width: `${s.kuotaEfektif ? Math.min(100, (s.peserta / s.kuotaEfektif) * 100) : 0}%` }} />
                                </span>
                                <span className={cn('text-[11px] font-bold tabular-nums', penuh && 'text-primary')}>{s.peserta}/{s.kuotaEfektif}</span>
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {papan && (
              <p className="text-xs text-muted-foreground">
                {tampilNonaktif ? 'Halaqoh nonaktif ikut tampil (pudar) · ' : 'Halaqoh nonaktif disembunyikan · '}
                <Link href={hrefDengan(PATH, param, { status: tampilNonaktif ? undefined : 'semua' })} className="font-semibold text-primary hover:underline">
                  {tampilNonaktif ? 'sembunyikan' : 'tampilkan'}
                </Link>
              </p>
            )}

            {!papan && (
            <section className="rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
                <p className="text-sm font-semibold">
                  {daftar.length} halaqoh · {totalPeserta} peserta aktif
                </p>
                <Link href={hrefDengan(PATH, param, { status: tampilNonaktif ? undefined : 'semua' })} className="text-xs font-medium text-primary hover:underline">
                  {tampilNonaktif ? 'Sembunyikan halaqoh nonaktif' : 'Tampilkan juga halaqoh nonaktif'}
                </Link>
              </div>
              {daftar.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Tidak ada halaqoh ekstra yang cocok dengan saringan ini.</p>
              ) : (
                <ul className="divide-y">
                  {daftar.map(s => {
                    const anggota = pesertaPerSlot.get(s.id) ?? []
                    const lhi = anggota.filter(p => p.asal === 'lhi').length
                    const isi = s.kuotaEfektif ? Math.min(1, s.peserta / s.kuotaEfektif) : 0
                    return (
                      <li key={s.id}>
                        <Link href={`${PATH}/${s.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/40 md:grid-cols-[130px_minmax(0,1.3fr)_minmax(0,1fr)_150px_20px]">
                          <span className="text-sm font-semibold tabular-nums">
                            {labelSlot(s)}
                            {!s.aktif && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">nonaktif</span>}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground md:order-last" />
                          <span className="col-span-2 min-w-0 md:col-span-1">
                            <span className="block truncate text-sm font-medium">{s.guru}</span>
                            <span className="block truncate text-xs text-muted-foreground">{s.jenis?.nama ?? '—'}</span>
                          </span>
                          <span className="col-span-2 min-w-0 truncate text-xs text-muted-foreground md:col-span-1">{s.tempat || '—'}</span>
                          <span className="col-span-2 md:col-span-1">
                            <span className="flex items-baseline justify-between text-xs">
                              <b className={cn('tabular-nums', s.peserta >= s.kuotaEfektif && 'text-primary')}>{s.peserta}/{s.kuotaEfektif}</b>
                              <span className="text-muted-foreground">{lhi} LHI · {anggota.length - lhi} non</span>
                            </span>
                            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${isi * 100}%` }} />
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
