import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { ProfileForm } from './ProfileForm'
import { PengurusProfileForm } from './PengurusProfileForm'
import { KepegawaianTerkunci } from './KepegawaianTerkunci'
import { GuruProfileForm } from '@/components/profil/GuruProfileForm'
import { getProfilAmanah } from '@/lib/data/pengurus'
import { AMANAH_LABELS, ROLE_LABELS, canHavePengurusProfile, sapaanName, canAccessKpiPublikasi } from '@/lib/auth/permissions'
import { parseFocus, photoStyle } from '@/lib/profil/foto'
import { parseTtdFocus } from '@/lib/kpi/tanda-tangan'
import { ttdSrc } from '@/lib/kpi/ttd-berkas'
import { TandaTanganCard } from '@/components/kpi/TandaTanganCard'
import { simpanTtdPengurusAction } from '@/app/actions/tanda-tangan'
import type { PengurusProfile } from '@/types'

// Kolom profil dari migrasi 0014.
//
// `competencies` sudah tidak ada di sini: migrasi 0042 memindahkan isinya ke
// quran_competencies lalu melepas kolomnya, jadi menyebutnya akan menggagalkan
// tingkat ini justru pada database yang paling mutakhir.
const PROFILE_COLUMNS =
  'id, username, role, display_name, email, can_change_password, created_at,' +
  ' sapaan, nickname, full_name, nip, birth_place, birth_date, current_amanah,' +
  ' education_level, photo_url, trainings, amanah_history, awards'

// + riwayat pendidikan dari migrasi 0039 & posisi foto dari 0040.
const PROFILE_COLUMNS_FULL = `${PROFILE_COLUMNS}, education_history, photo_focus`

// + kompetensi terpilah & ijazah/sanad dari migrasi 0042.
const PROFILE_COLUMNS_0042 =
  `${PROFILE_COLUMNS_FULL}, quran_competencies, other_competencies, ijazah_sanad`

const BASIC_COLUMNS = 'id, username, role, display_name, email, can_change_password, created_at'

