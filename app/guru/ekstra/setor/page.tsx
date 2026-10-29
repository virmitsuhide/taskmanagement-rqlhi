import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getHadirEkstra, getSlotGuru, hariIniWIB, labelSlot } from '@/lib/data/ekstra'
import { getPilihanJilidAwal, getSiswaSesiTahfidz, getSiswaSesiTahsin } from '@/lib/data/setoran-sesi'
import { SetoranSesiTahfidz, type SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import { SetoranSesiTahsin } from '@/components/setoran/SetoranSesiTahsin'
import { TanggalPertemuan } from '@/components/ekstra/TanggalPertemuan'

/**
 * Setoran pertemuan ekstra — semua kelompok ekstra guru untuk satu jenis
 * (tahsin atau tahfidz) dalam satu halaman, dipisah pembatas jenis ekstra
 * dan jadwalnya. Tiap kelompok punya formulir & tombol Simpan sendiri,
 * karena setorannya ditandai slot ekstranya: capaian sekolah anak ikut
 * maju, tetapi setorannya dilaporkan di laporan ekstra kelompok itu.
 */
export default async function SetorEkstraPage({ searchParams }: { searchParams: Promise<{ slot?: string; jenis?: string; tanggal?: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const jenis = sp.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'
  const hariIni = hariIniWIB()
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal ?? '') && sp.tanggal! <= hariIni ? sp.tanggal! : hariIni

  const { slot, peserta } = await getSlotGuru(session.teacherId)
  // Kelompok materi tidak bersetoran; kelompok khusus tahfidz tidak muncul di tahsin, dan sebaliknya.
  const kelompok = slot.filter(s => s.jenis?.bidang !== 'materi' && s.jenis?.bidang !== (jenis === 'tahsin' ? 'tahfidz' : 'tahsin'))
  if (kelompok.length === 0) redirect('/guru/ekstra')

  const tertaut = peserta.filter(p => kelompok.some(s => s.id === p.slot_id) && p.student_id)
  const hadir = await getHadirEkstra(tertaut.map(p => p.id), tanggal, tanggal)
  const tidakHadir = new Set(hadir.filter(h => h.status !== 'hadir').map(h => h.booking_id))

  const { data: suratRows } = await createServerClient().from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id')
  const surat = (suratRows ?? []) as SuratPilihan[]
  const blok = await Promise.all(kelompok.map(async s => {
    const ids = tertaut.filter(p => p.slot_id === s.id && !tidakHadir.has(p.id)).map(p => p.student_id!)
    if (ids.length === 0) return { slot: s, ids, tahsin: null, tahfidz: null }
    if (jenis === 'tahfidz') return { slot: s, ids, tahsin: null, tahfidz: await getSiswaSesiTahfidz({ siswa: ids }) }
    const siswa = await getSiswaSesiTahsin({ siswa: ids })
    return { slot: s, ids, tahsin: { siswa, jilidAwal: await getPilihanJilidAwal(siswa) }, tahfidz: null }
  }))
  const tanggalTeks = new Date(`${tanggal}T00:00:00+07:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })
  const kembali = `/guru/ekstra?${sp.slot ? `slot=${sp.slot}&` : ''}tanggal=${tanggal}`

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6">
        <div>
          <Link href={kembali} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ChevronLeft className="size-4" /> Ekstra
          </Link>
          <h1 className="mt-1 text-3xl tracking-tight">{jenis === 'tahsin' ? 'Setor tahsin' : 'Setor tahfidz'} ekstra</h1>
          <p className="text-sm text-muted-foreground">
            {tanggalTeks} · semua kelompok ekstra Anda. Simpan tiap kelompok dengan tombolnya masing-masing —
            setoran memajukan capaian sekolah anak dan tercatat di laporan ekstra kelompok itu.
          </p>
          {/* Setoran pertemuan yang terlewat: ganti tanggal di sini, kehadiran tanggal itu ikut dimuat ulang. */}
          <TanggalPertemuan key={tanggal} href={`/guru/ekstra/setor?jenis=${jenis}${sp.slot ? `&slot=${sp.slot}` : ''}`} tanggal={tanggal} maks={hariIni}
            keterangan="Untuk setoran lama, ganti tanggal ini." />
          {kelompok.length > 1 && (
            <nav aria-label="Lompat ke kelompok" className="mt-3 flex flex-wrap gap-2">
              {blok.map(b => (
                <a key={b.slot.id} href={`#slot-${b.slot.id}`}
                  className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                  {b.slot.jenis?.nama} · {labelSlot(b.slot)} · {b.ids.length} hadir
                </a>
              ))}
            </nav>
          )}
        </div>

        {blok.map(b => (
          <section key={b.slot.id} id={`slot-${b.slot.id}`} className="scroll-mt-4 space-y-3 pt-2">
            <div className="flex items-baseline gap-3 border-b-2 border-primary/30 pb-2">
              <h2 className="font-heading text-xl">{b.slot.jenis?.nama}</h2>
              <p className="text-sm text-muted-foreground">{labelSlot(b.slot)} · {b.ids.length} hadir</p>
            </div>
            {b.ids.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-muted/30 py-6 text-center text-sm text-muted-foreground">
                Tidak ada peserta LHI yang hadir dan sudah ditautkan ke data siswa.
              </p>
            ) : b.tahsin ? (
              <SetoranSesiTahsin key={`${b.slot.id}|${tanggal}`} siswa={b.tahsin.siswa} surat={surat}
                halaqohId="" pengaturan={null} tanggalTetap={tanggal} ekstraSlotId={b.slot.id}
                jilidAwal={b.tahsin.jilidAwal} />
            ) : b.tahfidz ? (
              <SetoranSesiTahfidz key={`${b.slot.id}|${tanggal}`} siswa={b.tahfidz} surat={surat}
                tanggalTetap={tanggal} ekstraSlotId={b.slot.id} />
            ) : null}
          </section>
        ))}
      </div>
    </div>
  )
}
