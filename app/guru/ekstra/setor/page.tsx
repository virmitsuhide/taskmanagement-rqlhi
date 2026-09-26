import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getHadirEkstra, getSlotGuru, labelSlot } from '@/lib/data/ekstra'
import { getSiswaSesiTahfidz, getSiswaSesiTahsin } from '@/lib/data/setoran-sesi'
import { SetoranSesiTahfidz, type SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import { SetoranSesiTahsin } from '@/components/setoran/SetoranSesiTahsin'

/**
 * Setoran pertemuan ekstra — formulir per sesi yang sama dengan halaqoh,
 * diisi peserta LHI yang hadir. Tiap baris ditandai slot ekstranya, jadi
 * capaiannya ikut maju tetapi setorannya dilaporkan di laporan ekstra.
 */
export default async function SetorEkstraPage({ searchParams }: { searchParams: Promise<{ slot?: string; jenis?: string; tanggal?: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const jenis = sp.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'
  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal ?? '') && sp.tanggal! <= hariIni ? sp.tanggal! : hariIni

  const { slot, peserta } = await getSlotGuru(session.teacherId)
  const aktif = slot.find(s => s.id === sp.slot)
  if (!aktif) redirect('/guru/ekstra')

  const anggota = peserta.filter(p => p.slot_id === aktif.id && p.student_id)
  const hadir = await getHadirEkstra(anggota.map(p => p.id), tanggal, tanggal)
  const tidakHadir = new Set(hadir.filter(h => h.status !== 'hadir').map(h => h.booking_id))
  const ids = anggota.filter(p => !tidakHadir.has(p.id)).map(p => p.student_id!)

  const { data: suratRows } = await createServerClient().from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id')
  const surat = (suratRows ?? []) as SuratPilihan[]
  const tanggalTeks = new Date(`${tanggal}T00:00:00+07:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6">
        <div>
          <Link href={`/guru/ekstra?slot=${aktif.id}&tanggal=${tanggal}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ChevronLeft className="size-4" /> Ekstra
          </Link>
          <h1 className="mt-1 text-3xl tracking-tight">
            {jenis === 'tahsin' ? 'Setor tahsin' : 'Setor tahfidz'} — {aktif.jenis?.nama}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tanggalTeks} · {labelSlot(aktif)} · setoran ini memajukan capaian sekolah anak dan tercatat di laporan ekstra.
          </p>
        </div>

        {ids.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Tidak ada peserta LHI yang hadir dan sudah ditautkan ke data siswa.
          </div>
        ) : jenis === 'tahsin' ? (
          <SetoranSesiTahsin key={`${aktif.id}|${tanggal}`} siswa={await getSiswaSesiTahsin({ siswa: ids })} surat={surat}
            halaqohId="" pengaturan={null} tanggalTetap={tanggal} ekstraSlotId={aktif.id} />
        ) : (
          <SetoranSesiTahfidz key={`${aktif.id}|${tanggal}`} siswa={await getSiswaSesiTahfidz({ siswa: ids })} surat={surat}
            tanggalTetap={tanggal} ekstraSlotId={aktif.id} />
        )}
      </div>
    </div>
  )
}
