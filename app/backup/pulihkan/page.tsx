import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { bolehPulihkan } from '@/lib/backup/domain'
import { PulihkanBackup } from '@/components/backup/PulihkanBackup'

// Aksi terapkan berjalan di bawah halaman ini; seluruh basis data bisa
// memakan waktu lebih lama dari batas bawaan.
export const maxDuration = 300

interface Riwayat {
  id: string
  oleh: string
  berkas: string | null
  bidang: string | null
  backup_dibuat: string | null
  dibuat: string
}

const FORMAT = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })

export default async function PulihkanPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!bolehPulihkan(session.role)) redirect('/backup')

  const { data } = await createServerClient()
    .from('pulih_riwayat')
    .select('id, oleh, berkas, bidang, backup_dibuat, dibuat')
    .order('dibuat', { ascending: false })
    .limit(5)
  const riwayat = (data ?? []) as Riwayat[]

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Pulihkan Data"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-4xl space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Keamanan data · Kepala RQ</p>
          <h1 className="mt-1 text-3xl leading-tight">Pulihkan dari backup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unggah berkas <b className="text-foreground">.json.gz</b> dari halaman Backup Data. Tabel yang ada di
            berkas dikembalikan persis seperti saat backup dibuat; tabel lain tidak disentuh. Selalu ada
            simulasi lebih dulu — tidak ada yang berubah sebelum Anda menerapkannya.
          </p>
        </div>

        <PulihkanBackup />

        {riwayat.length > 0 && (
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="font-heading text-lg font-medium">Pemulihan terakhir</h2>
            <ul className="mt-2 divide-y text-sm">
              {riwayat.map(r => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                  <span className="min-w-0 break-all">{r.berkas ?? r.bidang ?? '—'}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.oleh} · {FORMAT.format(new Date(r.dibuat))}
                    {r.backup_dibuat && <> · backup {FORMAT.format(new Date(r.backup_dibuat))}</>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
