import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BookOpen, CalendarCheck, MessageCircle, NotebookPen, UsersRound } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra, canViewStudents, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav } from '@/components/ekstra/EkstraSubNav'
import { Panel } from '@/components/dashboard/kit'
import {
  getBookingEkstra, getDataEkstra, getHadirEkstra, hariIniWIB, getRiwayatSetoranEkstra, kunciOrang, labelPreferensi, labelSlot,
  LABEL_STATUS_BOOKING, nomorWa, type StatusHadirEkstra,
} from '@/lib/data/ekstra'
import type { Jenjang } from '@/types'
import { cn } from '@/lib/utils'

const WARNA_HADIR: Record<StatusHadirEkstra, string> = {
  hadir: 'bg-primary-wash text-primary', izin: 'bg-info-wash text-info', sakit: 'bg-accent-warm-wash text-accent-warm', alfa: 'bg-destructive-wash text-destructive',
}
const tgl = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
const tglPendek = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

type SiswaRow = {
  id: string; full_name: string; kelas: string | null; jenjang: Jenjang; program: string | null; current_jilid_page: number | null
  halaqoh: { name: string } | null; current_method: { name: string } | null; current_jilid: { label: string } | null
}

/**
 * Halaman satu siswa ekstra: identitas bertanda "Siswa ekstra", posisi
 * bacaan, riwayat setoran ekstra, ekstra yang diikuti, kehadiran, dan orang
 * tua. `id` = salah satu booking anak itu; booking lain anak yang sama ikut
 * dikumpulkan.
 */
