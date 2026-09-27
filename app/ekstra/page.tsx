import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, FileText, Search } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import type { BookingTampil, InfoHalaqoh } from '@/components/ekstra/KartuBooking'
import { DetailBooking } from '@/components/ekstra/DetailBooking'
import {
  bolehGuruEkstra, getBookingEkstra, getCalonSiswa, getDataEkstra, getGuruEkstra, LABEL_STATUS_BOOKING, labelPreferensi, labelSlot, nomorWa, rupiah,
  type BookingEkstra, type SlotEkstra, type StatusBooking,
} from '@/lib/data/ekstra'
import { cn } from '@/lib/utils'

/**
 * Ekstra · booking — kotak masuk permintaan orang tua: daftar di kiri,
 * rincian permintaan terpilih di kanan (di ponsel bergantian).
 *
 * Orang tua menyampaikan jenis, waktu, dan guru pilihan dari /daftar-ekstra
 * atau tombol Booking di kartu guru. Koordinator menanyakan guru yang bisa di
 * luar sistem, lalu memasukkan anak ke halaqoh ekstra (yang ada atau baru),
 * atau menawarkan guru lain bila guru pilihan tidak bisa.
 */

const TAB: StatusBooking[] = ['baru', 'ditawarkan', 'aktif', 'ditolak', 'berhenti']
const LABEL_TAB: Record<StatusBooking, string> = { baru: 'Baru', ditawarkan: 'Ditawarkan', aktif: 'Aktif', ditolak: 'Ditolak', berhenti: 'Berhenti' }

const hariSejak = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5))

