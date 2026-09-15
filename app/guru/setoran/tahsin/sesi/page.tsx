import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, getSiswaSesiTahsin, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { PilihSesi } from '@/components/setoran/PilihSesi'
import { SetoranSesiTahsin } from '@/components/setoran/SetoranSesiTahsin'

interface PageProps {
  searchParams: Promise<{ halaqoh?: string }>
}

export default async function SetoranSesiTahsinPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { halaqoh: diminta } = await searchParams
  const daftar = await getHalaqohSesiGuru(session.teacherId)
  const halaqoh = pilihHalaqoh(daftar, diminta)
  const siswa = halaqoh ? await getSiswaSesiTahsin(halaqoh.id) : []

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Setoran per Sesi</p>
            <h1
              className="text-2xl font-extrabold tracking-tight"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              📖 Setor Tahsin — {halaqoh?.sesi ? `Sesi ${halaqoh.sesi}` : halaqoh?.name ?? 'Sesi'}
            </h1>
          </div>
          <Link href="/guru/setoran/tahsin/baru" className="text-sm text-muted-foreground hover:underline">
            Setor satu-satu →
          </Link>
        </div>

        {!halaqoh ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh. Hubungi admin untuk assign halaqoh.
          </div>
        ) : (
          <>
            <PilihSesi daftar={daftar} terpilih={halaqoh.id} basePath="/guru/setoran/tahsin/sesi" />
            {siswa.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa di sesi ini.
              </div>
            ) : (
              // key: berganti sesi = isian baru, bukan sisa centang sesi sebelumnya.
              <SetoranSesiTahsin key={halaqoh.id} siswa={siswa} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
