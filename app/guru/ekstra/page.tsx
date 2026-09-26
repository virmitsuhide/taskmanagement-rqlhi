import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, Sparkles } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHadirEkstra, getSlotGuru, labelSlot } from '@/lib/data/ekstra'
import { HadirEkstra } from '@/components/ekstra/HadirEkstra'
import { LaporanEkstra } from '@/components/ekstra/LaporanEkstra'
import { cn } from '@/lib/utils'

/**
 * Ekstra di portal guru — slot yang diampu, kehadiran tiap pertemuan,
 * setoran peserta LHI, dan laporan ekstra bulan ini.
 */
export default async function GuruEkstraPage({ searchParams }: { searchParams: Promise<{ slot?: string; tanggal?: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const { tabelAda, slot, peserta } = await getSlotGuru(session.teacherId)
  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal ?? '') && sp.tanggal! <= hariIni ? sp.tanggal! : hariIni
  const aktif = slot.find(s => s.id === sp.slot) ?? slot[0]
  const anggota = aktif ? peserta.filter(p => p.slot_id === aktif.id) : []
  const hadir = aktif ? await getHadirEkstra(anggota.map(p => p.id), tanggal, tanggal) : []
  const awal = Object.fromEntries(hadir.map(h => [h.booking_id, h.status]))
  const bisaSetor = anggota.filter(p => p.student_id && (awal[p.id] ?? 'hadir') === 'hadir').length
  const bidang = aktif?.jenis?.bidang

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Ekstra tahsin &amp; tahfidz</p>
          <h1 className="mt-1 text-3xl tracking-tight">Ekstra yang saya ampu</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Setoran ekstra anak LHI ikut memajukan capaian sekolahnya, tetapi dilaporkan di laporan ekstra — bukan di laporan orang tua halaqoh.
          </p>
        </header>

        {!tabelAda || slot.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu slot ekstra. Slot dibuka oleh Koordinator Ekstra.
          </p>
        ) : (
          <>
            {slot.length > 1 && (
              <nav aria-label="Pilih slot" className="flex flex-wrap gap-2">
                {slot.map(s => (
                  <Link key={s.id} href={`/guru/ekstra?slot=${s.id}`}
                    className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium',
                      s.id === aktif?.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
                    {s.jenis?.nama} · {labelSlot(s)}
                  </Link>
                ))}
              </nav>
            )}

            {aktif && (
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section className="rounded-2xl border bg-card p-4 md:p-5">
                  <h2 className="font-heading text-xl">{aktif.jenis?.nama}</h2>
                  <p className="text-xs text-muted-foreground">{labelSlot(aktif)}{aktif.tempat ? ` · ${aktif.tempat}` : ''} · {anggota.length} peserta</p>
                  <form className="mt-4 flex items-end gap-2" action="/guru/ekstra">
                    <input type="hidden" name="slot" value={aktif.id} />
                    <label className="flex flex-col gap-1 text-xs font-semibold">
                      Tanggal pertemuan
                      <input type="date" name="tanggal" defaultValue={tanggal} max={hariIni} className="h-9 rounded-md border bg-background px-2 text-sm font-normal" />
                    </label>
                    <button type="submit" className="h-9 rounded-md border bg-card px-3 text-sm hover:bg-muted">Buka</button>
                  </form>
                  <div className="mt-4">
                    {anggota.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada peserta aktif.</p>
                    ) : (
                      <HadirEkstra key={`${aktif.id}|${tanggal}`} slotId={aktif.id} tanggal={tanggal}
                        peserta={anggota.map(p => ({ id: p.id, nama: p.nama_anak, ket: p.asal === 'lhi' ? (p.student_id ? 'Siswa LHI' : 'Siswa LHI · belum ditautkan koordinator') : 'Luar LHI · hanya kehadiran' }))}
                        awal={awal} />
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border bg-card p-4 md:p-5">
                  <h2 className="font-heading text-xl">Setoran pertemuan ini</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bisaSetor} peserta LHI hadir bisa disetor. Peserta luar LHI dan yang belum ditautkan hanya dicatat kehadirannya.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {bidang !== 'tahfidz' && (
                      <Link href={`/guru/ekstra/setor?slot=${aktif.id}&jenis=tahsin&tanggal=${tanggal}`}
                        className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground hover:opacity-90">
                        <BookOpen className="h-5 w-5" /><span className="text-sm font-semibold">Setor tahsin</span>
                      </Link>
                    )}
                    {bidang !== 'tahsin' && (
                      <Link href={`/guru/ekstra/setor?slot=${aktif.id}&jenis=tahfidz&tanggal=${tanggal}`}
                        className="flex items-center gap-3 rounded-xl border px-4 py-3 hover:border-primary/40">
                        <Sparkles className="h-5 w-5 text-primary" /><span className="text-sm font-semibold">Setor tahfidz</span>
                      </Link>
                    )}
                  </div>
                </section>
              </div>
            )}

            {aktif && (
              <div>
                <h2 className="mb-3 font-heading text-2xl">Laporan ekstra bulan ini</h2>
                <LaporanEkstra slot={[aktif]} peserta={anggota} bulan={hariIni.slice(0, 7)} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
