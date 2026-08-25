import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Users } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getCurrentTerm, formatTerm } from '@/lib/data/terms'
import { getGukarGroupsFor, getGukarParticipants, bolehMengampuGukar } from '@/lib/data/gukar'
import { TeacherHeader } from '@/components/layout/TeacherHeader'
import { currentPeriod } from '@/lib/finance/period'

/**
 * Daftar kelompok pembinaan yang diampu guru ini.
 *
 * Pengampu hanya melihat kelompoknya sendiri — rekap seluruh kelompok adalah
 * wilayah SDM, bukan bagian dari portal guru.
 */
export default async function GukarGroupsPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  // Pembinaan gukar hanya diampu guru Tetap Yayasan & Kontrak Yayasan.
  // Ditolak dengan penjelasan, bukan dialihkan diam-diam — guru yang menekan
  // menunya berhak tahu kenapa halamannya tidak terbuka.
  if (!(await bolehMengampuGukar(session.teacherId))) {
    return (
      <div>
        <TeacherHeader fullName={session.fullName} />
        <div className="p-4 md:p-6 max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">Pembinaan Guru &amp; Karyawan</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Pembinaan gukar diampu oleh guru Tetap Yayasan dan Kontrak Yayasan.
            Kalau status kepegawaianmu semestinya termasuk salah satunya, hubungi SDM
            untuk memperbaiki datanya.
          </p>
        </div>
      </div>
    )
  }

  const term = await getCurrentTerm()
  if (!term) {
    return (
      <div>
        <TeacherHeader fullName={session.fullName} />
        <div className="p-4 md:p-6 max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">Pembinaan Guru & Karyawan</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada semester berjalan. Hubungi Kepala RQ atau Kumik untuk menetapkannya.
          </p>
        </div>
      </div>
    )
  }

  const groups = await getGukarGroupsFor(session.teacherId, term.id)
  const counts = await Promise.all(groups.map(g => getGukarParticipants(g.id).then(p => p.length)))
  const period = currentPeriod()

  return (
    <div>
      <TeacherHeader fullName={session.fullName} />
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight">Pembinaan Guru &amp; Karyawan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{formatTerm(term)}</p>

        {groups.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            Anda belum ditetapkan sebagai pengampu kelompok pembinaan.
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {groups.map((group, i) => (
              <li key={group.id}>
                <Link
                  href={`/guru/gukar/${group.id}?periode=${period}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {counts[i]} peserta{group.unit ? ` · ${group.unit}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
