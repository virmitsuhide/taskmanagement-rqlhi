import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { createServerClient } from '@/lib/supabase/server'
import { TahsinSetoranForm } from './TahsinSetoranForm'
import type { SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import { getMateriPerJilid, getHasilMateriPerSiswa } from '@/lib/data/materi-tahsin'

interface PageProps {
  searchParams: Promise<{ student?: string }>
}

export default async function NewTahsinSetoranPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { student: defaultStudentId } = await searchParams

  const supabase = createServerClient()
  const halaqohIds = await getTeacherHalaqohIds(session.teacherId)

  const [studentsRes, methodsRes, jilidRes, suratRes] = await Promise.all([
    halaqohIds.length > 0
      ? supabase
          .from('students')
          .select('id, full_name, jenjang, current_method_id, current_jilid_id, current_jilid_page, tahsin_drill_sejak,'
            + ' current_quran_halaman, current_quran_surat_id, current_quran_ayat,'
            + ' halaqoh:halaqoh!students_halaqoh_id_fkey(name),'
            + ' jilid:jilid_levels!students_current_jilid_id_fkey(is_terminal)')
          .in('halaqoh_id', halaqohIds)
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true).order('name'),
    supabase.from('jilid_levels').select('id, label, method_id, order_num, total_pages, baca_quran').order('order_num'),
    supabase.from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id'),
  ])

  const students = ((studentsRes.data ?? []) as unknown as Array<{
    id: string; full_name: string; jenjang: string; current_method_id: string | null
    current_jilid_id: string | null; current_jilid_page: number | null
    tahsin_drill_sejak: string | null
    current_quran_halaman: number | null; current_quran_surat_id: number | null; current_quran_ayat: number | null
    halaqoh: { name: string } | null
    jilid: { is_terminal: boolean } | null
  }>)
    // Anak yang sudah Lulus Tahsin tidak bisa dipilih — progres tahsinnya sudah selesai.
    .filter(s => !s.jilid?.is_terminal)
    .map(s => ({
    id: s.id,
    full_name: s.full_name,
    jenjang: s.jenjang,
    halaqoh_name: s.halaqoh?.name ?? null,
    current_method_id: s.current_method_id,
    current_jilid_id: s.current_jilid_id,
    current_jilid_page: s.current_jilid_page,
    tahsin_drill_sejak: s.tahsin_drill_sejak,
    quran: {
      halaman: s.current_quran_halaman,
      surat_id: s.current_quran_surat_id,
      ayat: s.current_quran_ayat,
    },
  }))

  /*
    Materi Gharib/Tajwid dimuat untuk SEMUA anak sekaligus, bukan menunggu
    guru memilih satu. Pemilihan siswa terjadi di peramban tanpa perjalanan
    balik ke server, jadi memuat belakangan berarti daftar materinya baru
    muncul beberapa saat setelah namanya dipilih — tepat ketika guru sudah
    mulai mengetik.
  */
  const [materiPerJilid, hasilPerSiswa] = await Promise.all([
    getMateriPerJilid(students.map(s => s.current_jilid_id ?? '')),
    getHasilMateriPerSiswa(students.map(s => s.id)),
  ])

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Setoran Harian</p>
            <h1
              className="text-2xl font-extrabold tracking-tight"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              📖 Setor Tahsin
            </h1>
          </div>
          <Link href="/guru/setoran/tahsin/sesi" className="text-sm font-medium text-primary hover:underline">
            Setor satu sesi sekaligus →
          </Link>
        </div>

        {students.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            Belum ada siswa di halaqoh Anda. Hubungi admin untuk assign siswa.
          </div>
        ) : (
          <TahsinSetoranForm
            students={students}
            methods={methodsRes.data ?? []}
            jilidLevels={jilidRes.data ?? []}
            surat={(suratRes.data ?? []) as SuratPilihan[]}
            materiPerJilid={Object.fromEntries(materiPerJilid)}
            materiHasil={Object.fromEntries(
              [...hasilPerSiswa].map(([id, per]) => [id, Object.fromEntries(per)]),
            )}
            defaultStudentId={defaultStudentId}
          />
        )}
      </div>
    </div>
  )
}
