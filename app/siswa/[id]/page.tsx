import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageSetoran, canManageStudents, canViewStudents, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { SetoranKoreksi, type SetoranItem } from '@/components/siswa/SetoranKoreksi'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { Pencil, Phone, Mail, GraduationCap, BookOpen } from 'lucide-react'
import { totalJuzHafalan, ringkasHafalan } from '@/lib/rq/hafalan'
import { tanggalWIB } from '@/lib/rq/ujian'
import { tingkatOf } from '@/lib/rq/sesi'
import { getRiwayatUjianSiswa } from '@/lib/data/riwayat-ujian-siswa'
import type { Jenjang, UjianTahfidz } from '@/types'
import { cn } from '@/lib/utils'
import { getInfoSurat } from '@/lib/data/nama-surat'
import { teksRentang } from '@/lib/rq/rentang-surat'

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
  const jenjang = student.jenjang as Jenjang
  const program = student.program as string | null
  if (!canViewStudents(session.role, jenjang, program)) redirect('/siswa')

  const canEdit = canManageStudents(session.role, jenjang, program)

  // Hitung agregat sederhana
  const { count: tahsinCount } = await supabase
    .from('tahsin_logs').select('*', { count: 'exact', head: true }).eq('student_id', id)
  const { count: tahfidzCount } = await supabase
    .from('tahfidz_logs').select('*', { count: 'exact', head: true }).eq('student_id', id)
  const { data: juzProgress } = await supabase
    .from('juz_progress').select('juz_number, ayat_hafal').eq('student_id', id).order('juz_number')

  // Riwayat ujian tahfidz anak ini. Catatan lama yang belum dipetakan tidak
  // punya student_id, jadi tidak muncul di sini sampai dipasangkan lewat
  // /ujian/pemetaan.
  const { data: ujianRows } = await supabase
    .from('ujian_tahfidz')
    .select('id, tipe, juz, jadwal, penguji, predikat, status, created_at')
    .eq('student_id', id)
    .order('created_at', { ascending: false })
  const ujian = (ujianRows ?? []) as unknown as UjianTahfidz[]

  // Yang dihitung catatan terjauh, bukan jumlah catatannya: tiga kali ujian
  // juz 30 tetap satu juz.
  const juzHafalan = totalJuzHafalan(ujian.map(u => String(u.juz)))

  // Riwayat setoran hanya diambil untuk yang berwenang mengoreksinya;
  // bagi yang lain, tiga query ini sia-sia.
  const canKoreksi = canManageSetoran(session.role, jenjang, program)
  const setoranItems: SetoranItem[] = canKoreksi ? await ambilSetoran(supabase, id) : []

  // ── Perjalanan Qur'an, setoran 12 pekan, riwayat ujian lengkap ──
  // Semuanya hanya membaca data yang sudah ada; tidak ada yang ditulis.
  type JilidRow = { id: string; label: string; order_num: number; total_pages: number | null; is_terminal: boolean }
  const awal12 = new Date(Date.now() - 12 * 7 * 86_400_000)
  const [jilidRes, tahsinTgl, tahfidzTgl, riwayatUjian, rekanRes] = await Promise.all([
    student.current_method
      ? supabase.from('jilid_levels').select('id, label, order_num, total_pages, is_terminal')
          .eq('method_id', student.current_method.id).order('order_num')
      : Promise.resolve({ data: [] as JilidRow[] }),
    supabase.from('tahsin_logs').select('setoran_date').eq('student_id', id)
      .gte('setoran_date', tanggalWIB(awal12)),
    supabase.from('tahfidz_logs').select('setoran_date').eq('student_id', id)
      .gte('setoran_date', tanggalWIB(awal12)),
    getRiwayatUjianSiswa(id),
    // Teman seangkatan dengan metode yang sama — untuk pembanding posisi jilid.
    student.current_method
      ? supabase.from('students').select('id, kelas, current_jilid_id')
          .eq('jenjang', student.jenjang).eq('current_method_id', student.current_method.id).eq('is_active', true)
      : Promise.resolve({ data: [] as { id: string; kelas: string | null; current_jilid_id: string | null }[] }),
  ])
  const jilidList = (jilidRes.data ?? []) as JilidRow[]
  const urutanJilid = new Map(jilidList.map((j, i) => [j.id, i]))
  const posisi = student.current_jilid ? urutanJilid.get(student.current_jilid.id) ?? -1 : -1
  const jilidNow = posisi >= 0 ? jilidList[posisi] : null
  const pctJilid = jilidNow?.total_pages && student.current_jilid_page
    ? Math.min(100, Math.round((student.current_jilid_page / jilidNow.total_pages) * 100))
    : null

  const tingkat = tingkatOf(student.kelas)
  const rekan = ((rekanRes.data ?? []) as { id: string; kelas: string | null; current_jilid_id: string | null }[])
    .filter(r => r.id !== id && tingkat !== null && tingkatOf(r.kelas) === tingkat && r.current_jilid_id && urutanJilid.has(r.current_jilid_id))
  const rataRekan = rekan.length >= 3
    ? rekan.reduce((t, r) => t + (urutanJilid.get(r.current_jilid_id!) ?? 0), 0) / rekan.length
    : null
  const selisih = rataRekan !== null && posisi >= 0 ? posisi - rataRekan : null

  // Setoran per pekan (Senin–Ahad, tanggal WIB) untuk 12 pekan terakhir.
  const senin = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`)
    const hari = (d.getUTCDay() + 6) % 7
    d.setUTCDate(d.getUTCDate() - hari)
    return d.toISOString().slice(0, 10)
  }
  const pekanIni = senin(tanggalWIB(new Date()))
  const daftarPekan = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${pekanIni}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - (11 - i) * 7)
    return d.toISOString().slice(0, 10)
  })
  const hitungPekan = new Map(daftarPekan.map(w => [w, 0]))
  for (const r of [...(tahsinTgl.data ?? []), ...(tahfidzTgl.data ?? [])] as { setoran_date: string }[]) {
    const w = senin(String(r.setoran_date).slice(0, 10))
    if (hitungPekan.has(w)) hitungPekan.set(w, (hitungPekan.get(w) ?? 0) + 1)
  }
  const batang = daftarPekan.map(w => ({ pekan: w, n: hitungPekan.get(w) ?? 0 }))
  const maxBatang = Math.max(1, ...batang.map(b => b.n))
  const totalBatang = batang.reduce((t, b) => t + b.n, 0)
  const pekanKosong = batang.filter(b => b.n === 0).length
  const labelPekan = (w: string) => new Date(`${w}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', timeZone: 'UTC' })

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
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

        {/* Hero */}
        <div className="rounded-2xl border bg-card p-5 md:p-6">
          <div className="flex items-start gap-5 flex-wrap">
            <div aria-hidden className="w-20 h-20 rounded-full bg-primary-wash text-primary flex items-center justify-center font-heading text-3xl shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Siswa · {JENJANG_LABELS[student.jenjang as Jenjang]}</p>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl leading-tight">{student.full_name}</h1>
                <span className="text-sm">{genderIcon}</span>
                {!student.is_active && <span className="rounded-md bg-warning-wash px-2 py-0.5 text-xs font-semibold text-warning">Nonaktif</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {student.nis ? `NIS ${student.nis} · ` : ''}
                Bergabung {new Date(student.enrolled_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' })}
              </p>
              <div className="flex flex-wrap gap-2 mt-3 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  {JENJANG_LABELS[student.jenjang as Jenjang]}{student.kelas ? ` · Kelas ${student.kelas}` : ''}
                </span>
                {student.halaqoh && (
                  <Link
                    href={`/halaqoh/${student.halaqoh.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium hover:bg-primary-wash hover:text-primary"
                  >
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    {student.halaqoh.name}
                  </Link>
                )}
              </div>
            </div>
            {canEdit && (
              <Button asChild variant="outline">
                <Link href={`/siswa/${id}/edit`}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {/* ── Perjalanan Qur'an ── */}
            <section className="rounded-2xl border bg-card p-5 md:p-6">
              <h2 className="font-heading text-2xl font-medium leading-tight">Perjalanan Qur&apos;an</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {student.current_method ? `Metode ${student.current_method.name} · posisi hari ini` : 'Tidak mengikuti program tahsin'}
              </p>

              {jilidList.length > 0 && (
                <ol className="mt-5 flex items-start gap-1 overflow-x-auto pb-1">
                  {jilidList.map((j, i) => {
                    const lewat = posisi >= 0 && i < posisi
                    const kini = i === posisi
                    return (
                      <li key={j.id} className="flex min-w-[64px] flex-1 flex-col items-center gap-1.5">
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('absolute inset-y-0 left-0 rounded-full', lewat ? 'bg-primary' : kini ? 'bg-accent-warm' : '')}
                            style={{ width: lewat ? '100%' : kini ? `${pctJilid ?? 50}%` : '0%' }}
                          />
                        </div>
                        <span className={cn(
                          'text-center text-[11px] leading-tight',
                          kini ? 'font-semibold text-accent-warm' : lewat ? 'text-foreground' : 'text-muted-foreground',
                        )}>
                          {j.label}
                          {kini && student.current_jilid_page ? <><br />hal. {student.current_jilid_page}</> : null}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Angka label="Posisi tahsin" nilai={student.current_jilid?.label ?? '—'}
                  ket={pctJilid !== null ? `${pctJilid}% jilid ini` : student.current_jilid_page ? `hal. ${student.current_jilid_page}` : ''} />
                <Angka label="Hafalan (lulus ujian)" nilai={juzHafalan > 0 ? `${juzHafalan} juz` : '—'}
                  ket={juzProgress && juzProgress.length > 0 ? `${juzProgress.length} juz pernah disetor` : 'belum ada setoran tahfidz'} />
                <Angka label="Setoran tercatat" nilai={String((tahsinCount ?? 0) + (tahfidzCount ?? 0))}
                  ket={`${tahsinCount ?? 0} tahsin · ${tahfidzCount ?? 0} tahfidz`} />
              </div>

              {selisih !== null && rataRekan !== null && (
                <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm leading-relaxed">
                  Rata-rata {rekan.length} siswa kelas {tingkat} ({student.current_method?.name}) ada di{' '}
                  <span className="font-semibold">{jilidList[Math.round(rataRekan)]?.label ?? '—'}</span>.{' '}
                  {Math.abs(selisih) < 0.5
                    ? `${student.full_name.split(' ')[0]} sejajar dengan angkatannya.`
                    : selisih > 0
                      ? `${student.full_name.split(' ')[0]} sekitar ${Math.round(selisih * 10) / 10} jilid di depan angkatannya.`
                      : `${student.full_name.split(' ')[0]} sekitar ${Math.round(-selisih * 10) / 10} jilid di belakang angkatannya.`}
                </p>
              )}
            </section>

            {/* ── Setoran 12 pekan ── */}
            <section className="rounded-2xl border bg-card p-5 md:p-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-heading text-2xl font-medium leading-tight">Setoran 12 pekan</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Jumlah setoran tahsin &amp; tahfidz per pekan</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalBatang} setoran · rata-rata {(totalBatang / 12).toLocaleString('id-ID', { maximumFractionDigits: 1 })}/pekan
                </p>
              </div>
              <div className="mt-5 flex h-36 items-end gap-1.5" role="img" aria-label={`Setoran per pekan, total ${totalBatang}`}>
                {batang.map((b, i) => (
                  <div key={b.pekan} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Pekan ${labelPekan(b.pekan)}: ${b.n} setoran`}>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{b.n || ''}</span>
                    <div
                      className={cn('w-full rounded-t-md', b.n === 0 ? 'bg-muted' : i === batang.length - 1 ? 'bg-accent-warm' : 'bg-primary')}
                      style={{ height: b.n === 0 ? 3 : `${Math.max(6, (b.n / maxBatang) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5 text-[10px] text-muted-foreground">
                {batang.map((b, i) => (
                  <span key={b.pekan} className="flex-1 text-center">{i % 3 === 0 || i === batang.length - 1 ? labelPekan(b.pekan) : ''}</span>
                ))}
              </div>
              {pekanKosong > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {pekanKosong} pekan tanpa setoran dalam 12 pekan terakhir.
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            {/* ── Riwayat ujian (tahsin & tahfidz) ── */}
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-heading text-xl font-medium leading-tight">Riwayat ujian</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{juzHafalan > 0 ? ringkasHafalan(juzHafalan) : 'Tahsin & tahfidz'}</p>
              {riwayatUjian.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Belum ada ujian tercatat.</p>
              ) : (
                <ol className="mt-4 space-y-3 border-l pl-4">
                  {riwayatUjian.slice(0, 8).map(u => (
                    <li key={`${u.jenis}-${u.id}`} className="relative">
                      <span className={cn(
                        'absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                        u.status === 'selesai' ? 'bg-primary' : 'bg-warning',
                      )} />
                      <p className="text-[11px] text-muted-foreground">
                        {u.jadwal ? new Date(u.jadwal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : 'Tanpa tanggal'}
                      </p>
                      <p className="text-sm font-medium leading-snug">{u.judul}</p>
                      <p className={cn('text-xs', u.hasil ? u.hasilClass : 'text-muted-foreground')}>
                        {u.hasil ?? u.statusLabel}{u.penguji ? ` · ${u.penguji}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Wali */}
        {(student.wali_name || student.wali_phone || student.wali_email) && (
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-heading text-xl font-medium mb-3">Wali murid</h2>
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

          </aside>
        </div>

        {canKoreksi && (
          <section className="mt-6">
            <h2 className="font-heading text-2xl font-medium">Riwayat setoran</h2>

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
  const [tahsin, tahfidz, tasmi, infoSurat] = await Promise.all([
    supabase
      .from('tahsin_logs')
      .select('id, setoran_date, halaman, baris_dari, baris_ke, status, catatan, nilai_tahsin, nilai_sikap, jilid:jilid_levels!tahsin_logs_jilid_id_fkey(label)')
      .eq('student_id', studentId).order('setoran_date', { ascending: false }).limit(20),
    supabase
      .from('tahfidz_logs')
      // '*' supaya surat_ke_id (0076) ikut bila sudah ada, tanpa menggagalkan kueri bila belum.
      .select('*, surat:surat_master!tahfidz_logs_surat_id_fkey(name_latin)')
      .eq('student_id', studentId).order('setoran_date', { ascending: false }).limit(20),
    supabase
      .from('tasmi_logs')
      .select('id, setoran_date, scope_juz, juz_from, juz_to, status, catatan, nilai_tahfidz, nilai_sikap')
      .eq('student_id', studentId).order('setoran_date', { ascending: false }).limit(20),
    getInfoSurat(),
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
      judul: judulTahfidz(r, infoSurat),
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

/** "An-Naba ayat 1–40" / "An-Naba 30 – An-Nazi'at 20" (muroja'ah lintas surat, 0076). */
function judulTahfidz(r: Record<string, unknown>, infoSurat: Map<number, { name_latin: string }>): string {
  const nama = (r.surat as { name_latin: string } | null)?.name_latin
  if (!nama) return 'Tahfidz'
  const dari = r.ayat_dari == null ? null : Number(r.ayat_dari)
  const ke = r.ayat_ke == null ? null : Number(r.ayat_ke)
  const akhir = r.surat_ke_id ? infoSurat.get(Number(r.surat_ke_id))?.name_latin ?? `Surat ${r.surat_ke_id}` : null
  if (!akhir && dari !== null) return `${nama} ayat ${dari}–${ke ?? ''}`
  return teksRentang(nama, dari, akhir, ke)
}

function Angka({ label, nilai, ket }: { label: string; nilai: string; ket: string }) {
  return (
    <div className="rounded-xl border px-3.5 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-heading text-2xl leading-tight">{nilai}</p>
      {ket && <p className="text-[11px] text-muted-foreground">{ket}</p>}
    </div>
  )
}
