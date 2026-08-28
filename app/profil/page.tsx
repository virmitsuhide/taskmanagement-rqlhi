import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { ProfileForm } from './ProfileForm'
import { PengurusProfileForm } from './PengurusProfileForm'
import { ROLE_LABELS, canHavePengurusProfile, sapaanName } from '@/lib/auth/permissions'
import type { PengurusProfile } from '@/types'

// Kolom profil dari migrasi 0014.
const PROFILE_COLUMNS =
  'id, username, role, display_name, email, can_change_password, created_at,' +
  ' sapaan, nickname, full_name, nip, birth_place, birth_date, current_amanah,' +
  ' education_level, photo_url, competencies, trainings, amanah_history, awards'

// + riwayat pendidikan dari migrasi 0039.
const PROFILE_COLUMNS_FULL = `${PROFILE_COLUMNS}, education_history`

const BASIC_COLUMNS = 'id, username, role, display_name, email, can_change_password, created_at'

export default async function ProfilPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const full = canHavePengurusProfile(session.role)
  const supabase = createServerClient()

  // Kolom profil baru bisa belum ada kalau migrasinya belum dijalankan. Turun
  // bertingkat — 0039, lalu 0014, lalu kolom dasar — supaya database yang
  // tertinggal satu migrasi tidak membuat seluruh form profil hilang.
  let data: Record<string, unknown> | null = null
  if (full) {
    const res = await supabase.from('users').select(PROFILE_COLUMNS_FULL).eq('id', session.userId).maybeSingle()
    data = res.data as Record<string, unknown> | null
  }
  if (full && !data) {
    const res = await supabase.from('users').select(PROFILE_COLUMNS).eq('id', session.userId).maybeSingle()
    data = res.data as Record<string, unknown> | null
  }
  if (!data) {
    const res = await supabase.from('users').select(BASIC_COLUMNS).eq('id', session.userId).maybeSingle()
    data = res.data as Record<string, unknown> | null
  }
  if (!data) redirect('/login')

  const profile = data as unknown as PengurusProfile
  const hasProfileColumns = 'sapaan' in data

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Profil" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="mb-6 flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
          <div className="h-14 w-14 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border">
            {profile.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-muted-foreground">
                {profile.display_name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {sapaanName(profile.sapaan, profile.nickname, profile.display_name)}
            </p>
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
            <span className="inline-block mt-1.5 text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">
              {ROLE_LABELS[profile.role]}
            </span>
          </div>
        </div>

        {full && hasProfileColumns && (
          <div className="mb-8">
            <PengurusProfileForm profile={profile} />
          </div>
        )}

        {full && !hasProfileColumns && (
          <div className="mb-8 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
            Kolom profil belum tersedia di database. Jalankan{' '}
            <code className="text-xs">drizzle/0014_profil_pengurus_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase untuk mengaktifkan form profil lengkap.
          </div>
        )}

        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold mb-4">Akun</h2>
          <ProfileForm user={profile} />
        </div>
      </div>
    </div>
  )
}
