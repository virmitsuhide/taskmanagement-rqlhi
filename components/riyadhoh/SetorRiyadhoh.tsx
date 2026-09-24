import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getHadirRiyadhoh, getPesertaKelompok, getSabtuPengampu } from '@/lib/data/riyadhoh'
import { getSiswaSesiTahfidz, getSiswaSesiTahsin } from '@/lib/data/setoran-sesi'
import { LABEL_KELOMPOK } from '@/lib/rq/riyadhoh'
import { SetoranSesiTahfidz, type SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import { SetoranSesiTahsin } from '@/components/setoran/SetoranSesiTahsin'

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
    getPesertaKelompok(terpilih.kelompok),
    getHadirRiyadhoh(terpilih.tanggal),
    createServerClient().from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id'),
  ])
  const ids = peserta.filter(p => !hadir[p.id] || hadir[p.id] === 'hadir').map(p => p.id)
  const surat = (suratRes.data ?? []) as SuratPilihan[]
  const tanggalTeks = new Date(`${terpilih.tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6">
        <div>
          <Link href={`/guru/riyadhoh?tanggal=${terpilih.tanggal}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ChevronLeft className="size-4" /> Riyadhoh
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            {jenis === 'tahsin' ? 'Setor Tahsin' : 'Setor Tahfidz'} — Riyadhoh {LABEL_KELOMPOK[terpilih.kelompok]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tanggalTeks} · setoran ini ikut menjadi capaian sekolah anak, dan guru halaqohnya melanjutkan dari sini.
          </p>
        </div>

        {ids.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            Tidak ada peserta yang hadir.
          </div>
        ) : jenis === 'tahsin' ? (
          <SetoranSesiTahsin
            key={terpilih.tanggal}
            siswa={await getSiswaSesiTahsin({ siswa: ids })}
            surat={surat}
            halaqohId=""
            pengaturan={null}
            tanggalTetap={terpilih.tanggal}
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
