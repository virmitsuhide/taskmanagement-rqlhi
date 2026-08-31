import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, UserRound } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEmployees } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { TEACHER_EMPLOYMENT_LABELS } from '@/types'
import type { Employee } from '@/types'

/**
 * Daftar karyawan RQ. Khusus kepala RQ & SDM.
 *
 * Terpisah dari daftar Ustadz/Guru karena orangnya memang beda jenis: karyawan
 * tidak mengampu halaqoh, tidak menyetor hafalan, dan tidak dinilai KPI. Sampai
 * halaman ini ada, satu-satunya cara menyembunyikan Bendahara dari daftar guru
 * adalah menandainya sebagai guru non-aktif.
 */
export default async function KaryawanPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEmployees(session.role)) redirect('/dashboard')

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('employees')
    .select('id, username, full_name, jabatan, nip, email, phone, is_active, deleted_at, employment_type, joined_at, contract_start, contract_end')
    .is('deleted_at', null)

  // Urutan abjad memakai localeCompare('id'); urutan bawaan database memakai
  // perbandingan byte, yang menaruh semua huruf besar sebelum huruf kecil.
  const daftar = ((data ?? []) as Employee[]).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, 'id'),
  )

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Karyawan" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Karyawan RQ</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {daftar.length} akun · portal mereka hanya berisi Profil
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/karyawan/baru"><Plus className="mr-1 h-3.5 w-3.5" />Tambah</Link>
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
            Tabel karyawan belum ada. Jalankan{' '}
            <code className="text-xs">drizzle/0048_karyawan_rq_PASTE_TO_SUPABASE.sql</code> di Supabase.
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          {daftar.length === 0 && !error ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Belum ada akun karyawan.
            </p>
          ) : (
            daftar.map(k => (
              <Link
                key={k.id}
                href={`/karyawan/${k.id}/edit`}
                className="flex items-center gap-3 border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{k.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[k.jabatan, `@${k.username}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {k.employment_type && (
                    <p className="text-xs text-muted-foreground">
                      {TEACHER_EMPLOYMENT_LABELS[k.employment_type]}
                    </p>
                  )}
                  {!k.is_active && <p className="text-xs text-warning">non-aktif</p>}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
