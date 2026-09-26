import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, MessageCircle, Pencil } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav } from '@/components/ekstra/EkstraSubNav'
import { FormSlotEkstra } from '@/components/ekstra/FormEkstra'
import { AksiPesertaEkstra } from '@/components/ekstra/AksiPesertaEkstra'
import { bolehGuruEkstra, getCalonSiswa, getDataEkstra, getGuruEkstra, getHalaqohEkstra, labelSlot, nomorWa, rupiah } from '@/lib/data/ekstra'
import { cn } from '@/lib/utils'

/**
 * Satu halaqoh ekstra — padanan halaman detail Halaqoh: siapa pengampunya,
 * kapan, di mana, dan siapa pesertanya beserta kehadiran & setoran bulan ini.
 */
export default async function DetailHalaqohEkstraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const { id } = await params
  const [detail, data, guruRes, { ids: guruEkstra }] = await Promise.all([
    getHalaqohEkstra(id),
    getDataEkstra(),
    createServerClient().from('teachers').select('id, full_name').eq('is_active', true).is('deleted_at', null).order('full_name'),
    getGuruEkstra(),
  ])
  if (!detail) notFound()
  const { slot, peserta, berhenti } = detail
  // Pilihan pengampu: guru ekstra, ditambah pengampu halaqoh ini sendiri.
  const guru = ((guruRes.data ?? []) as { id: string; full_name: string }[])
    .filter(g => g.id === slot.teacher_id || bolehGuruEkstra(guruEkstra, g.id))

  // Tujuan pindah: halaqoh lain berjenis sama yang masih berjalan dan masih ada kursi.
  const tujuan = data.slot
    .filter(s => s.id !== slot.id && s.aktif && s.jenis_id === slot.jenis_id && s.peserta < s.kuotaEfektif)
    .map(s => ({ id: s.id, label: `${s.guru} · ${labelSlot(s)} · sisa ${s.kuotaEfektif - s.peserta}` }))
  // Calon data siswa hanya untuk siswa LHI yang belum tertaut.
  const calon = new Map(await Promise.all(peserta.filter(p => p.asal === 'lhi' && !p.student_id).map(async p => [
    p.id, await getCalonSiswa(p.nama_anak, p.kelas),
  ] as const)))

  const j = slot.jenis
  const bulan = labelBulanIni()
  const lhi = peserta.filter(p => p.asal === 'lhi').length

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Halaqoh Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <EkstraSubNav />
        <Link href="/ekstra/halaqoh" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />Semua halaqoh ekstra
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-card p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">{j?.nama ?? 'Ekstra'}</p>
            <h1 className="mt-1 text-3xl leading-tight">{slot.guru}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {labelSlot(slot)}{slot.tempat ? ` · ${slot.tempat}` : ''}
              {j && <> · {rupiah(j.biaya)}{j.biaya ? ` ${j.satuan_biaya}` : ''}</>}
              {!slot.aktif && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">nonaktif</span>}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Angka nilai={`${slot.peserta}/${slot.kuotaEfektif}`} label="peserta" />
            <Angka nilai={String(lhi)} label="siswa LHI" />
            <Angka nilai={String(peserta.length - lhi)} label="non siswa" />
          </div>
        </header>

        <details className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-sm font-semibold">
            <Pencil className="h-4 w-4 text-primary" />Ubah halaqoh
            <span className="ml-auto text-xs font-normal text-muted-foreground">pengampu, jadwal, tempat, kuota, status</span>
          </summary>
          <div className="border-t p-5"><FormSlotEkstra slot={slot} jenis={data.jenis} guru={guru} /></div>
        </details>

        <section className="rounded-2xl border bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3">
            <h2 className="font-heading text-xl">Peserta</h2>
            <p className="text-xs text-muted-foreground">Kehadiran &amp; setoran: {bulan}</p>
          </div>
          {peserta.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Belum ada peserta. Masukkan dari kotak masuk <Link href="/ekstra" className="font-medium text-primary hover:underline">Booking</Link>.
            </p>
          ) : (
            <ul className="divide-y">
              {peserta.map(p => (
                <li key={p.id} className="grid gap-3 px-5 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_110px_minmax(0,1.3fr)] md:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {p.nama_anak}
                      <span className={cn('ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold', p.asal === 'lhi' ? 'bg-primary-wash text-primary' : 'bg-muted text-muted-foreground')}>
                        {p.asal === 'lhi' ? 'Siswa LHI' : 'Non siswa'}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.kelas || '—'}
                      {p.asal === 'lhi' && (p.student_id
                        ? <> · <Link href={`/ekstra/siswa/${p.id}`} className="text-primary hover:underline">tertaut: {p.nama_siswa ?? 'buka'}</Link></>
                        : <span className="text-warning"> · belum tertaut ke data siswa</span>)}
                    </p>
                    {p.posisi_bacaan && <p className="text-xs text-muted-foreground">Posisi: {p.posisi_bacaan}</p>}
                  </div>
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <p className="truncate">{p.nama_ortu || '—'}</p>
                    {p.wa_ortu
                      ? <a href={`https://wa.me/${nomorWa(p.wa_ortu)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><MessageCircle className="h-3 w-3" />{p.wa_ortu}</a>
                      : <p>WA belum diisi</p>}
                    {p.mulai && <p>Mulai {new Date(`${p.mulai}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</p>}
                  </div>
                  <div className="text-xs">
                    <p><b className="tabular-nums">{p.hadir}</b>/{p.pertemuan} hadir</p>
                    <p className="text-muted-foreground">{p.asal === 'lhi' && p.student_id ? `${p.setoran} setoran` : 'setoran: —'}</p>
                  </div>
                  <AksiPesertaEkstra id={p.id} nama={p.nama_anak} tujuan={tujuan} calon={calon.get(p.id) ?? null} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {berhenti.length > 0 && (
          <details className="rounded-2xl border bg-card">
            <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">Pernah ikut ({berhenti.length})</summary>
            <ul className="divide-y border-t">
              {berhenti.map(b => (
                <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 text-sm">
                  <span>{b.nama_anak} <span className="text-xs text-muted-foreground">· {b.asal === 'lhi' ? 'Siswa LHI' : 'Non siswa'}</span></span>
                  <span className="text-xs text-muted-foreground">berhenti {b.berhenti ?? '—'}{b.catatan_koor ? ` · ${b.catatan_koor}` : ''}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}

/** 'September 2026' menurut WIB — bulan yang dipakai kehadiran & setoran di atas. */
function labelBulanIni(): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date())
}

function Angka({ nilai, label }: { nilai: string; label: string }) {
  return (
    <div className="rounded-xl border bg-background px-3 py-2">
      <p className="font-heading text-2xl leading-none tabular-nums">{nilai}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
