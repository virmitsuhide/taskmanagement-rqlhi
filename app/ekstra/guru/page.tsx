import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav } from '@/components/ekstra/EkstraSubNav'
import { KelolaGuruEkstra, type BarisGuruEkstra } from '@/components/ekstra/KelolaGuruEkstra'
import { getDataEkstra, getGuruEkstra } from '@/lib/data/ekstra'
import type { Jenjang } from '@/types'

/**
 * Guru ekstra — daftar guru lintas unit yang bersedia mengampu ekstra.
 * Hanya guru di daftar aktif ini yang bisa dibooking orang tua dan dijadikan
 * pengampu halaqoh ekstra (migrasi 0095).
 */
export default async function GuruEkstraPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const [{ ids, daftar }, data, guruRes] = await Promise.all([
    getGuruEkstra(),
    getDataEkstra(),
    createServerClient().from('teachers').select('id, full_name, unit').eq('is_active', true).is('deleted_at', null).order('full_name'),
  ])
  const unitLabel = (u: string | null) => (u ? JENJANG_LABELS[u as Jenjang] ?? u : 'Tanpa unit')

  const baris: BarisGuruEkstra[] = daftar.map(g => {
    const slot = data.slot.filter(s => s.aktif && s.teacher_id === g.teacher_id)
    return { id: g.teacher_id, nama: g.nama, unit: unitLabel(g.unit), aktif: g.aktif, halaqoh: slot.length, peserta: slot.reduce((n, s) => n + s.peserta, 0) }
  }).sort((a, b) => Number(b.aktif) - Number(a.aktif) || a.nama.localeCompare(b.nama, 'id'))

  const sudah = new Set(daftar.map(d => d.teacher_id))
  const calon = ((guruRes.data ?? []) as { id: string; full_name: string; unit: string | null }[])
    .filter(t => !sudah.has(t.id))
    .map(t => ({ id: t.id, nama: t.full_name, unit: unitLabel(t.unit) }))

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Guru Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · guru</p>
          <h1 className="mt-1 text-3xl leading-tight">Guru ekstra</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Guru dari unit mana pun yang bersedia mengampu ekstra. Guru yang tidak ada di daftar ini tidak bisa dibooking orang tua
            (tombol Booking di kartunya nonaktif), tidak muncul di pilihan guru, dan tidak bisa dijadikan pengampu halaqoh ekstra.
          </p>
        </div>
        <EkstraSubNav />
        {ids === null ? (
          <p className="rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm">
            Tabel guru ekstra belum ada. Jalankan <code className="text-xs">drizzle/0095_ekstra_guru_PASTE_TO_SUPABASE.sql</code> di Supabase.
            Sampai itu dijalankan, semua guru dianggap menerima ekstra.
          </p>
        ) : (
          <KelolaGuruEkstra daftar={baris} calon={calon} />
        )}
      </div>
    </div>
  )
}
