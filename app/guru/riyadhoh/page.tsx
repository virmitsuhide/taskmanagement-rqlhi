import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, Sparkles } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHadirRiyadhoh, getPesertaKelompok, getSabtuPengampu, getSudahSetorRiyadhoh } from '@/lib/data/riyadhoh'
import { LABEL_KELOMPOK } from '@/lib/rq/riyadhoh'
import { HadirRiyadhoh } from '@/components/riyadhoh/HadirRiyadhoh'
import { PilihSabtu } from '@/components/riyadhoh/PilihSabtu'
import { cn } from '@/lib/utils'

/**
 * Riyadhoh Sabtu — halaman pengampu. Satu Sabtu dibuka sekaligus: catat
 * kehadiran pesertanya, lalu setor tahsin/tahfidz lewat formulir per sesi
 * yang sama dengan halaqoh sekolah. Setoran itu ikut menjadi capaian
 * sekolah anak (0087).
 */
export default async function RiyadhohGuruPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { tanggal: diminta } = await searchParams
  const sabtu = await getSabtuPengampu(session.teacherId, diminta)

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Halaqoh Sabtu</p>
          <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Riyadhoh Qur&apos;an
          </h1>
        </div>

        {sabtu.kelompok.length === 0 ? (
          <Kosong>Anda belum ditetapkan sebagai pengampu Riyadhoh. Koordinator SMP yang menetapkannya.</Kosong>
        ) : !sabtu.terpilih ? (
          <Kosong>
            Belum ada Sabtu yang dijadwalkan untuk kelompok {sabtu.kelompok.map(g => LABEL_KELOMPOK[g]).join(' & ')}.
          </Kosong>
        ) : (
          <Isi sabtu={sabtu} />
        )}
      </div>
    </div>
  )
}

async function Isi({ sabtu }: { sabtu: Awaited<ReturnType<typeof getSabtuPengampu>> }) {
  const { tanggal, kelompok } = sabtu.terpilih!
  const belumTiba = tanggal > sabtu.hariIni
  const [peserta, hadir, sudah] = await Promise.all([
    getPesertaKelompok(kelompok),
    getHadirRiyadhoh(tanggal),
    getSudahSetorRiyadhoh(tanggal),
  ])

  return (
    <>
      <PilihSabtu daftar={sabtu.daftar} terpilih={tanggal} hariIni={sabtu.hariIni} />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3">
        <p className="text-sm">
          <span className={cn('mr-2 rounded-full px-2 py-0.5 text-xs font-semibold text-white', kelompok === 'L' ? 'bg-sky-600' : 'bg-rose-600')}>
            {LABEL_KELOMPOK[kelompok]}
          </span>
          {peserta.length} peserta
        </p>
        {belumTiba ? (
          <p className="text-xs text-muted-foreground">Sabtu ini belum tiba — kehadiran & setoran dicatat pada harinya.</p>
        ) : (
          <div className="flex gap-2">
            <Link href={`/guru/riyadhoh/tahsin?tanggal=${tanggal}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent">
              <BookOpen className="size-4" /> Setor Tahsin
            </Link>
            <Link href={`/guru/riyadhoh/tahfidz?tanggal=${tanggal}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent">
              <Sparkles className="size-4" /> Setor Tahfidz
            </Link>
          </div>
        )}
      </div>

      {peserta.length === 0 ? (
        <Kosong>Belum ada peserta {LABEL_KELOMPOK[kelompok].toLowerCase()}. Koordinator SMP mengatur pesertanya.</Kosong>
      ) : (
        <HadirRiyadhoh
          key={tanggal}
          tanggal={tanggal}
          terkunci={belumTiba}
          peserta={peserta.map(p => ({
            id: p.id,
            nama: p.full_name,
            kelas: p.kelas,
            halaqoh: p.halaqoh_name,
            tahsin: sudah.tahsin.has(p.id),
            tahfidz: sudah.tahfidz.has(p.id),
          }))}
          hadir={hadir}
        />
      )}
    </>
  )
}

function Kosong({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">{children}</div>
}
