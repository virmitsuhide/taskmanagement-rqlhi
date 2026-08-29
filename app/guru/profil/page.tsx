import { redirect } from 'next/navigation'
import { CircleAlert, Lock } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { UNIT_PENUGASAN_LABELS } from '@/lib/auth/permissions'
import { GuruProfileForm } from '@/components/profil/GuruProfileForm'
import type { GuruProfile, Jenjang } from '@/types'

const KOLOM_PROFIL =
  'id, full_name, nip, unit, employment_type, joined_at,' +
  ' sapaan, nickname, birth_place, birth_date, education_level, education_history,' +
  ' quran_competencies, other_competencies, ijazah_sanad, trainings, amanah_history, awards'

const KOLOM_DASAR = 'id, full_name, nip, unit, employment_type, joined_at'

/**
 * Profil Saya — guru melengkapi data dirinya sendiri.
 *
 * Ada supaya SDM tidak perlu mewawancarai 39 orang satu per satu: yang paling
 * tahu riwayat pendidikan, sanad, dan diklat seorang guru adalah guru itu
 * sendiri. Yang TIDAK bisa ia ubah dari sini — unit, TMT, NIP, jenis
 * kepegawaian — ditampilkan sebagai keterangan terkunci, bukan disembunyikan:
 * kalau ada yang keliru, ia perlu melihatnya untuk bisa melaporkannya.
 */
export default async function ProfilGuruSendiriPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const supabase = createServerClient()

  let profile: GuruProfile | null = null
  let perluMigrasi = false
  const penuh = await supabase.from('teachers').select(KOLOM_PROFIL).eq('id', session.teacherId).maybeSingle()
  if (penuh.data) {
    profile = penuh.data as unknown as GuruProfile
  } else {
    perluMigrasi = true
    const dasar = await supabase.from('teachers').select(KOLOM_DASAR).eq('id', session.teacherId).maybeSingle()
    profile = dasar.data as unknown as GuruProfile | null
  }

  if (!profile) redirect('/guru')

  const unit = profile.unit as Jenjang | null

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <h1
          className="text-2xl font-bold leading-tight"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          Profil Saya
        </h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Lengkapi data diri Anda. Isian ini dipakai SDM untuk arsip kepegawaian —
          semakin lengkap, semakin sedikit yang perlu ditanyakan ulang.
        </p>

        {perluMigrasi && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm"
            style={{ borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)', background: 'var(--warning-wash)', color: 'var(--warning)' }}>
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Fitur ini belum aktif sepenuhnya. Sampaikan kepada SDM bila isian di bawah tidak bisa disimpan.</p>
          </div>
        )}

        {/* Data kepegawaian — terlihat, tapi tidak bisa disunting dari sini. */}
        <section className="mb-6 rounded-xl border bg-muted/30 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Dikelola SDM — sampaikan kepada SDM bila ada yang keliru
          </p>
          <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Baris label="Nama lengkap" value={profile.full_name} />
            <Baris label="NIP / ID Guru" value={profile.nip ?? '—'} />
            <Baris label="Unit penugasan" value={unit ? UNIT_PENUGASAN_LABELS[unit] : '—'} />
            <Baris
              label="TMT / bergabung"
              value={profile.joined_at ? tanggal(profile.joined_at) : 'belum diisi'}
            />
          </div>
        </section>

        <GuruProfileForm profile={profile} scope="guru" />
      </div>
    </div>
  )
}

function Baris({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex gap-2">
      <span className="w-[130px] shrink-0 text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">:</span>
      <span className="min-w-0 flex-1 font-medium">{value}</span>
    </p>
  )
}

function tanggal(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  return `${d} ${BULAN[m - 1]} ${y}`
}
