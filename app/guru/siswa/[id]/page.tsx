import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canTeacherAccessStudent } from '@/lib/data/teacher'
import { createServerClient } from '@/lib/supabase/server'
import { TeacherHeader } from '@/components/layout/TeacherHeader'
import { Button } from '@/components/ui/button'
import { BookOpen, CheckCircle2, Sparkles } from 'lucide-react'
import { AYAT_PER_JUZ } from '@/types'
import type { Jenjang } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ setoran?: string }>
}

const JENJANG_LABELS: Record<string, string> = { paud: 'PAUD', sd: 'SD', smp: 'SMP', sma: 'SMA' }

function avg(...vals: (number | null)[]): string {
  const nums = vals.filter((v): v is number => typeof v === 'number')
  if (nums.length === 0) return '—'
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
}

export default async function GuruStudentDetailPage({ params, searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { id } = await params
  const { setoran } = await searchParams

  const allowed = await canTeacherAccessStudent(session.teacherId, id)
  if (!allowed) redirect('/guru/siswa')

  const supabase = createServerClient()
  const { data: studentRaw } = await supabase
    .from('students')
    .select(`
      id, full_name, nis, gender, kelas, jenjang, current_jilid_page,
      halaqoh:halaqoh(id, name),
      current_method:tahsin_methods!students_current_method_id_fkey(id, name),
      current_jilid:jilid_levels!students_current_jilid_id_fkey(id, label)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!studentRaw) notFound()

  const student = studentRaw as unknown as {
    id: string; full_name: string; nis: string | null; gender: 'L' | 'P' | null
    kelas: string | null; jenjang: string; current_jilid_page: number | null
    halaqoh: { id: string; name: string } | null
    current_method: { id: string; name: string } | null
    current_jilid: { id: string; label: string } | null
  }

  // Riwayat 15 setoran tahsin terakhir
  const { data: logs } = await supabase
    .from('tahsin_logs')
    .select('id, setoran_date, halaman, baris_dari, baris_ke, nilai_makhraj, nilai_tajwid, nilai_kelancaran, status, catatan, jilid:jilid_levels!tahsin_logs_jilid_id_fkey(label)')
    .eq('student_id', id)
    .order('setoran_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(15)

  // Riwayat kenaikan jilid
  const { data: promotions } = await supabase
    .from('jilid_promotions')
    .select('id, promotion_date, from_jilid:jilid_levels!jilid_promotions_from_jilid_id_fkey(label), to_jilid:jilid_levels!jilid_promotions_to_jilid_id_fkey(label)')
    .eq('student_id', id)
    .order('promotion_date', { ascending: false })

  // ── Tahfidz ──
  const [tahfidzRes, juzProgressRes, juzPromRes] = await Promise.all([
    supabase
      .from('tahfidz_logs')
      .select('id, setoran_date, kind, ayat_dari, ayat_ke, nilai_makhraj, nilai_tajwid, nilai_kelancaran, catatan, surat:surat_master!tahfidz_logs_surat_id_fkey(name_latin, juz_start)')
      .eq('student_id', id)
      .order('setoran_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('juz_progress')
      .select('juz_number, ayat_hafal, mutqin')
      .eq('student_id', id),
    supabase
      .from('juz_promotions')
      .select('id, juz_number, promotion_date')
      .eq('student_id', id)
      .order('juz_number', { ascending: true }),
  ])

  const tahfidzLogs = (tahfidzRes.data ?? []) as unknown as Array<{
    id: string; setoran_date: string; kind: string; ayat_dari: number; ayat_ke: number
    nilai_makhraj: number | null; nilai_tajwid: number | null; nilai_kelancaran: number | null
    catatan: string | null; surat: { name_latin: string; juz_start: number } | null
  }>
  const juzProgress = (juzProgressRes.data ?? []) as Array<{ juz_number: number; ayat_hafal: number; mutqin: boolean }>
  const juzPromotions = (juzPromRes.data ?? []) as Array<{ id: string; juz_number: number; promotion_date: string }>

  const juzMap = new Map<number, { ayat_hafal: number; mutqin: boolean }>()
  for (const j of juzProgress) juzMap.set(j.juz_number, { ayat_hafal: j.ayat_hafal, mutqin: j.mutqin })
  const totalAyatHafal = juzProgress.reduce((sum, j) => sum + j.ayat_hafal, 0)
  const juzAktif = juzProgress.length > 0 ? Math.max(...juzProgress.map(j => j.juz_number)) : null

  const initials = student.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
  const setoranUrl = `/guru/setoran/tahsin/baru?student=${id}`
  const tahfidzUrl = `/guru/setoran/tahfidz/baru?student=${id}`

  return (
    <div className="min-h-screen" style={{ background: '#fafaf7' }}>
      <TeacherHeader fullName={session.fullName} active="siswa" />

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <Link href="/guru/siswa" className="text-xs text-muted-foreground hover:underline">← Daftar Siswa</Link>

        {(setoran === 'ok' || setoran === 'tahfidz_ok') && (
          <div className="rounded-lg border-2 border-green-300 bg-green-50 px-4 py-3 flex items-center gap-2 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            Setoran {setoran === 'tahfidz_ok' ? 'tahfidz' : 'tahsin'} berhasil disimpan. Barakallahu fiik!
          </div>
        )}

        {/* Hero */}
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0"
              style={{ background: '#b8860b', fontFamily: 'var(--font-playfair), serif' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-[180px]">
              <h1
                className="text-2xl font-extrabold tracking-tight"
                style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
              >
                {student.full_name}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {JENJANG_LABELS[student.jenjang as Jenjang]}
                {student.kelas ? ` · Kelas ${student.kelas}` : ''}
                {student.halaqoh?.name ? ` · ${student.halaqoh.name}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg" style={{ background: '#fdf6e3', color: '#b8860b' }}>
                  <BookOpen className="h-4 w-4" />
                  {student.current_method?.name && student.current_jilid?.label
                    ? `${student.current_method.name} ${student.current_jilid.label} · hal. ${student.current_jilid_page ?? '—'}`
                    : 'Belum ada data tahsin'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg" style={{ background: '#dcfce7', color: '#15803d' }}>
                  <Sparkles className="h-4 w-4" />
                  {juzAktif ? `Tahfidz Juz ${juzAktif} · ${totalAyatHafal} ayat` : 'Belum ada hafalan'}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button asChild style={{ background: '#b8860b', borderColor: '#b8860b' }}>
                <Link href={setoranUrl}>+ Setor Tahsin</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={tahfidzUrl}>+ Setor Tahfidz</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/guru/siswa/${id}/rapor`}>📄 Rapor &amp; Share</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Peta 30 Juz */}
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Peta Hafalan (30 Juz)
          </h2>
          <div className="rounded-xl border bg-white p-4">
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 30 }, (_, i) => i + 1).map(juz => {
                const prog = juzMap.get(juz)
                const total = AYAT_PER_JUZ[juz] ?? 1
                const pct = prog ? Math.min(100, Math.round((prog.ayat_hafal / total) * 100)) : 0
                const mutqin = prog?.mutqin
                const style =
                  mutqin ? { background: '#15803d', color: 'white', borderColor: '#15803d' }
                  : pct >= 100 ? { background: '#22c55e', color: 'white', borderColor: '#22c55e' }
                  : pct > 0 ? { background: '#fdf6e3', color: '#b8860b', borderColor: '#b8860b' }
                  : { background: '#f3f1ec', color: '#9ca3af', borderColor: '#e7e3da' }
                return (
                  <div
                    key={juz}
                    className="aspect-square rounded-md border flex items-center justify-center text-[11px] font-medium relative"
                    style={style}
                    title={prog ? `Juz ${juz}: ${prog.ayat_hafal}/${total} ayat (${pct}%)${mutqin ? ' · Mutqin' : ''}` : `Juz ${juz}: belum`}
                  >
                    {juz}
                    {mutqin && <span className="absolute -top-1 -right-1 text-[8px]">✓</span>}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: '#15803d' }} /> Mutqin</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: '#22c55e' }} /> Selesai</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border" style={{ background: '#fdf6e3', borderColor: '#b8860b' }} /> Proses</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: '#f3f1ec' }} /> Belum</span>
            </div>
          </div>
        </section>

        {/* Riwayat setoran */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Riwayat Setoran Tahsin</h2>
          {!logs || logs.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white py-8 text-center text-sm text-muted-foreground">
              Belum ada setoran tercatat.
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href={setoranUrl}>Catat setoran pertama</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-white divide-y">
              {logs.map(log => {
                const jilid = (log.jilid as unknown as { label: string } | null)?.label ?? '—'
                return (
                  <div key={log.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {jilid} · hal. {log.halaman ?? '—'}
                        {log.baris_dari && log.baris_ke ? ` (baris ${log.baris_dari}-${log.baris_ke})` : ''}
                      </p>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
                        style={log.status === 'lulus'
                          ? { background: '#dcfce7', color: '#15803d' }
                          : { background: '#fef9c3', color: '#a16207' }}
                      >
                        {log.status === 'lulus' ? 'Lulus' : 'Ulang'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.setoran_date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}⭐ {avg(log.nilai_makhraj, log.nilai_tajwid, log.nilai_kelancaran)}
                      {' '}(M {log.nilai_makhraj ?? '–'}/T {log.nilai_tajwid ?? '–'}/L {log.nilai_kelancaran ?? '–'})
                    </p>
                    {log.catatan && (
                      <p className="text-xs italic text-muted-foreground mt-1">“{log.catatan}”</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Riwayat kenaikan jilid */}
        {promotions && promotions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3">🎉 Kenaikan Jilid</h2>
            <div className="rounded-xl border bg-white divide-y">
              {promotions.map(p => {
                const from = (p.from_jilid as unknown as { label: string } | null)?.label ?? '?'
                const to = (p.to_jilid as unknown as { label: string } | null)?.label ?? '?'
                return (
                  <div key={p.id} className="p-3 text-sm flex items-center justify-between">
                    <span className="font-medium" style={{ color: '#15803d' }}>{from} → {to}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.promotion_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Riwayat setoran tahfidz */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Riwayat Setoran Tahfidz</h2>
          {tahfidzLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white py-8 text-center text-sm text-muted-foreground">
              Belum ada setoran tahfidz.
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href={tahfidzUrl}>Catat setoran tahfidz</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-white divide-y">
              {tahfidzLogs.map(log => {
                const suratName = log.surat?.name_latin ?? '—'
                return (
                  <div key={log.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {suratName} ayat {log.ayat_dari}–{log.ayat_ke}
                      </p>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
                        style={log.kind === 'hafalan_baru'
                          ? { background: '#fdf6e3', color: '#b8860b' }
                          : { background: '#dbeafe', color: '#1d4ed8' }}
                      >
                        {log.kind === 'hafalan_baru' ? '✨ Hafalan Baru' : '🔁 Muroja’ah'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.setoran_date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      {log.surat ? ` · Juz ${log.surat.juz_start}` : ''}
                      {' · '}⭐ {avg(log.nilai_makhraj, log.nilai_tajwid, log.nilai_kelancaran)}
                    </p>
                    {log.catatan && (
                      <p className="text-xs italic text-muted-foreground mt-1">“{log.catatan}”</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Riwayat kenaikan juz */}
        {juzPromotions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3">🏆 Juz Selesai (Mutqin)</h2>
            <div className="rounded-xl border bg-white p-4 flex flex-wrap gap-2">
              {juzPromotions.map(p => (
                <span
                  key={p.id}
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: '#dcfce7', color: '#15803d' }}
                  title={new Date(p.promotion_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                >
                  Juz {p.juz_number} ✓
                </span>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
