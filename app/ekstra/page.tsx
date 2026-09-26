import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { KartuBooking, type BookingTampil, type InfoHalaqoh } from '@/components/ekstra/KartuBooking'
import {
  bolehGuruEkstra, getBookingEkstra, getCalonSiswa, getDataEkstra, getGuruEkstra, LABEL_STATUS_BOOKING, labelPreferensi, labelSlot, nomorWa, rupiah,
  type SlotEkstra, type StatusBooking,
} from '@/lib/data/ekstra'
import { cn } from '@/lib/utils'

/**
 * Ekstra · booking — kotak masuk permintaan orang tua dan halaqoh ekstra.
 *
 * Orang tua menyampaikan jenis, waktu, dan guru pilihan dari /daftar-ekstra
 * atau tombol Booking di kartu guru. Koordinator menanyakan guru yang bisa di
 * luar sistem, lalu memasukkan anak ke halaqoh ekstra (yang ada atau baru),
 * atau menawarkan guru lain bila guru pilihan tidak bisa.
 */

const TAB: StatusBooking[] = ['baru', 'ditawarkan', 'aktif', 'ditolak', 'berhenti']

export default async function EkstraPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const { status: diminta } = await searchParams
  const status: StatusBooking = TAB.includes(diminta as StatusBooking) ? (diminta as StatusBooking) : 'baru'

  const supabase = createServerClient()
  const [data, semua, guruRes, { ids: guruEkstra }] = await Promise.all([
    getDataEkstra(),
    getBookingEkstra(),
    supabase.from('teachers').select('id, full_name').eq('is_active', true).is('deleted_at', null).order('full_name'),
    getGuruEkstra(),
  ])
  const semuaGuru = ((guruRes.data ?? []) as { id: string; full_name: string }[]).map(g => ({ id: g.id, nama: g.full_name }))
  // Nama untuk menampilkan guru pilihan ortu dari semua guru; calon pengampu halaqoh baru hanya guru ekstra.
  const namaGuru = new Map(semuaGuru.map(g => [g.id, g.nama]))
  const guru = semuaGuru.filter(g => bolehGuruEkstra(guruEkstra, g.id))

  const info = (s: SlotEkstra | undefined): InfoHalaqoh | null => s ? {
    id: s.id, teacherId: s.teacher_id, guru: s.guru ?? '—', label: labelSlot(s), tempat: s.tempat,
    sisa: s.kuotaEfektif - s.peserta,
  } : null
  const slotById = new Map(data.slot.map(s => [s.id, s]))
  const jenisById = new Map(data.jenis.map(j => [j.id, j]))

  const tampil = semua.filter(b => b.status === status)
  if (status === 'aktif' || status === 'berhenti') tampil.reverse()
  const hitung = Object.fromEntries(TAB.map(t => [t, semua.filter(b => b.status === t).length])) as Record<StatusBooking, number>

  // Calon siswa untuk ditautkan: permintaan LHI yang terbuka, atau aktif tapi belum tertaut.
  const perluCalon = tampil.filter(b => b.asal === 'lhi' && (b.status === 'baru' || b.status === 'ditawarkan' || (b.status === 'aktif' && !b.student_id)))
  const calon = new Map(await Promise.all(perluCalon.map(async b => [b.id, await getCalonSiswa(b.nama_anak, b.kelas)] as const)))
  const idTertaut = tampil.filter(b => b.student_id).map(b => b.student_id!)
  const { data: siswaTertaut } = idTertaut.length
    ? await supabase.from('students').select('id, full_name').in('id', idTertaut)
    : { data: [] }
  const namaTertaut = new Map(((siswaTertaut ?? []) as { id: string; full_name: string }[]).map(s => [s.id, s.full_name]))

  const aktifSlot = data.slot.filter(s => s.aktif)
  const guruJadwal = [...new Set(aktifSlot.map(s => s.guru ?? '—'))].sort()

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · booking</p>
          <h1 className="mt-1 text-3xl leading-tight">Permintaan ekstra yang perlu dicarikan guru</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Orang tua memilih jenis, waktu, dan guru pilihan lewat <Link href="/daftar-ekstra" className="font-medium text-primary hover:underline">Daftar Ekstra</Link> atau
            tombol Booking di kartu guru. Tanyakan guru yang bisa, lalu masukkan anak ke halaqoh ekstra — yang sudah ada atau baru — atau tawarkan guru lain.
            Pesan WhatsApp untuk orang tua disiapkan otomatis.
          </p>
        </div>
        <EkstraSubNav />

        {!data.tabelAda ? <MigrasiEkstra /> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Angka label="Permintaan baru" nilai={hitung.baru} nada={hitung.baru ? 'warm' : undefined} />
              <Angka label="Menunggu balasan ortu" nilai={hitung.ditawarkan} />
              <Angka label="Peserta aktif" nilai={hitung.aktif} nada="primary" />
              <Link href="/ekstra/halaqoh" className="rounded-2xl transition-colors hover:bg-muted/40"><Angka label="Halaqoh ekstra berjalan" nilai={aktifSlot.length} ket={`${guruJadwal.length} guru pengampu · lihat halaqoh →`} /></Link>
            </div>

            <div>
              <section className="min-w-0 rounded-2xl border bg-card p-4 md:p-5">
                <nav aria-label="Status" className="flex flex-wrap gap-1.5">
                  {TAB.map(t => (
                    <Link key={t} href={t === 'baru' ? '/ekstra' : `/ekstra?status=${t}`}
                      aria-current={t === status ? 'page' : undefined}
                      className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold',
                        t === status ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
                      {LABEL_STATUS_BOOKING[t]} <span className="tabular-nums opacity-70">{hitung[t]}</span>
                    </Link>
                  ))}
                </nav>
                {tampil.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                    Tidak ada permintaan berstatus {LABEL_STATUS_BOOKING[status].toLowerCase()}.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {tampil.map(b => {
                      const j = jenisById.get(b.jenis_id)
                      const bt: BookingTampil = {
                        id: b.id, status: b.status, nama_anak: b.nama_anak, asal: b.asal, student_id: b.student_id,
                        kelas: b.kelas, posisi_bacaan: b.posisi_bacaan, nama_ortu: b.nama_ortu, wa: b.wa_ortu ? nomorWa(b.wa_ortu) : '',
                        catatan_ortu: b.catatan_ortu, catatan_koor: b.catatan_koor,
                        dibuat: new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }),
                        jenis: {
                          nama: j?.nama ?? '—',
                          biaya: j ? `${rupiah(j.biaya)}${j.biaya ? ` ${j.satuan_biaya}` : ''}` : '—',
                          durasi: j?.durasi_menit ?? 60,
                        },
                        preferensi: labelPreferensi(b),
                        hariPilihan: b.hari_pilihan ?? [],
                        waktuPilihan: b.waktu_pilihan ?? [],
                        // Guru yang sudah dihapus dari data diabaikan (kolom array tidak ber-FK).
                        guruPilihan: (b.guru_pilihan_ids ?? []).filter(id => namaGuru.has(id)).map(id => ({ id, nama: namaGuru.get(id)! })),
                        halaqoh: b.slot_id ? info(slotById.get(b.slot_id)) : null,
                        tawaran: b.slot_tawaran_id ? info(slotById.get(b.slot_tawaran_id)) : null,
                      }
                      const halaqohCocok = aktifSlot.filter(s => s.jenis_id === b.jenis_id).map(s => info(s)!)
                      return (
                        <KartuBooking key={b.id} b={bt} halaqohCocok={halaqohCocok} guru={guru} calon={calon.get(b.id) ?? []}
                          namaSiswaTertaut={b.student_id ? namaTertaut.get(b.student_id) : undefined} />
                      )
                    })}
                  </ul>
                )}
              </section>

            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Angka({ label, nilai, ket, nada }: { label: string; nilai: number; ket?: string; nada?: 'warm' | 'primary' }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-heading text-3xl leading-none tabular-nums', nada === 'warm' && 'text-accent-warm', nada === 'primary' && 'text-primary')}>{nilai}</p>
      {ket && <p className="mt-1.5 text-[11px] text-muted-foreground">{ket}</p>}
    </div>
  )
}
