import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageHalaqoh, canViewHalaqoh, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { Pencil, Users, Calendar, MapPin, UserCog } from 'lucide-react'
import { sesiLabel } from '@/lib/rq/sesi'
import { getHalaqohSessions } from '@/lib/data/terms'
import { SessionEditor } from '@/components/halaqoh/SessionEditor'
import { PindahSiswa, type HalaqohTujuanOpsi } from '@/components/halaqoh/PindahSiswa'
import { programLabel } from '@/lib/rq/programs'
import type { Jenjang, UserRole } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function HalaqohDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const supabase = createServerClient()

  const { data: halaqoh } = await supabase
    .from('halaqoh')
    .select('*, wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(id, full_name, phone, email)')
    .eq('id', id)
    .maybeSingle()

  if (!halaqoh) notFound()
  if (!canViewHalaqoh(session.role, halaqoh.jenjang as Jenjang, halaqoh.program as string | null)) {
    redirect('/halaqoh')
  }

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, nis, kelas, gender, is_active')
    .eq('halaqoh_id', id)
    .order('full_name')

  const canEdit = canManageHalaqoh(session.role, halaqoh.jenjang as Jenjang, halaqoh.program as string | null)
  const sessions = await getHalaqohSessions(id)
  const activeStudents = (students ?? []).filter(s => s.is_active)
  const inactiveStudents = (students ?? []).filter(s => !s.is_active)

  // Halaqoh lain sejenjang yang boleh diisi pengurus ini — calon tujuan
  // pemindahan. Jumlah anggotanya ikut dibawa: memindahkan anak ke kelompok
  // yang sudah 30 orang adalah keputusan berbeda dari ke kelompok berisi 12.
  const tujuan = canEdit ? await muatTujuanPindah(supabase, session.role, halaqoh) : []

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Halaqoh', href: '/halaqoh' }, { label: halaqoh.name }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight">{halaqoh.name}</h1>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted">
                  {JENJANG_LABELS[halaqoh.jenjang as Jenjang]}
                </span>
                {halaqoh.program && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-wash text-primary">
                    {programLabel(halaqoh.jenjang as Jenjang, halaqoh.program)}
                  </span>
                )}
                {!halaqoh.is_active && (
                  <span className="text-xs text-warning">⚠ Nonaktif</span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <UserCog className="h-4 w-4" />
                  Wali: {halaqoh.wali_teacher?.full_name ?? <em>belum ditentukan</em>}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {activeStudents.length} siswa aktif
                </span>
                {halaqoh.sesi && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {sesiLabel(halaqoh.sesi)}
                  </span>
                )}
                {halaqoh.tempat && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {halaqoh.tempat}
                  </span>
                )}
                {halaqoh.schedule_note && (
                  <span className="text-xs">{halaqoh.schedule_note}</span>
                )}
              </div>
            </div>
            {canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/halaqoh/${id}/edit`}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Link>
              </Button>
            )}
          </div>
        </div>

        <SessionEditor halaqohId={id} sessions={sessions} canManage={canEdit} />

        {/* Siswa */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-base font-semibold">Daftar Siswa</h2>
            {canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/siswa/baru?halaqoh_id=${id}`}>+ Tambah Siswa</Link>
              </Button>
            )}
          </div>

          <PindahSiswa
            siswa={activeStudents}
            tujuan={tujuan}
            sesiSekarang={halaqoh.sesi}
            canManage={canEdit}
          />

          {inactiveStudents.length > 0 && (
            <details className="mt-3 text-sm text-muted-foreground">
              <summary className="cursor-pointer">
                {inactiveStudents.length} siswa nonaktif
              </summary>
              <ul className="mt-2 pl-4 list-disc space-y-1">
                {inactiveStudents.map(s => (
                  <li key={s.id}>
                    <Link href={`/siswa/${s.id}`} className="hover:underline">
                      {s.full_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </div>
  )
}

/**
 * Halaqoh lain yang sah dijadikan tujuan pemindahan.
 *
 * Disaring tiga lapis: sejenjang (anak SD tidak bisa masuk kelompok SMP),
 * masih aktif (memindahkan ke kelompok yang sudah ditutup hanya memindahkan
 * masalah), dan dalam wewenang pengurus ini — lapis terakhir itulah yang
 * menjaga koor SD tidak menitipkan anaknya ke kelompok QULS, dan sebaliknya.
 *
 * Penyaringan wewenangnya dikerjakan di sini, bukan sebagai filter kueri:
 * aturannya milik canManageHalaqoh, dan menyalinnya jadi kondisi SQL berarti
 * dua tempat yang harus sepakat selamanya.
 */
async function muatTujuanPindah(
  supabase: ReturnType<typeof createServerClient>,
  role: UserRole,
  halaqoh: { id: string; jenjang: string },
): Promise<HalaqohTujuanOpsi[]> {
  const { data } = await supabase
    .from('halaqoh')
    .select('id, name, jenjang, program, sesi, wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(full_name)')
    .eq('jenjang', halaqoh.jenjang)
    .eq('is_active', true)
    .neq('id', halaqoh.id)
    .order('sesi')
    .order('name')

  type Row = {
    id: string; name: string; jenjang: Jenjang; program: string | null; sesi: number | null
    wali_teacher: { full_name: string } | null
  }
  const boleh = ((data ?? []) as unknown as Row[])
    .filter(h => canManageHalaqoh(role, h.jenjang, h.program))
  if (boleh.length === 0) return []

  const { data: counts } = await supabase
    .from('students')
    .select('halaqoh_id')
    .in('halaqoh_id', boleh.map(h => h.id))
    .eq('is_active', true)
  const jumlah = new Map<string, number>()
  for (const row of counts ?? []) {
    jumlah.set(row.halaqoh_id, (jumlah.get(row.halaqoh_id) ?? 0) + 1)
  }

  return boleh.map(h => ({
    id: h.id,
    // Nama lengkapnya menyimpan awalan sesi yang sudah tampil terpisah, jadi
    // yang ditawarkan adalah nama walinya — itulah yang dipakai saat rapat.
    name: h.name,
    sesi: h.sesi,
    wali: h.wali_teacher?.full_name ?? null,
    jumlah: jumlah.get(h.id) ?? 0,
  }))
}
