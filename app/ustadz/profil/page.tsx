import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, UserRoundSearch, CircleAlert, ChartNoAxesColumn, Printer, MessageSquareText, IdCard,
} from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageTeacherProfiles, UNIT_PROFIL_LABELS } from '@/lib/auth/permissions'
import { getGuruUnit, getGuruProfile, type UnitProfil } from '@/lib/data/guru-profil'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { GuruProfileForm } from '@/components/profil/GuruProfileForm'
import { GuruPicker, GuruPager } from '@/components/ustadz/GuruPicker'
import { Button } from '@/components/ui/button'
import { TEACHER_EMPLOYMENT_LABELS } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; guru?: string }>
}

const UNITS: UnitProfil[] = ['sd', 'sd_juara', 'smp', 'paud', 'sma', 'lain']

/**
 * Profil Guru — kelola data diri & kepegawaian guru Qur'an. Khusus SDM.
 *
 * Alurnya: pilih unit → pilih nama → isi. Guru terpilih dan unitnya hidup di
 * query string, bukan di state komponen, supaya tautan ke satu profil bisa
 * dibagikan apa adanya — dan supaya panah maju-mundur cukup berupa tautan biasa
 * yang bisa dibuka di tab baru.
 */
export default async function ProfilGuruPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageTeacherProfiles(session.role)) redirect('/dashboard')

  const p = await searchParams
  const unit = (UNITS.includes(p.unit as UnitProfil) ? p.unit : 'sd') as UnitProfil

  const daftar = await getGuruUnit(unit)
  const terpilihId = daftar.find(g => g.id === p.guru)?.id ?? null

  const { profile, perluMigrasi } = terpilihId
    ? await getGuruProfile(terpilihId)
    : { profile: null, perluMigrasi: false }

  const belumLengkap = daftar.filter(g => !g.joined_at || !g.profilTerisi).length

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader displayName={session.displayName} role={session.role} title="Profil Guru" showBack ownH1 />

      {/* Kanvas bertint supaya kartu (bg-card) punya batas yang terbaca. */}
      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="mx-auto max-w-3xl p-4 md:p-6">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/ustadz"><ArrowLeft className="mr-1 h-4 w-4" />Daftar Ustadz / Guru</Link>
          </Button>

          <h1 className="text-2xl font-bold leading-tight">Profil Guru</h1>
          <p className="mb-5 mt-0.5 text-sm text-muted-foreground">
            Data diri &amp; kepegawaian guru Qur&apos;an. TMT yang diisi di sini menjadi
            masa kerja yang tercetak di rapor KPI bulanan.
          </p>

          {/* Pemilih — selalu di atas, bahkan setelah profil terbuka */}
          <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm">
            <GuruPicker unit={unit} daftar={daftar} terpilihId={terpilihId} />
            {daftar.length > 0 && belumLengkap > 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                {belumLengkap} dari {daftar.length} guru di unit ini datanya belum lengkap —
                ditandai di dalam dropdown.
              </p>
            )}
          </div>

          {perluMigrasi && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-wash px-4 py-2.5 text-sm text-warning">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Kolom profil guru belum lengkap di database. Jalankan{' '}
                <b>drizzle/0044_profil_guru_dan_catatan_kpi_PASTE_TO_SUPABASE.sql</b> dan{' '}
                <b>drizzle/0052_lingkup_penugasan_guru_PASTE_TO_SUPABASE.sql</b> di
                Supabase — sampai itu, isian di bawah belum bisa disimpan.
              </p>
            </div>
          )}

          {daftar.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card py-12 text-center">
              <p className="text-sm text-muted-foreground">{unit === "lain" ? "Semua guru sudah punya unit penugasan." : "Belum ada guru aktif di unit ini."}</p>
            </div>
          ) : profile ? (
            <>
              {/* Panah geser + identitas ringkas */}
              <div className="mb-4 space-y-3">
                <GuruPager unit={unit} daftar={daftar} terpilihId={profile.id} />

                <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{profile.full_name}</h2>
                      <p className="text-[11px] text-muted-foreground">
                        {UNIT_PROFIL_LABELS[unit]}
                        {profile.employment_type && ` · ${TEACHER_EMPLOYMENT_LABELS[profile.employment_type]}`}
                        {profile.nip ? ` · NIP ${profile.nip}` : ' · NIP belum diisi'}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="h-7 shrink-0">
                      <Link href={`/ustadz/${profile.id}`}>
                        <IdCard className="mr-1 h-3.5 w-3.5" />Akun &amp; Kontrak
                      </Link>
                    </Button>
                  </div>

                  {/* Tiga jendela riwayat guru ini */}
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                    <RiwayatLink id={profile.id} unit={unit} tab="kpi" icon={<ChartNoAxesColumn className="h-3.5 w-3.5" />}>
                      Riwayat KPI
                    </RiwayatLink>
                    <RiwayatLink id={profile.id} unit={unit} tab="rapor" icon={<Printer className="h-3.5 w-3.5" />}>
                      Riwayat Rapor
                    </RiwayatLink>
                    <RiwayatLink id={profile.id} unit={unit} tab="catatan" icon={<MessageSquareText className="h-3.5 w-3.5" />}>
                      Riwayat Catatan
                    </RiwayatLink>
                  </div>
                </div>
              </div>

              <GuruProfileForm key={profile.id} profile={profile} scope="sdm" />
            </>
          ) : (
            <div className="rounded-xl border border-dashed bg-card py-12 text-center">
              <UserRoundSearch className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm font-medium">Pilih satu nama pada dropdown di atas</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Guru juga bisa melengkapi data dirinya sendiri lewat Portal Guru →
                menu <b>Profil Saya</b>. Yang tidak bisa mereka ubah: unit, TMT, NIP,
                dan jenis kepegawaian.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RiwayatLink({
  id, unit, tab, icon, children,
}: {
  id: string
  unit: UnitProfil
  tab: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      href={`/ustadz/profil/riwayat?guru=${id}&unit=${unit}&tab=${tab}`}
      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
    >
      {icon}{children}
    </Link>
  )
}
