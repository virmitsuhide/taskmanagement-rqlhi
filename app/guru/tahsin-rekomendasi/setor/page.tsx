import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getHadirTR, getKelompokTRGuru, getPesertaTR, hariIniTR } from '@/lib/data/tahsin-rekomendasi'
import { getPilihanJilidAwal, getSiswaSesiTahsin } from '@/lib/data/setoran-sesi'
import { jumatTerakhir, jumatTerbuka } from '@/lib/rq/tahsin-rekomendasi'
import { SetoranSesiTahsin } from '@/components/setoran/SetoranSesiTahsin'
import type { SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'

/**
 * Setor tahsin Tahsin Rekomendasi — formulir per sesi yang sama dengan
 * halaqoh sekolah, diisi peserta kelompok dan tanggal Jum'at dikunci. Anak
 * yang sudah dicatat izin/sakit/alfa tidak ikut ditampilkan. Setiap baris
 * dikirim lewat jalur TR (tahsin_logs.tahsin_rekomendasi).
 */
export default async function SetorTRPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const kelompok = await getKelompokTRGuru(session.teacherId)
  if (!kelompok) redirect('/guru/tahsin-rekomendasi')

  const hariIni = hariIniTR()
  const { tanggal: diminta } = await searchParams
  const tanggal = diminta && jumatTerbuka(hariIni).includes(diminta) ? diminta : jumatTerakhir(hariIni)

  const peserta = await getPesertaTR(session.teacherId)
  const [hadir, suratRes] = await Promise.all([
    getHadirTR(tanggal, peserta.map(p => p.id)),
    createServerClient().from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id'),
  ])
  const ids = peserta.filter(p => !p.lulus_tahsin && (!hadir[p.id] || hadir[p.id] === 'hadir')).map(p => p.id)
  const siswa = ids.length > 0 ? await getSiswaSesiTahsin({ siswa: ids }) : []
  const tanggalTeks = new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pb-6 pt-3 md:px-6 md:pt-6">
        <header className="flex items-center gap-2">
          <Link href={`/guru/tahsin-rekomendasi?tanggal=${tanggal}`} aria-label="Kembali ke kelompok"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-accent">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold leading-tight md:text-lg">Setor tahsin · Kelompok {kelompok.full_name}</h1>
            <p className="truncate text-xs text-muted-foreground">{tanggalTeks} · Tahsin Rekomendasi</p>
          </div>
        </header>

        <p className="text-xs text-muted-foreground">
          Setoran ini ikut menjadi capaian tahsin sekolah anak — posisi jilidnya maju, dan guru halaqohnya melanjutkan dari sini.
          Setoran pagi di sekolah pada Jum&apos;at yang sama tidak tertimpa.
        </p>

        {ids.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Tidak ada peserta yang hadir.
          </div>
        ) : (
          <SetoranSesiTahsin
            key={tanggal}
            siswa={siswa}
            surat={(suratRes.data ?? []) as SuratPilihan[]}
            halaqohId=""
            pengaturan={null}
            tanggalTetap={tanggal}
            tahsinRekomendasi
            jilidAwal={await getPilihanJilidAwal(siswa)}
          />
        )}
      </div>
    </div>
  )
}
