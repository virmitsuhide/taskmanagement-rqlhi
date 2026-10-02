import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getHadirRiyadhoh, getPesertaKelompok, getSabtuPengampu } from '@/lib/data/riyadhoh'
import { getPilihanJilidAwal, getSiswaSesiTahfidz, getSiswaSesiTahsin } from '@/lib/data/setoran-sesi'
import { LABEL_KELOMPOK } from '@/lib/rq/riyadhoh'
import { SetoranSesiTahfidz, type SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import { SetoranSesiTahsin } from '@/components/setoran/SetoranSesiTahsin'
import { LangkahRingkas } from '@/components/riyadhoh/LangkahRiyadhoh'
import { cn } from '@/lib/utils'

/**
 * Setoran tahsin/tahfidz Riyadhoh — formulir per sesi yang sama dengan
 * halaqoh sekolah, diisi peserta Sabtu itu dan tanggalnya dikunci. Anak yang
 * sudah dicatat izin/sakit/alfa tidak ikut ditampilkan.
 */
export async function SetorRiyadhoh({ jenis, diminta }: { jenis: 'tahsin' | 'tahfidz'; diminta?: string }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sabtu = await getSabtuPengampu(session.teacherId, diminta)
  const terpilih = sabtu.terpilih
  if (!terpilih || terpilih.tanggal > sabtu.hariIni) redirect('/guru/riyadhoh')

  const [peserta, hadir, suratRes] = await Promise.all([
    getPesertaKelompok(terpilih.kelompok, session.teacherId),
    getHadirRiyadhoh(terpilih.tanggal),
    createServerClient().from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id'),
  ])
  const ids = peserta.filter(p => !hadir[p.id] || hadir[p.id] === 'hadir').map(p => p.id)
  const siswaTahsin = jenis === 'tahsin' && ids.length > 0 ? await getSiswaSesiTahsin({ siswa: ids }) : []
  const surat = (suratRes.data ?? []) as SuratPilihan[]
  const tanggalTeks = new Date(`${terpilih.tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pb-6 pt-3 md:px-6 md:pt-6">
        <header className="flex items-center gap-2">
          <Link href={`/guru/riyadhoh?tanggal=${terpilih.tanggal}`} aria-label="Kembali ke Riyadhoh"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-accent">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold leading-tight md:text-lg">
              {jenis === 'tahsin' ? 'Setor tahsin' : 'Setor tahfidz'} · Riyadhoh {LABEL_KELOMPOK[terpilih.kelompok]}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{tanggalTeks}</p>
          </div>
        </header>

        <LangkahRingkas tanggal={terpilih.tanggal} aktif={2} />

        {/* Dua formulir setoran — tahsin dan tahfidz — adalah langkah yang sama. */}
        <div className="flex gap-1.5">
          {(['tahsin', 'tahfidz'] as const).map(j => (
            <Link
              key={j}
              href={`/guru/riyadhoh/${j}?tanggal=${terpilih.tanggal}`}
              aria-current={j === jenis ? 'page' : undefined}
              className={cn(
                'inline-flex h-[34px] items-center rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
                j === jenis ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent',
              )}
            >
              {j === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
            </Link>
          ))}
          <Link href={`/guru/riyadhoh/laporan?tanggal=${terpilih.tanggal}`}
            className="ml-auto inline-flex h-[34px] items-center text-[12.5px] font-bold text-primary hover:underline">
            Lanjut ke laporan →
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Setoran ini ikut menjadi capaian sekolah anak, dan guru halaqohnya melanjutkan dari sini.
        </p>

        {ids.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Tidak ada peserta yang hadir.
          </div>
        ) : jenis === 'tahsin' ? (
          <SetoranSesiTahsin
            key={terpilih.tanggal}
            siswa={siswaTahsin}
            surat={surat}
            halaqohId=""
            pengaturan={null}
            tanggalTetap={terpilih.tanggal}
            hrefSatuSatu={`/guru/setoran/tahsin/baru?riyadhoh=${terpilih.tanggal}&student=`}
            jilidAwal={await getPilihanJilidAwal(siswaTahsin)}
          />
        ) : (
          <SetoranSesiTahfidz
            key={terpilih.tanggal}
            siswa={await getSiswaSesiTahfidz({ siswa: ids })}
            surat={surat}
            tanggalTetap={terpilih.tanggal}
          />
        )}
      </div>
    </div>
  )
}