export default async function ProfilPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const full = canHavePengurusProfile(session.role)
  const supabase = createServerClient()

  // Kolom profil baru bisa belum ada kalau migrasinya belum dijalankan. Turun
  // bertingkat — 0042, lalu 0039, lalu 0014, lalu kolom dasar — supaya database
  // yang tertinggal satu migrasi tidak membuat seluruh form profil hilang.
  let data: Record<string, unknown> | null = null
  if (full) {
    const res = await supabase.from('users').select(PROFILE_COLUMNS_0042).eq('id', session.userId).maybeSingle()
    data = res.data as Record<string, unknown> | null
  }
  if (full && !data) {
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

  // Amanah diturunkan dari role, tidak lagi diketik pengurus — lihat AMANAH_LABELS.
  const amanah = AMANAH_LABELS[session.role]

  // Siapa yang menduduki amanah ini? Kalau kepala RQ sudah menetapkannya lewat
  // /pengurus, data diri yang tampil adalah milik orang itu; kalau belum, kita
  // jatuh kembali ke kolom profil di akunnya sendiri supaya isian yang telanjur
  // diketik di sana tidak hilang begitu saja.
  const pemegang = full ? await getProfilAmanah(session.userId) : null

  // Tanda tangan hanya ditawarkan kepada peran yang membubuhkannya ke dokumen:
  // koordinator yang menerbitkan rapor KPI, serta SDM & Kepala RQ yang
  // menandatangani putusan banding.
  //
  // Kolomnya sendiri baru ada setelah 0050. Dibaca terpisah dari PROFILE_COLUMNS
  // yang bertingkat itu supaya database yang belum dimigrasi cukup kehilangan
  // kartu tanda tangannya, bukan seluruh halaman profil.
  const perluTtd =
    canAccessKpiPublikasi(session.role) || session.role === 'sdm' || session.role === 'kepala_rq'

  const { data: ttdRow } = perluTtd
    ? await supabase.from('users').select('signature_path, signature_focus').eq('id', session.userId).maybeSingle()
    : { data: null }
  const ttdSrcSaya = await ttdSrc((ttdRow as { signature_path?: string | null } | null)?.signature_path)

  const namaKartu = pemegang
    ? sapaanName(pemegang.profile.sapaan, pemegang.profile.nickname, pemegang.profile.full_name)
    : sapaanName(profile.sapaan, profile.nickname, profile.display_name)

  const fotoUrl = pemegang?.profile.photo_url ?? profile.photo_url
  const fotoFocus = pemegang ? pemegang.profile.photo_focus : profile.photo_focus

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Profil" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="mb-6 flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
          <div className="h-14 w-14 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt="" className="h-full w-full" style={photoStyle(parseFocus(fotoFocus))} />
            ) : (
              <span className="text-lg font-bold text-muted-foreground">
                {profile.display_name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{namaKartu}</p>
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
            <span className="inline-block mt-1.5 text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">
              {ROLE_LABELS[profile.role]}
            </span>
          </div>
        </div>

        {full && pemegang && (
          <div className="mb-8">
            {pemegang.perluMigrasi && (
              <div className="mb-4 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
                Sebagian kolom profil belum tersedia di database. Jalankan{' '}
                <code className="text-xs">drizzle/0044_profil_guru_dan_catatan_kpi_PASTE_TO_SUPABASE.sql</code>{' '}
                di Supabase untuk menampilkannya lengkap.
              </div>
            )}
            <KepegawaianTerkunci profile={pemegang.profile} sumber={pemegang.sumber} amanah={amanah} />
            <GuruProfileForm profile={pemegang.profile} scope="pengurus" />
          </div>
        )}

        {full && !pemegang && hasProfileColumns && (
          <div className="mb-8 space-y-4">
            {/*
              Kursinya belum ditetapkan. Formnya tetap dibuka supaya profil tidak
              terkunci total, tapi statusnya dinyatakan terus terang: begitu
              kepala RQ menetapkan nama, halaman ini berganti membaca rekam guru
              orang tersebut dan isian di bawah tidak lagi ditampilkan.
            */}
            <div className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-xs leading-relaxed">
              <p className="font-semibold">Amanah {amanah} belum ditetapkan Kepala RQ.</p>
              <p className="mt-1 text-muted-foreground">
                Selama belum ditetapkan, data di bawah tersimpan di akun ini. Setelah Kepala RQ
                memilih nama pemegangnya lewat menu Pengurus, halaman ini akan menampilkan profil
                dari rekam guru orang tersebut.
              </p>
            </div>
            <PengurusProfileForm profile={profile} amanahLabel={amanah} />
          </div>
        )}

        {full && !pemegang && !hasProfileColumns && (
          <div className="mb-8 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
            Kolom profil belum tersedia di database. Jalankan{' '}
            <code className="text-xs">drizzle/0014_profil_pengurus_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase untuk mengaktifkan form profil lengkap.
          </div>
        )}

        {/*
          Hanya untuk peran yang tanda tangannya memang dibubuhkan ke dokumen.
          Menawarkannya kepada semua orang akan mengumpulkan gambar tanda tangan
          yang tidak pernah dipakai — dan gambar tanda tangan yang menganggur
          tetap gambar tanda tangan.
        */}
        {perluTtd && (
          <div className="mb-8">
            <TandaTanganCard
              aksi={simpanTtdPengurusAction}
              src={ttdSrcSaya}
              fokus={parseTtdFocus((ttdRow as Record<string, unknown> | null)?.signature_focus)}
              nama={(profile.full_name as string | null) || profile.display_name}
              keterangan="Dibubuhkan pada rapor KPI bulanan guru saat Anda menerbitkannya. Cukup diunggah sekali — rapor yang sudah terbit menyimpan salinannya sendiri, jadi mengganti gambar di sini tidak mengubah dokumen lama."
            />
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