export default async function EkstraPage({ searchParams }: { searchParams: Promise<{ status?: string; id?: string; q?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const status: StatusBooking = TAB.includes(sp.status as StatusBooking) ? (sp.status as StatusBooking) : 'baru'
  const q = (sp.q ?? '').trim().toLowerCase()

  const supabase = createServerClient()
  const [data, semua, guruRes, { ids: guruEkstra }] = await Promise.all([
    getDataEkstra(),
    getBookingEkstra(),
    supabase.from('teachers').select('id, full_name').eq('is_active', true).is('deleted_at', null).order('full_name'),
    getGuruEkstra(),
  ])
  const semuaGuru = ((guruRes.data ?? []) as { id: string; full_name: string }[]).map(g => ({ id: g.id, nama: g.full_name }))
  const namaGuru = new Map(semuaGuru.map(g => [g.id, g.nama]))
  // Calon pengampu halaqoh baru hanya guru ekstra.
  const guru = semuaGuru.filter(g => bolehGuruEkstra(guruEkstra, g.id))

  const info = (s: SlotEkstra | undefined): InfoHalaqoh | null => s ? {
    id: s.id, teacherId: s.teacher_id, guru: s.guru ?? '—', label: labelSlot(s), tempat: s.tempat,
    sisa: s.kuotaEfektif - s.peserta,
  } : null
  const slotById = new Map(data.slot.map(s => [s.id, s]))
  const jenisById = new Map(data.jenis.map(j => [j.id, j]))
  const aktifSlot = data.slot.filter(s => s.aktif)

  const hitung = Object.fromEntries(TAB.map(t => [t, semua.filter(b => b.status === t).length])) as Record<StatusBooking, number>
  // Permintaan terbuka: terlama di atas. Peserta & arsip: terbaru di atas.
  const tampil = semua.filter(b => b.status === status)
    .filter(b => !q || b.nama_anak.toLowerCase().includes(q) || b.nama_ortu.toLowerCase().includes(q))
  if (status === 'aktif' || status === 'berhenti' || status === 'ditolak') tampil.reverse()

  const dipilih = tampil.find(b => b.id === sp.id) ?? tampil[0] ?? null
  const adaId = !!sp.id && dipilih?.id === sp.id
  const href = (p: { status?: StatusBooking; id?: string }) => {
    const u = new URLSearchParams()
    const st = p.status ?? status
    if (st !== 'baru') u.set('status', st)
    if (p.id) u.set('id', p.id)
    if (q && !p.status) u.set('q', sp.q ?? '')
    const s = u.toString()
    return s ? `/ekstra?${s}` : '/ekstra'
  }

  // Data tambahan hanya untuk permintaan yang sedang dibuka.
  let calon: { id: string; full_name: string; kelas: string | null; jenjang: string }[] = []
  let namaTertaut: string | undefined
  if (dipilih?.asal === 'lhi' && (dipilih.status === 'baru' || dipilih.status === 'ditawarkan' || (dipilih.status === 'aktif' && !dipilih.student_id))) {
    calon = await getCalonSiswa(dipilih.nama_anak, dipilih.kelas)
  }
  if (dipilih?.student_id) {
    const { data: s } = await supabase.from('students').select('full_name').eq('id', dipilih.student_id).maybeSingle()
    namaTertaut = (s as { full_name: string } | null)?.full_name
  }
  const keTampil = (b: BookingEkstra): BookingTampil => {
    const j = jenisById.get(b.jenis_id)
    return {
      id: b.id, status: b.status, nama_anak: b.nama_anak, asal: b.asal, student_id: b.student_id,
      kelas: b.kelas, posisi_bacaan: b.posisi_bacaan, nama_ortu: b.nama_ortu, wa: b.wa_ortu ? nomorWa(b.wa_ortu) : '',
      catatan_ortu: b.catatan_ortu, catatan_koor: b.catatan_koor,
      dibuat: new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }),
      jenis: { nama: j?.nama ?? '—', biaya: j ? `${rupiah(j.biaya)}${j.biaya ? ` ${j.satuan_biaya}` : ''}` : '—', durasi: j?.durasi_menit ?? 60 },
      preferensi: labelPreferensi(b),
      hariPilihan: b.hari_pilihan ?? [],
      waktuPilihan: b.waktu_pilihan ?? [],
      // Guru yang sudah dihapus dari data diabaikan (kolom array tidak ber-FK).
      guruPilihan: (b.guru_pilihan_ids ?? []).filter(id => namaGuru.has(id)).map(id => ({ id, nama: namaGuru.get(id)! })),
      halaqoh: b.slot_id ? info(slotById.get(b.slot_id)) : null,
      tawaran: b.slot_tawaran_id ? info(slotById.get(b.slot_tawaran_id)) : null,
    }
  }

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · booking</p>
            <h1 className="mt-1 font-heading text-3xl leading-tight md:text-[38px]">Permintaan yang perlu dicarikan guru</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Orang tua memilih jenis, waktu, dan guru lewat Daftar Ekstra atau tombol Booking di kartu guru. Tanyakan guru yang bisa,
              lalu masukkan anak ke halaqoh — atau tawarkan guru lain. Pesan WhatsApp untuk Ayah/Bunda disiapkan otomatis.
            </p>
          </div>
          <Link href="/daftar-ekstra" target="_blank" className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-muted">
            <FileText className="h-4 w-4 text-primary" />Formulir daftar
          </Link>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <section className={cn('w-full shrink-0 flex-col gap-3 rounded-2xl bg-muted/50 p-3 md:p-4 lg:sticky lg:top-4 lg:flex lg:w-[360px]', adaId ? 'hidden' : 'flex')}>
              <nav aria-label="Status" className="flex flex-wrap gap-1.5">
                {TAB.map(t => (
                  <Link key={t} href={href({ status: t })} aria-current={t === status ? 'page' : undefined}
                    className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold',
                      t === status ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
                    {LABEL_TAB[t]} <span className="tabular-nums opacity-70">{hitung[t]}</span>
                  </Link>
                ))}
              </nav>
              <form action="/ekstra" className="flex h-10 items-center gap-2 rounded-xl border bg-card px-3">
                {status !== 'baru' && <input type="hidden" name="status" value={status} />}
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input name="q" defaultValue={sp.q ?? ''} placeholder="Cari nama anak atau orang tua" aria-label="Cari permintaan"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </form>
              <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {status === 'baru' || status === 'ditawarkan' ? 'Terlama di atas' : 'Terbaru di atas'}
              </p>
              {tampil.length === 0 ? (
                <p className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
                  Tidak ada permintaan berstatus {LABEL_STATUS_BOOKING[status].toLowerCase()}{q ? ' yang cocok' : ''}.
                </p>
              ) : (
                <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
                  {tampil.map(b => {
                    const on = b.id === dipilih?.id
                    const hari = hariSejak(b.created_at)
                    const terbuka = b.status === 'baru' || b.status === 'ditawarkan'
                    const sl = b.slot_id ? slotById.get(b.slot_id) : undefined
                    return (
                      <li key={b.id}>
                        <Link href={href({ id: b.id })} aria-current={on ? 'true' : undefined}
                          className={cn('flex gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                            on ? 'border-primary bg-card shadow-[0_6px_18px_-12px_rgba(14,53,49,0.45)]' : 'border-transparent hover:bg-card')}>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">{b.nama_anak}</span>
                            <span className="block truncate text-xs text-muted-foreground">{b.asal === 'lhi' ? (b.kelas || 'Siswa LHI') : `Non LHI${b.kelas ? ` · ${b.kelas}` : ''}`}</span>
                            <span className="block truncate text-xs">
                              {jenisById.get(b.jenis_id)?.nama ?? '—'} · <span className="text-muted-foreground">{terbuka ? labelPreferensi(b) : sl ? `${sl.guru} · ${labelSlot(sl)}` : '—'}</span>
                            </span>
                          </span>
                          {terbuka && (
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <span className={cn('text-xs font-bold', hari > 3 ? 'text-destructive' : 'text-muted-foreground')}>{hari === 0 ? 'hari ini' : `${hari} hari`}</span>
                              {hari > 3 && <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden />}
                            </span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <div className={cn('min-w-0 flex-1 flex-col gap-3 lg:flex', adaId ? 'flex' : 'hidden')}>
              {adaId && (
                <Link href={href({})} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden">
                  <ChevronLeft className="h-4 w-4" />Semua permintaan
                </Link>
              )}
              {dipilih ? (
                <DetailBooking key={dipilih.id} b={keTampil(dipilih)} guru={guru} calon={calon} namaSiswaTertaut={namaTertaut}
                  halaqohCocok={aktifSlot.filter(s => s.jenis_id === dipilih.jenis_id).map(s => info(s)!)}
                  menunggu={hariSejak(dipilih.created_at)} />
              ) : (
                <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">Pilih permintaan di sebelah kiri.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
