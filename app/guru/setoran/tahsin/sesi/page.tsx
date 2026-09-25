import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getHalaqohSesiGuru, getSiswaSesiTahsin, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { PilihSesi } from '@/components/setoran/PilihSesi'
import { SetoranSesiTahsin } from '@/components/setoran/SetoranSesiTahsin'
import { getKelompokKlasikal } from '@/lib/data/kelompok-klasikal'
import type { SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'

interface PageProps {
  searchParams: Promise<{ halaqoh?: string }>
}

export default async function SetoranSesiTahsinPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { halaqoh: diminta } = await searchParams
  const daftar = await getHalaqohSesiGuru(session.teacherId)
  const halaqoh = pilihHalaqoh(daftar, diminta)
  // Daftar surat ikut dimuat di sini, bukan di dalam komponen: anak di tahap
  // Al-Qur'an (dan di Gharib/Tajwid) mencatat surat & ayat bacaannya, dan 114
  // baris itu sama untuk semua anak — satu kali ambil untuk seluruh sesi.
  const supabase = createServerClient()
  const [siswa, suratRes, kelompok] = await Promise.all([
    halaqoh ? getSiswaSesiTahsin(halaqoh.id) : Promise.resolve([]),
    supabase.from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id'),
    // Kelompok klasikal yang diatur pengampu (0080).
    halaqoh ? getKelompokKlasikal(halaqoh.id) : Promise.resolve({ tabelAda: false, kelompok: [] }),
  ])
  // Kunci ikut pengaturan: setelah kelompok diubah, layar setoran dibangun ulang dari pengaturan baru.
  const kunciPengaturan = kelompok.kelompok.map(k => `${k.id}:${k.anggota.join(',')}`).join('|')

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Setoran per Sesi</p>
            <h1
              className="text-3xl tracking-tight"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              Setor Tahsin — {halaqoh?.sesi ? `Sesi ${halaqoh.sesi}` : halaqoh?.name ?? 'Sesi'}
            </h1>
          </div>
          <Link href="/guru/setoran/tahsin/baru" className="text-sm text-muted-foreground hover:underline">
            Setor satu-satu →
          </Link>
        </div>

        {!halaqoh ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh. Hubungi admin untuk assign halaqoh.
          </div>
        ) : (
          <>
            <PilihSesi daftar={daftar} terpilih={halaqoh.id} basePath="/guru/setoran/tahsin/sesi" />
            {siswa.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa di sesi ini.
              </div>
            ) : (
              // key: berganti sesi = isian baru, bukan sisa centang sesi sebelumnya.
              <SetoranSesiTahsin
                key={`${halaqoh.id}|${kunciPengaturan}`}
                siswa={siswa}
                surat={(suratRes.data ?? []) as SuratPilihan[]}
                halaqohId={halaqoh.id}
                pengaturan={kelompok.tabelAda ? kelompok.kelompok : null}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
