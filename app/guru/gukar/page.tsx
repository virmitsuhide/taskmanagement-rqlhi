import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ListChecks, Users } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getCurrentTerm, formatTerm } from '@/lib/data/terms'
import { getGukarGroupsFor, getGukarParticipants, bolehMengampuGukar } from '@/lib/data/gukar'
import { hariIni } from '@/lib/rutin/periode'
import { HalamanGuru } from '@/components/guru/HalamanGuru'

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
      <HalamanGuru judul="Pembinaan Guru &amp; Karyawan">
        <p className="text-sm text-muted-foreground">
            Pembinaan gukar diampu oleh guru Tetap Yayasan dan Kontrak Yayasan.
            Kalau status kepegawaianmu semestinya termasuk salah satunya, hubungi SDM
            untuk memperbaiki datanya.
        </p>
      </HalamanGuru>
    )
  }

  const term = await getCurrentTerm()
  if (!term) {
    return (
      <HalamanGuru judul="Pembinaan Guru &amp; Karyawan">
        <p className="text-sm text-muted-foreground">
            Belum ada semester berjalan. Hubungi Kepala RQ atau Kumik untuk menetapkannya.
        </p>
      </HalamanGuru>
    )
  }

  const groups = await getGukarGroupsFor(session.teacherId, term.id)
  const counts = await Promise.all(groups.map(g => getGukarParticipants(g.id).then(p => p.length)))
  const period = hariIni().slice(0, 7)

  return (
    <HalamanGuru judul="Pembinaan Guru &amp; Karyawan" keterangan={formatTerm(term)}>
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground bg-muted/30">
            Anda belum ditetapkan sebagai pengampu kelompok pembinaan.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {groups.map((group, i) => (
              <li key={group.id} className="flex items-stretch gap-2">
                <Link
                  href={`/guru/gukar/${group.id}?periode=${period}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
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
                {/* Jalan pintas ke tindakan yang paling sering: setor sesi. */}
                <Link
                  href={`/guru/gukar/${group.id}/sesi`}
                  className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border bg-card px-4 text-xs font-medium text-primary transition-colors hover:border-primary/50"
                >
                  <ListChecks className="h-5 w-5" />Setor sesi
                </Link>
              </li>
            ))}
          </ul>
        )}
    </HalamanGuru>
  )
}
