import { Lock } from 'lucide-react'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { TEACHER_EMPLOYMENT_LABELS } from '@/types'
import type { EmployeeProfile, GuruProfile, Jenjang } from '@/types'
import type { SumberAmanah } from '@/lib/data/pengurus'

/**
 * Data yang tidak bisa diubah pengurus dari halaman profilnya.
 *
 * Ditampilkan, bukan disembunyikan. Amanah ditetapkan Kepala RQ; unit, TMT,
 * NIP, dan jenis kepegawaian dipegang SDM karena ketiganya menentukan rubrik
 * KPI dan masa kerja yang tercetak di rapor. Kalau ada yang keliru, pemiliknya
 * perlu melihatnya untuk bisa melaporkannya.
 */
export function KepegawaianTerkunci({
  profile,
  sumber,
  amanah,
}: {
  profile: GuruProfile | EmployeeProfile
  sumber: SumberAmanah
  amanah: string
}) {
  const karyawan = sumber === 'karyawan'
  const unit = karyawan ? null : ((profile as GuruProfile).unit as Jenjang | null)

  return (
    <section className="mb-6 rounded-xl border bg-muted/30 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Ditetapkan Kepala RQ &amp; SDM — sampaikan bila ada yang keliru
      </p>
      <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Baris label="Amanah saat ini" value={amanah} tebal />
        <Baris label="Nama lengkap" value={profile.full_name} />
        <Baris label="NIP" value={profile.nip ?? '—'} />
        {karyawan ? (
          <Baris label="Jabatan" value={(profile as EmployeeProfile).jabatan ?? '—'} />
        ) : (
          <Baris label="Unit penugasan" value={unit ? JENJANG_LABELS[unit] : '—'} />
        )}
        <Baris label="TMT / bergabung" value={profile.joined_at ? tanggal(profile.joined_at) : 'belum diisi'} />
        <Baris
          label="Jenis kepegawaian"
          value={profile.employment_type ? TEACHER_EMPLOYMENT_LABELS[profile.employment_type] : '—'}
        />
      </div>
    </section>
  )
}

function Baris({ label, value, tebal }: { label: string; value: string; tebal?: boolean }) {
  return (
    <p className="flex gap-2">
      <span className="w-[130px] shrink-0 text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">:</span>
      <span className={`min-w-0 flex-1 ${tebal ? 'font-semibold' : 'font-medium'}`}>{value}</span>
    </p>
  )
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function tanggal(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${BULAN[m - 1]} ${y}`
}
