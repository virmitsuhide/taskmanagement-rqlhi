import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageAllAccounts, ROLE_LABELS, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { AccountRow } from './AccountRow'
import type { Jenjang, UserRole } from '@/types'

export default async function AkunPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageAllAccounts(session.role)) redirect('/dashboard')

  const supabase = createServerClient()

  const [{ data: users }, { data: teachers }] = await Promise.all([
    supabase.from('users').select('id, username, display_name, role'),
    supabase
      .from('teachers')
      .select('id, username, full_name, unit, is_active')
      .is('deleted_at', null),
  ])

  // Urutan abjad memakai localeCompare('id'); urutan bawaan database memakai
  // perbandingan byte, yang menaruh semua huruf besar sebelum huruf kecil.
  const pengurus = (users ?? []).sort((a, b) => a.display_name.localeCompare(b.display_name, 'id'))
  const guru = (teachers ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'))

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Akun & Password" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight">Akun &amp; Password</h1>
        <p className="text-sm text-muted-foreground mt-0.5 mb-5">
          {pengurus.length} akun pengurus · {guru.length} akun guru
        </p>

        {/*
          Keterangan ini bukan basa-basi teknis. Tanpa penjelasan, "kenapa
          password lama tidak kelihatan?" akan muncul berulang kali, dan
          jawabannya justru menjelaskan mengapa sistemnya aman.
        */}
        <div className="mb-5 flex gap-3 rounded-xl border border-info/30 bg-info-wash px-4 py-3">
          <ShieldAlert className="h-4 w-4 shrink-0 text-info mt-0.5" />
          <div className="text-xs leading-relaxed text-info">
            <p className="font-semibold">Password lama tidak bisa ditampilkan — termasuk untuk Kepala RQ.</p>
            <p className="mt-1 text-info/90">
              Yang tersimpan di database adalah hash bcrypt, bukan passwordnya. Hash itu satu arah:
              dipakai untuk memeriksa apakah password yang diketik cocok, tapi tidak bisa dikembalikan
              menjadi teks aslinya. Itu disengaja — kalau database ini bocor, tidak ada satu pun password
              guru atau pengurus yang ikut terbaca.
            </p>
            <p className="mt-1 text-info/90">
              Yang bisa dilakukan di sini: <b>Atur</b> untuk mengetik password baru, atau <b>Reset</b> untuk
              dibuatkan yang acak. Password barunya tampil sekali di layar untuk kamu salin dan sampaikan
              ke orangnya.
            </p>
          </div>
        </div>

        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-2">Pengurus</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            {pengurus.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada akun pengurus.</p>
            ) : (
              pengurus.map(u => (
                <AccountRow
                  key={u.id}
                  target="user"
                  id={u.id}
                  name={u.display_name}
                  username={u.username}
                  keterangan={ROLE_LABELS[u.role as UserRole] ?? u.role}
                />
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2">Guru</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            {guru.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada akun guru.</p>
            ) : (
              guru.map(t => (
                <AccountRow
                  key={t.id}
                  target="teacher"
                  id={t.id}
                  name={t.full_name}
                  username={t.username}
                  keterangan={t.unit ? JENJANG_LABELS[t.unit as Jenjang] : 'Tanpa unit'}
                  nonaktif={!t.is_active}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
