import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers, canViewTeachers } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { Plus, Mail, Phone } from 'lucide-react'
import type { Teacher } from '@/types'

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>
}

export default async function UstadzListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewTeachers(session.role)) redirect('/dashboard')

  const params = await searchParams
  const query = (params.q ?? '').trim()
  const status = params.status === 'inactive' ? 'inactive' : 'active'
  const canCreate = canManageTeachers(session.role)

  const supabase = createServerClient()
  let q = supabase
    .from('teachers')
    .select('id, username, full_name, nip, email, phone, is_active, created_at')
    .order('full_name')

  q = q.eq('is_active', status === 'active')
  if (query) q = q.or(`full_name.ilike.%${query}%,username.ilike.%${query}%,nip.ilike.%${query}%`)

  const { data } = await q
  const teachers = (data ?? []) as Pick<Teacher, 'id' | 'username' | 'full_name' | 'nip' | 'email' | 'phone' | 'is_active' | 'created_at'>[]

  // Counter siswa & halaqoh per guru
  const ids = teachers.map(t => t.id)
  let halaqohCountMap = new Map<string, number>()
  if (ids.length > 0) {
    const { data: halaqohRows } = await supabase
      .from('halaqoh')
      .select('wali_teacher_id')
      .in('wali_teacher_id', ids)
      .eq('is_active', true)
    halaqohCountMap = new Map()
    for (const row of halaqohRows ?? []) {
      if (row.wali_teacher_id) {
        halaqohCountMap.set(row.wali_teacher_id, (halaqohCountMap.get(row.wali_teacher_id) ?? 0) + 1)
      }
    }
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Ustadz / Guru" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Ustadz / Guru</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {teachers.length} guru {status === 'active' ? 'aktif' : 'nonaktif'}
            </p>
          </div>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/ustadz/baru"><Plus className="h-4 w-4 mr-1" />Tambah Guru</Link>
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-4 items-center flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SearchInput placeholder="Cari nama, username, atau NIP..." />
          </div>
          <div className="flex gap-1 border rounded-lg p-0.5 bg-card">
            <StatusChip href={statusHref(query, 'active')} active={status === 'active'}>Aktif</StatusChip>
            <StatusChip href={statusHref(query, 'inactive')} active={status === 'inactive'}>Nonaktif</StatusChip>
          </div>
        </div>

        {teachers.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            {query ? `Tidak ada hasil untuk "${query}"` : 'Belum ada guru terdaftar'}
          </div>
        ) : (
          <div className="rounded-lg border divide-y bg-card">
            {teachers.map(t => (
              <Link
                key={t.id}
                href={`/ustadz/${t.id}`}
                className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                  {t.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{t.full_name}</p>
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">@{t.username}</code>
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {t.nip && <span>NIP {t.nip}</span>}
                    {t.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{t.email}</span>}
                    {t.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{t.phone}</span>}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  {halaqohCountMap.get(t.id) ?? 0} halaqoh
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function statusHref(q: string, status: 'active' | 'inactive'): string {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (status !== 'active') p.set('status', status)
  const qs = p.toString()
  return qs ? `/ustadz?${qs}` : '/ustadz'
}

function StatusChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  )
}
