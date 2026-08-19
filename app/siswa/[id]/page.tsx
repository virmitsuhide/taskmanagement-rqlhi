import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageSetoran, canManageStudents, canViewStudents, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { SetoranKoreksi, type SetoranItem } from '@/components/siswa/SetoranKoreksi'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { Pencil, Phone, Mail, GraduationCap, BookOpen } from 'lucide-react'
import type { Jenjang, Gender } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StudentDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const supabase = createServerClient()
  const { data: student } = await supabase
    .from('students')
    .select(`
      *,
      halaqoh:halaqoh!students_halaqoh_id_fkey(id, name),
      current_method:tahsin_methods!students_current_method_id_fkey(id, name),
      current_jilid:jilid_levels!students_current_jilid_id_fkey(id, label)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!student) notFound()
  if (!canViewStudents(session.role, student.jenjang as Jenjang)) redirect('/siswa')

  const canEdit = canManageStudents(session.role, student.jenjang as Jenjang)

  // Hitung agregat sederhana
  const { count: tahsinCount } = await supabase
    .from('tahsin_logs').select('*', { count: 'exact', head: true }).eq('student_id', id)
  const { count: tahfidzCount } = await supabase
    .from('tahfidz_logs').select('*', { count: 'exact', head: true }).eq('student_id', id)
  const { data: juzProgress } = await supabase
    .from('juz_progress').select('juz_number, ayat_hafal').eq('student_id', id).order('juz_number')

  // Riwayat setoran hanya diambil untuk yang berwenang mengoreksinya —
  // bagi yang lain, tiga query ini sia-sia.
  const canKoreksi = canManageSetoran(session.role, student.jenjang as Jenjang)
  const setoranItems: SetoranItem[] = canKoreksi ? await ambilSetoran(supabase, id) : []

  const initials = student.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
  const genderIcon = student.gender === 'L' ? '👦' : student.gender === 'P' ? '👧' : ''

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Siswa', href: '/siswa' }, { label: student.full_name }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* Hero */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-2xl font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight">{student.full_name}</h1>
                <span className="text-sm">{genderIcon}</span>
                {!student.is_active && <span className="text-xs text-amber-600">⚠ Nonaktif</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {student.nis ? `NIS ${student.nis} · ` : ''}
                Bergabung {new Date(student.enrolled_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' })}
              </p>
              <div className="flex flex-wrap gap-3 mt-3 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  {JENJANG_LABELS[student.jenjang as Jenjang]}{student.kelas ? ` · Kelas ${student.kelas}` : ''}
                </span>
                {student.halaqoh && (
                  <Link
                    href={`/halaqoh/${student.halaqoh.id}`}
                    className="inline-flex items-center gap-1.5 hover:underline"
                  >
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    {student.halaqoh.name}
                  </Link>
                )}
              </div>
            </div>
            {canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/siswa/${id}/edit`}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Tahsin & Tahfidz status */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              📖 Tahsin
            </h2>
            {student.current_jilid ? (
              <div>
                <p className="text-lg font-bold">
                  {student.current_method?.name ?? '?'} · {student.current_jilid.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  Halaman {student.current_jilid_page ?? '—'} · {tahsinCount ?? 0} setoran tercatat
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Belum ada data tahsin</p>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              ✨ Tahfidz
            </h2>
            {juzProgress && juzProgress.length > 0 ? (
              <div>
                <p className="text-lg font-bold">
                  Juz {juzProgress[juzProgress.length - 1].juz_number} aktif
                </p>
                <p className="text-xs text-muted-foreground">
                  {juzProgress.length} juz sudah disetor · {tahfidzCount ?? 0} setoran tercatat
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Belum ada hafalan</p>
            )}
          </div>
        </div>

        {/* Wali */}
        {(student.wali_name || student.wali_phone || student.wali_email) && (
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3">Wali Murid</h2>
            <div className="space-y-1.5 text-sm">
              {student.wali_name && <p className="font-medium">{student.wali_name}</p>}
              {student.wali_phone && (
                <p className="text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  <a href={`https://wa.me/${student.wali_phone.replace(/^0/, '62').replace(/\D/g, '')}`} target="_blank" className="hover:underline">
                    {student.wali_phone}
                  </a>
                </p>
              )}
              {student.wali_email && (
                <p className="text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <a href={`mailto:${student.wali_email}`} className="hover:underline">{student.wali_email}</a>
                </p>
              )}
            </div>
          </div>
        )}

        {canKoreksi && (
          <section className="mt-6">
            <h2 className="text-base font-semibold">Riwayat Setoran</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              20 setoran terakhir. Guru mencatat, pengurus membetulkan bila ada salah input.
            </p>
            <SetoranKoreksi items={setoranItems} />
          </section>
        )}
      </div>
    </div>
  )
}

/**
 * Riwayat setoran tiga jenis, digabung dan diurutkan menurut tanggal.
 *
 * Digabung karena yang dicari pengurus adalah "setoran mana yang salah",
 * bukan "setoran tahsin mana" — memisahkannya per jenis justru memaksa
 * mereka mencari di tiga daftar.
 */
async function ambilSetoran(
  supabase: ReturnType<typeof createServerClient>,
  studentId: string,
): Promise<SetoranItem[]> {
  const [tahsin, tahfidz, tasmi] = await Promise.all([
    supabase
      .from('tahsin_logs')
      .select('id, setoran_date, halaman, baris_dari, baris_ke, status, catatan, nilai_tahsin, nilai_sikap, jilid:jilid_levels!tahsin_logs_jilid_id_fkey(label)')
      .eq('student_id', studentId).order('setoran_date', { ascending: false }).limit(20),
    supabase
      .from('tahfidz_logs')
      .select('id, setoran_date, kind, ayat_dari, ayat_ke, catatan, nilai_tahfidz, nilai_sikap, surat:surat_master!tahfidz_logs_surat_id_fkey(name_latin)')
      .eq('student_id', studentId).order('setoran_date', { ascending: false }).limit(20),
    supabase
      .from('tasmi_logs')
      .select('id, setoran_date, scope_juz, juz_from, juz_to, status, catatan, nilai_tahfidz, nilai_sikap')
      .eq('student_id', studentId).order('setoran_date', { ascending: false }).limit(20),
  ])

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

  const items: SetoranItem[] = [
    ...((tahsin.data ?? []) as unknown as Array<Record<string, unknown>>).map(r => ({
      id: String(r.id), table: 'tahsin_logs' as const,
      tanggal: String(r.setoran_date),
      judul: [
        (r.jilid as { label: string } | null)?.label,
        r.halaman ? `hal ${r.halaman}` : null,
      ].filter(Boolean).join(' · ') || 'Tahsin',
      nilai: num(r.nilai_tahsin), sikap: num(r.nilai_sikap),
      status: (r.status as string) ?? null, catatan: (r.catatan as string) ?? null,
      halaman: num(r.halaman), barisDari: num(r.baris_dari), barisKe: num(r.baris_ke),
    })),
    ...((tahfidz.data ?? []) as unknown as Array<Record<string, unknown>>).map(r => ({
      id: String(r.id), table: 'tahfidz_logs' as const,
      tanggal: String(r.setoran_date),
      judul: [
        (r.surat as { name_latin: string } | null)?.name_latin,
        r.ayat_dari ? `ayat ${r.ayat_dari}–${r.ayat_ke}` : null,
      ].filter(Boolean).join(' ') || 'Tahfidz',
      nilai: num(r.nilai_tahfidz), sikap: num(r.nilai_sikap),
      status: null, catatan: (r.catatan as string) ?? null,
      ayatDari: num(r.ayat_dari), ayatKe: num(r.ayat_ke),
    })),
    ...((tasmi.data ?? []) as unknown as Array<Record<string, unknown>>).map(r => ({
      id: String(r.id), table: 'tasmi_logs' as const,
      tanggal: String(r.setoran_date),
      judul: `Tasmi' juz ${r.juz_from}–${r.juz_to}`,
      nilai: num(r.nilai_tahfidz), sikap: num(r.nilai_sikap),
      status: (r.status as string) ?? null, catatan: (r.catatan as string) ?? null,
    })),
  ]

  return items.sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 20)
}
