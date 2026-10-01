import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getKelompokAsrama } from '@/lib/data/asrama'
import { getSiswaSesiTahfidz } from '@/lib/data/setoran-sesi'
import { SetoranSesiTahfidz, type SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import { PilihKelompokAsrama } from '@/components/asrama/PilihKelompokAsrama'

interface PageProps {
  searchParams: Promise<{ kelompok?: string }>
}

/**
 * Tahfidz Asrama — Sesi Tahfidz untuk kelompok asrama yang diampu (0110).
 * Formulirnya sama; setorannya dicatat lewat jalur asrama: melanjutkan
 * hafalan yang sama dengan sekolah, ditandai "A", dan tidak menimpa setoran
 * sekolah di tanggal yang sama.
 */
export default async function TahfidzAsramaPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { kelompok: diminta } = await searchParams
  const daftar = await getKelompokAsrama({ pengampuId: session.teacherId })
  const kelompok = daftar.find(k => k.id === diminta) ?? daftar[0] ?? null
  const ids = kelompok?.anggota.map(a => a.student_id) ?? []

  const [siswa, suratRes] = await Promise.all([
    ids.length ? getSiswaSesiTahfidz({ siswa: ids }) : Promise.resolve([]),
    createServerClient().from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id'),
  ])

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Halaqoh Asrama</p>
          <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Tahfidz Asrama{kelompok ? ` — ${kelompok.nama}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Hafalan anak melanjutkan capaian sekolahnya; pengampu sekolah ikut melihat setoran dari asrama.
          </p>
        </div>

        {!kelompok ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum ditetapkan sebagai pengampu kelompok asrama.
          </div>
        ) : (
          <>
            <PilihKelompokAsrama daftar={daftar} terpilih={kelompok.id} basePath="/guru/setoran/tahfidz/asrama" />
            {siswa.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Kelompok ini belum punya anggota.
              </div>
            ) : (
              <SetoranSesiTahfidz key={kelompok.id} siswa={siswa} surat={(suratRes.data ?? []) as SuratPilihan[]} asrama />
            )}
          </>
        )}
      </div>
    </div>
  )
}
