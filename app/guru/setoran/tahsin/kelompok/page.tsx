import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, getSiswaSesiTahsin, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { getKelompokKlasikal } from '@/lib/data/kelompok-klasikal'
import { PilihSesi } from '@/components/setoran/PilihSesi'
import { AturKelompokKlasikal } from '@/components/setoran/AturKelompokKlasikal'

interface PageProps {
  searchParams: Promise<{ halaqoh?: string }>
}

/** Pengaturan kelompok klasikal tahsin per sesi — oleh pengampunya sendiri. */
export default async function AturKelompokPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { halaqoh: diminta } = await searchParams
  const daftar = await getHalaqohSesiGuru(session.teacherId)
  const halaqoh = pilihHalaqoh(daftar, diminta)
  const [siswa, kelompok] = await Promise.all([
    halaqoh ? getSiswaSesiTahsin(halaqoh.id) : Promise.resolve([]),
    halaqoh ? getKelompokKlasikal(halaqoh.id) : Promise.resolve({ tabelAda: true, kelompok: [] }),
  ])
  const kunci = kelompok.kelompok.map(k => `${k.id}:${k.anggota.join(',')}`).join('|')

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Setoran Tahsin</p>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              👥 Atur Kelompok Klasikal
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Tentukan anak yang membaca bersama. Anak di luar kelompok setor individual.</p>
          </div>
          {halaqoh && (
            <Link href={`/guru/setoran/tahsin/sesi?halaqoh=${halaqoh.id}`} className="text-sm text-muted-foreground hover:underline">
              ← Setor Tahsin
            </Link>
          )}
        </div>

        {!halaqoh ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh.
          </div>
        ) : !kelompok.tabelAda ? (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ background: 'var(--warning-wash)', color: 'var(--warning)', borderColor: 'transparent' }}>
            Fitur ini belum aktif: migrasi <code>0080_kelompok_klasikal</code> belum dijalankan. Sampaikan kepada admin.
          </div>
        ) : (
          <>
            <PilihSesi daftar={daftar} terpilih={halaqoh.id} basePath="/guru/setoran/tahsin/kelompok" />
            {siswa.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa di sesi ini.
              </div>
            ) : (
              <AturKelompokKlasikal key={`${halaqoh.id}|${kunci}`} halaqohId={halaqoh.id} siswa={siswa} kelompok={kelompok.kelompok} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