export default async function DetailSiswaEkstraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const { id } = await params
  const [semua, data] = await Promise.all([getBookingEkstra(), getDataEkstra()])
  const inti = semua.find(b => b.id === id)
  if (!inti) notFound()
  const kunci = kunciOrang(inti)
  const booking = semua.filter(b => kunciOrang(b) === kunci && ['aktif', 'berhenti'].includes(b.status))
    .sort((a, b) => (a.status === 'aktif' ? 0 : 1) - (b.status === 'aktif' ? 0 : 1) || (b.mulai ?? '').localeCompare(a.mulai ?? ''))
  if (booking.length === 0) booking.push(inti)

  const slotById = new Map(data.slot.map(s => [s.id, s]))
  const jenisById = new Map(data.jenis.map(j => [j.id, j]))
  const hariIni = hariIniWIB()
  const awalBulan = `${hariIni.slice(0, 7)}-01`
  const supabase = createServerClient()
  const sid = inti.student_id
  const [siswaRes, hadir, setoran, tsBulan, tfBulan, tfAkhir] = await Promise.all([
    sid
      ? supabase.from('students').select(`id, full_name, kelas, jenjang, program, current_jilid_page,
          halaqoh:halaqoh!students_halaqoh_id_fkey(name),
          current_method:tahsin_methods!students_current_method_id_fkey(name),
          current_jilid:jilid_levels!students_current_jilid_id_fkey(label)`).eq('id', sid).maybeSingle()
      : Promise.resolve({ data: null }),
    getHadirEkstra(booking.map(b => b.id), '2000-01-01', hariIni),
    sid ? getRiwayatSetoranEkstra(sid) : Promise.resolve([]),
    // Seluruh setoran bulan ini (sekolah + ekstra) — untuk porsi ekstra.
    sid ? supabase.from('tahsin_logs').select('id', { count: 'exact', head: true }).eq('student_id', sid).gte('setoran_date', awalBulan) : Promise.resolve({ count: null }),
    sid ? supabase.from('tahfidz_logs').select('id', { count: 'exact', head: true }).eq('student_id', sid).gte('setoran_date', awalBulan) : Promise.resolve({ count: null }),
    // Posisi tahfidz: setoran tahfidz terakhir, sekolah maupun ekstra.
    sid ? supabase.from('tahfidz_logs').select('setoran_date, ayat_ke, surat:surat_master!tahfidz_logs_surat_id_fkey(name_latin, juz_start)')
      .eq('student_id', sid).order('setoran_date', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const siswa = siswaRes.data as unknown as SiswaRow | null
  const tfTerakhir = tfAkhir.data as unknown as { setoran_date: string; ayat_ke: number | null; surat: { name_latin: string; juz_start: number | null } | null } | null
  const lhi = inti.asal === 'lhi'
  const nama = siswa?.full_name ?? inti.nama_anak
  const aktif = booking.filter(b => b.status === 'aktif')
  const hadirUrut = [...hadir].sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  const hadirBulan = hadir.filter(h => h.tanggal >= awalBulan).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  const nHadirBulan = hadirBulan.filter(h => h.status === 'hadir').length
  const setoranBulan = setoran.filter(s => s.tanggal >= awalBulan).length
  const semuaBulan = (tsBulan.count ?? 0) + (tfBulan.count ?? 0)
  const namaSlot = (slotId: string) => {
    const s = slotById.get(slotId)
    return s ? `${s.guru} · ${labelSlot(s)}` : 'Halaqoh ekstra'
  }
  const slotBooking = new Map(booking.map(b => [b.id, b.slot_id]))
  const bulanTeks = new Intl.DateTimeFormat('id-ID', { month: 'long', timeZone: 'Asia/Jakarta' }).format(new Date())
  const inisial = nama.split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Siswa Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <EkstraSubNav />

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-wash font-heading text-2xl text-primary">{inisial}</span>
            <div className="min-w-0">
              <Link href="/ekstra/siswa" className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-warm hover:underline">Siswa ekstra</Link>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-3xl leading-tight md:text-[40px]">{nama}</h1>
                {aktif.length === 0
                  ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">sudah berhenti</span>
                  : <span className="rounded-full bg-accent-warm-wash px-2.5 py-1 text-xs font-semibold text-accent-warm">Siswa ekstra</span>}
              </div>
              <p className="text-sm text-muted-foreground">
                {siswa
                  ? [lhi ? 'Siswa LHI' : null, siswa.kelas ? `Kelas ${siswa.kelas}` : null, JENJANG_LABELS[siswa.jenjang] ?? siswa.jenjang, siswa.halaqoh ? `halaqoh sekolah ${siswa.halaqoh.name}` : null].filter(Boolean).join(' · ')
                  : [lhi ? 'Siswa LHI — belum tertaut ke data siswa' : 'Non siswa LHI', inti.kelas].filter(Boolean).join(' · ')}
                {siswa && canViewStudents(session.role, siswa.jenjang, siswa.program) && (
                  <> · <Link href={`/siswa/${siswa.id}`} className="font-semibold text-primary hover:underline">buka data siswa</Link></>
                )}
              </p>
            </div>
          </div>
          {inti.wa_ortu && (
            <a href={`https://wa.me/${nomorWa(inti.wa_ortu)}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-muted">
              <MessageCircle className="h-4 w-4 text-primary" />Hubungi Ayah/Bunda
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Angka label="Ekstra diikuti" nilai={String(aktif.length)} ket={booking.length > aktif.length ? `${booking.length - aktif.length} sudah berhenti` : 'semua masih berjalan'} />
          <Angka label="Kehadiran" nilai={hadirBulan.length ? `${Math.round((nHadirBulan / hadirBulan.length) * 100)}%` : '—'} kelas="text-primary"
            ket={hadirBulan.length ? `${nHadirBulan} dari ${hadirBulan.length} pertemuan · ${bulanTeks}` : `belum ada presensi ${bulanTeks}`} />
          <Angka label="Setoran ekstra" nilai={sid ? String(setoranBulan) : '—'} ket={sid ? `${bulanTeks} · ikut capaian sekolah` : 'hanya siswa LHI yang tertaut'} />
          <Angka label="Setoran terakhir" nilai={setoran[0] ? tglPendek(setoran[0].tanggal) : '—'} ket={setoran[0]?.ringkas ?? (inti.posisi_bacaan ? `Posisi: ${inti.posisi_bacaan}` : 'belum ada setoran ekstra')} />
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <Panel title="Posisi bacaan" icon={<BookOpen className="h-4 w-4" />}>
              {siswa ? (
                <>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Tahsin{siswa.current_method ? ` · ${siswa.current_method.name}` : ''}</p>
                      <p className="mt-1 font-heading text-2xl leading-tight">{siswa.current_jilid?.label ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{siswa.current_jilid_page ? `hal. ${siswa.current_jilid_page}` : 'halaman belum tercatat'}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Tahfidz</p>
                      <p className="mt-1 font-heading text-2xl leading-tight">{tfTerakhir?.surat ? `${tfTerakhir.surat.name_latin}${tfTerakhir.ayat_ke ? ` ${tfTerakhir.ayat_ke}` : ''}` : '—'}</p>
                      <p className="text-xs text-muted-foreground">{tfTerakhir ? `${tfTerakhir.surat?.juz_start ? `juz ${tfTerakhir.surat.juz_start} · ` : ''}setoran ${tglPendek(tfTerakhir.setoran_date)}` : 'belum ada setoran tahfidz'}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Posisi dari setoran terakhir — sekolah maupun ekstra.{semuaBulan > 0 && ` ${setoranBulan} dari ${semuaBulan} setoran ${bulanTeks} berasal dari ekstra.`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {inti.posisi_bacaan ? <>Posisi bacaan tercatat: <b className="text-foreground">{inti.posisi_bacaan}</b>. </> : null}
                  {lhi ? 'Tautkan ke data siswa LHI agar posisi mengikuti setoran.' : 'Peserta non LHI: posisi dicatat koordinator/guru ekstra.'}
                </p>
              )}
            </Panel>

            <Panel title="Riwayat setoran ekstra" icon={<NotebookPen className="h-4 w-4" />} sub="Dicatat guru di halaqoh ekstra · tidak masuk laporan orang tua halaqoh">
              {!sid ? (
                <p className="text-sm text-muted-foreground">
                  {lhi
                    ? 'Anak ini belum ditautkan ke data siswa LHI, jadi guru belum bisa mencatat setorannya. Tautkan dari kotak masuk Booking.'
                    : 'Peserta non siswa LHI tidak punya catatan setoran di aplikasi; perkembangannya tercatat lewat posisi bacaan dan kehadiran.'}
                </p>
              ) : setoran.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada setoran ekstra.</p>
              ) : (
                <ol className="max-h-[560px] overflow-y-auto">
                  {setoran.map((s, i) => (
                    <li key={i} className="grid grid-cols-[64px_14px_minmax(0,1fr)_auto] gap-3">
                      <span className="pt-0.5 text-xs font-bold text-muted-foreground">{tglPendek(s.tanggal)}</span>
                      <span className="flex flex-col items-center">
                        <span className={cn('mt-1 h-2.5 w-2.5 rounded-full', s.jenis === 'tahsin' ? 'bg-primary' : 'bg-accent-warm')} />
                        {i < setoran.length - 1 && <span className="mt-1 w-0.5 flex-1 bg-border" />}
                      </span>
                      <span className="min-w-0 pb-4">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', s.jenis === 'tahsin' ? 'bg-primary-wash text-primary' : 'bg-accent-warm-wash text-accent-warm')}>
                            {s.jenis === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
                          </span>
                          <span className="text-sm font-semibold">{s.ringkas}</span>
                        </span>
                        <span className="block text-xs text-muted-foreground">{namaSlot(s.slot_id)}</span>
                      </span>
                      <span className="font-heading text-lg tabular-nums">{s.nilai ?? '—'}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>

          <div className="space-y-5 lg:col-span-5">
            <Panel title="Ekstra yang diikuti" icon={<UsersRound className="h-4 w-4" />}>
              <ul className="space-y-2">
                {booking.map(b => {
                  const sl = b.slot_id ? slotById.get(b.slot_id) : undefined
                  return (
                    <li key={b.id} className={cn('rounded-xl bg-muted/50 px-3.5 py-3', b.status === 'berhenti' && 'opacity-60')}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold">{jenisById.get(b.jenis_id)?.nama ?? '—'}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{LABEL_STATUS_BOOKING[b.status]}</span>
                      </div>
                      {sl ? (
                        <Link href={`/ekstra/halaqoh/${sl.id}`} className="block text-xs font-semibold text-primary hover:underline">{sl.guru} · {labelSlot(sl)}{sl.tempat ? ` · ${sl.tempat}` : ''}</Link>
                      ) : <span className="block text-xs text-muted-foreground">Belum ada halaqoh · {labelPreferensi(b)}</span>}
                      <span className="block text-xs text-muted-foreground">
                        {b.mulai ? `Mulai ${tgl(b.mulai)}` : 'Tanggal mulai belum dicatat'}{b.berhenti ? ` · berhenti ${tgl(b.berhenti)}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel title={`Kehadiran ${bulanTeks}`} icon={<CalendarCheck className="h-4 w-4" />}
              sub={hadirUrut.length > hadirBulan.length ? `${hadirUrut.length} pertemuan tercatat sejak awal` : undefined}>
              {hadirBulan.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada presensi ekstra bulan ini.</p> : (
                <ul className="grid grid-cols-4 gap-1.5">
                  {hadirBulan.map(h => (
                    <li key={`${h.booking_id}-${h.tanggal}`} title={`${namaSlot(slotBooking.get(h.booking_id) ?? '')}${h.catatan ? ` · ${h.catatan}` : ''}`}
                      className={cn('flex flex-col items-center rounded-xl py-2', WARNA_HADIR[h.status])}>
                      <span className="font-heading text-lg leading-none text-foreground">{h.tanggal.slice(8).replace(/^0/, '')}</span>
                      <span className="text-[10.5px] font-bold">{h.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Orang tua" icon={<MessageCircle className="h-4 w-4" />}>
              <p className="text-sm font-bold">{inti.nama_ortu || '—'}</p>
              {inti.wa_ortu && (
                <a href={`https://wa.me/${nomorWa(inti.wa_ortu)}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline">{inti.wa_ortu}</a>
              )}
              {inti.catatan_ortu && <p className="mt-2 text-sm text-muted-foreground">&ldquo;{inti.catatan_ortu}&rdquo;</p>}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}

function Angka({ label, nilai, ket, kelas }: { label: string; nilai: string; ket: string; kelas?: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1.5 font-heading text-[32px] leading-none tabular-nums', kelas)}>{nilai}</p>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">{ket}</p>
    </div>
  )
}
