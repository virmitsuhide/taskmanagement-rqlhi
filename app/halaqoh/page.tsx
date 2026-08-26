import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewHalaqoh, canManageHalaqoh, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader, HEADER_STICKY_TOP } from '@/components/layout/DashboardHeader'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { Plus, Users, ChevronRight, Pencil, MapPin } from 'lucide-react'
import { sesiLabel, sesiKelasLabel } from '@/lib/rq/sesi'
import { initials, cn } from '@/lib/utils'
import type { Halaqoh, Jenjang, Teacher, UserRole } from '@/types'

type HalaqohWithStatsBase = Omit<Halaqoh, 'wali_teacher'>

interface PageProps {
  searchParams: Promise<{ jenjang?: string; sesi?: string; q?: string }>
}

interface HalaqohWithStats extends HalaqohWithStatsBase {
  wali_teacher: Pick<Teacher, 'id' | 'full_name'> | null
  student_count: number
}

/**
 * Lebar kolom tabel padat. Dipakai bersama oleh baris kepala dan baris data —
 * kalau dipisah, keduanya melenceng begitu salah satu diubah.
 *
 * Sesi dan jam sengaja tidak punya kolom: keduanya seragam di dalam satu
 * kelompok, jadi tempatnya di kepala kelompok. Mengulangnya 26 kali hanya
 * menambah tinta tanpa menambah keterangan.
 *
 * Kolom pertama nomor urut wali di dalam sesinya — bukan nomor global, karena
 * yang dirujuk saat rapat adalah 'guru ke-4 sesi 2', bukan 'guru ke-30'.
 */
const COLS = 'grid-cols-[34px_2fr_1.4fr_0.6fr_0.5fr_104px]'

/** Sesi 1–3 lebih dulu, lalu halaqoh yang belum punya sesi. */
const GROUP_ORDER: (number | null)[] = [1, 2, 3, null]

export default async function HalaqohListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewHalaqoh(session.role)) redirect('/dashboard')

  const params = await searchParams
  const jenjangFilter = params.jenjang as Jenjang | undefined
  const sesiFilter = ['1', '2', '3'].includes(params.sesi ?? '') ? Number(params.sesi) : null
  const q = (params.q ?? '').trim().toLowerCase()
  const allowed = getManageableJenjang(session.role)
  const canCreateAny = allowed.length > 0

  const supabase = createServerClient()
  let query = supabase
    .from('halaqoh')
    .select('*, wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(id, full_name)')
    .order('jenjang')
    .order('name')

  // Scope ke jenjang yang user bisa lihat
  const viewableJenjang: Jenjang[] = ['kepala_rq', 'kumik', 'sdm', 'bendahara'].includes(session.role)
    ? ['paud', 'sd', 'sd_juara', 'smp', 'sma']
    : allowed
  if (viewableJenjang.length > 0) {
    query = query.in('jenjang', viewableJenjang)
  }
  if (jenjangFilter && viewableJenjang.includes(jenjangFilter)) {
    query = query.eq('jenjang', jenjangFilter)
  }

  const { data: halaqohData } = await query

  // Pencarian disaring di memori: himpunannya puluhan baris, dan menyaring di
  // sini membuat angka pada tab sesi ikut menyusut mengikuti kata kunci —
  // tab yang tetap menunjukkan 26 padahal hasilnya 2 justru menyesatkan.
  const allInScope = ((halaqohData ?? []) as HalaqohWithStats[]).filter(h =>
    !q ||
    h.name.toLowerCase().includes(q) ||
    (h.wali_teacher?.full_name ?? '').toLowerCase().includes(q),
  )

  const sesiCount = new Map<number, number>()
  for (const h of allInScope) {
    if (h.sesi) sesiCount.set(h.sesi, (sesiCount.get(h.sesi) ?? 0) + 1)
  }
  const tanpaSesi = allInScope.filter(h => !h.sesi).length

  const halaqohList = sesiFilter
    ? allInScope.filter(h => h.sesi === sesiFilter)
    : allInScope

  // Hitung jumlah siswa per halaqoh
  if (halaqohList.length > 0) {
    const ids = halaqohList.map(h => h.id)
    const { data: counts } = await supabase
      .from('students')
      .select('halaqoh_id')
      .in('halaqoh_id', ids)
      .eq('is_active', true)
    const countMap = new Map<string, number>()
    for (const row of counts ?? []) {
      countMap.set(row.halaqoh_id, (countMap.get(row.halaqoh_id) ?? 0) + 1)
    }
    for (const h of halaqohList) h.student_count = countMap.get(h.id) ?? 0
  }

  const totalSiswa = halaqohList.reduce((t, h) => t + (h.student_count ?? 0), 0)

  const groups = GROUP_ORDER
    .map(sesi => {
      const rows = halaqohList.filter(h => (h.sesi ?? null) === sesi)
      return { sesi, rows, kelas: kelasRingkas(rows) }
    })
    .filter(g => g.rows.length > 0)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Halaqoh" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Halaqoh</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Kelompok belajar tahsin &amp; tahfidz
            </p>
          </div>
          {canCreateAny && (
            <Button asChild size="sm">
              <Link href="/halaqoh/baru"><Plus className="h-4 w-4 mr-1" />Buat Halaqoh</Link>
            </Button>
          )}
        </div>

        {/* Baris alat: cari · unit · ringkasan. Ringkasannya di kanan supaya
            mata jatuh ke daftar dulu, bukan ke angka. */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="w-full sm:w-72">
            <SearchInput placeholder="Cari wali atau nama halaqoh…" />
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
            <UnitChip href={hrefFor(undefined, sesiFilter, q)} active={!jenjangFilter}>Semua Unit</UnitChip>
            {viewableJenjang.map(j => (
              <UnitChip key={j} href={hrefFor(j, sesiFilter, q)} active={jenjangFilter === j}>
                {JENJANG_LABELS[j]}
              </UnitChip>
            ))}
          </div>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums">
            <b className="text-foreground">{halaqohList.length}</b> halaqoh ·{' '}
            <b className="text-foreground">{totalSiswa}</b> siswa
          </span>
        </div>

        {/* Tab sesi. Jam ikut ditampilkan karena itulah pembeda sesungguhnya
            antar sesi — nomornya sendiri tidak memberi tahu apa-apa. */}
        <div className="flex gap-1 mb-4 overflow-x-auto border-b">
          <SesiTab href={hrefFor(jenjangFilter, null, q)} active={!sesiFilter}>
            Semua Sesi <Count n={allInScope.length} />
          </SesiTab>
          {[1, 2, 3].map(s => (
            <SesiTab key={s} href={hrefFor(jenjangFilter, s, q)} active={sesiFilter === s}>
              {sesiLabel(s)} <Count n={sesiCount.get(s) ?? 0} />
            </SesiTab>
          ))}
        </div>

        {tanpaSesi > 0 && !sesiFilter && (
          <p className="mb-3 text-xs text-warning">
            {tanpaSesi} halaqoh belum punya sesi — jamnya kosong sampai diisi lewat Edit.
          </p>
        )}

        {halaqohList.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-sm">
              {q ? 'Tidak ada halaqoh yang cocok' : 'Belum ada halaqoh'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {q
                ? `Tidak ada wali atau nama halaqoh yang mengandung "${params.q}".`
                : canCreateAny ? "Klik 'Buat Halaqoh' untuk memulai" : 'Tidak ada halaqoh di lingkup Anda'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            {/* ── Layar lebar: tabel padat ── */}
            <div className="hidden md:block">
              <div className={cn('grid px-5 bg-muted/40 border-b', COLS)}>
                <HeadCell className="text-right pr-3">#</HeadCell>
                <HeadCell>Wali</HeadCell>
                <HeadCell>Tempat</HeadCell>
                <HeadCell>Unit</HeadCell>
                <HeadCell className="text-right">Siswa</HeadCell>
                <span />
              </div>
              {groups.map(g => (
                <div key={g.sesi ?? 'none'}>
                  <GroupHeader sesi={g.sesi} count={g.rows.length} kelas={g.kelas} />
                  {g.rows.map((h, i) => (
                    <DesktopRow key={h.id} h={h} no={i + 1} role={session.role} />
                  ))}
                </div>
              ))}
            </div>

            {/* ── Layar sempit: daftar ── */}
            <div className="md:hidden">
              {groups.map(g => (
                <div key={g.sesi ?? 'none'}>
                  <GroupHeader sesi={g.sesi} count={g.rows.length} kelas={g.kelas} />
                  {g.rows.map((h, i) => (
                    <MobileRow key={h.id} h={h} no={i + 1} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HeadCell({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn('py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground', className)}>
      {children}
    </span>
  )
}

/**
 * Kepala kelompok sesi. Menempel tepat di bawah DashboardHeader supaya saat
 * daftar digulir, sesi yang sedang dibaca tetap terlihat — itu inti dari
 * mengelompokkan per sesi.
 */
function GroupHeader({ sesi, count, kelas }: { sesi: number | null; count: number; kelas: string }) {
  return (
    <div className={cn(HEADER_STICKY_TOP, 'sticky z-10 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-y border-primary/15 bg-primary-wash px-4 md:px-5 py-2')}>
      <span className="text-xs font-bold text-primary">{sesiLabel(sesi)}</span>
      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
        {count}
      </span>
      {kelas && <span className="text-[11px] text-primary/70">{kelas}</span>}
    </div>
  )
}

/**
 * 'SD kelas 3 & 4 · SMP kelas 9'.
 *
 * Satu sesi memuat lebih dari satu unit, dan tingkat kelasnya berbeda per unit
 * — jadi keterangannya tidak bisa satu kalimat tunggal. Saat daftar sedang
 * disaring ke satu unit, sisanya hilang dengan sendirinya.
 */
function kelasRingkas(rows: HalaqohWithStats[]): string {
  const seen = new Map<Jenjang, string>()
  for (const h of rows) {
    if (seen.has(h.jenjang)) continue
    const label = sesiKelasLabel(h.jenjang, h.sesi)
    if (label) seen.set(h.jenjang, label)
  }
  return [...seen].map(([j, l]) => `${JENJANG_LABELS[j]} ${l}`).join(' · ')
}

/**
 * 'Sesi 1 — Ust. Amru' → 'Ust. Amru'.
 *
 * Seluruh 72 halaqoh dinamai dengan awalan sesinya, padahal sesi itu sudah
 * jadi kepala kelompok di atas baris. Yang tersisa setelah awalan dibuang
 * justru bagian yang membedakan — nama panggilan wali dan penanda seperti
 * '(QULS)'. Kalau pola namanya berubah, teks aslinya dipakai apa adanya.
 */
function namaRingkas(name: string): string {
  return name.replace(/^Sesi\s*\d+\s*[—–-]\s*/i, '').trim() || name
}

function Avatar({ name, className }: { name: string | null; className?: string }) {
  return (
    <span
      className={cn(
        'flex items-center justify-center shrink-0 bg-primary-wash text-primary font-bold',
        className,
      )}
      aria-hidden
    >
      {name ? initials(name) : '—'}
    </span>
  )
}

function DesktopRow({ h, no, role }: { h: HalaqohWithStats; no: number; role: UserRole }) {
  const wali = h.wali_teacher?.full_name ?? null
  return (
    // `group` + tautan meregang: barisnya bisa diklik seluruhnya tanpa
    // membungkus tombol Edit di dalam <a> lain (anchor bersarang tidak sah).
    <div
      className={cn(
        'group relative grid items-center h-14 px-5 border-b last:border-b-0 transition-colors hover:bg-muted/40',
        COLS,
        // Halaqoh nonaktif diredupkan seluruh barisnya, bukan cuma diberi
        // lencana — supaya bedanya terlihat saat memindai, bukan saat membaca.
        !h.is_active && 'opacity-55',
      )}
    >
      <Link href={`/halaqoh/${h.id}`} className="absolute inset-0" aria-label={`Buka ${h.name}`} />
      <span className="pr-3 text-right text-xs font-medium text-muted-foreground tabular-nums">{no}</span>
      {/* Identitas jadi satu blok: nama lengkap yang dicari orang di atas,
          nama panggilan yang dipakai sehari-hari di bawahnya. */}
      <span className="flex items-center gap-2.5 min-w-0 pr-3">
        <Avatar name={wali} className="w-8 h-8 rounded-full text-[11px]" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate" title={wali ?? undefined}>{wali ?? <em>Wali belum ditentukan</em>}</span>
            {!h.is_active && (
              <span className="shrink-0 rounded bg-warning-wash px-1.5 py-px text-[10px] font-semibold text-warning">
                Nonaktif
              </span>
            )}
          </span>
          <span className="block text-[11.5px] text-muted-foreground truncate" title={h.name}>{namaRingkas(h.name)}</span>
        </span>
      </span>
      {/* Sebagian tempat panjang ('Perpustakaan bagian depan meja pak Har',
          39 karakter) dan terpotong di layar ~768px — `title` menjaga teks
          penuhnya tetap bisa dibaca tanpa membuka detail. */}
      <span className="text-[13px] text-muted-foreground truncate pr-3" title={h.tempat || undefined}>
        {h.tempat || '—'}
      </span>
      <span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
          {JENJANG_LABELS[h.jenjang]}
        </span>
      </span>
      <span className="text-sm font-semibold text-right tabular-nums">{h.student_count ?? 0}</span>
      {/* Aksi muncul saat hover; `focus-within` menjaganya tetap terjangkau
          lewat keyboard, yang tidak bisa diungkapkan mockup statis. */}
      <span className="relative z-10 flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {canManageHalaqoh(role, h.jenjang) && (
          <Link
            href={`/halaqoh/${h.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-2.5 py-1 text-[11.5px] font-semibold text-primary hover:bg-primary-wash transition-colors"
          >
            <Pencil className="h-3 w-3" />Edit
          </Link>
        )}
      </span>
    </div>
  )
}

function MobileRow({ h, no }: { h: HalaqohWithStats; no: number }) {
  const wali = h.wali_teacher?.full_name
  return (
    <Link
      href={`/halaqoh/${h.id}`}
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b last:border-b-0 transition-colors active:bg-muted/40',
        !h.is_active && 'opacity-55',
      )}
    >
      <span className="w-4 shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums">{no}</span>
      <Avatar name={wali ?? null} className="w-9 h-9 rounded-xl text-xs" />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate">{wali ?? 'Wali belum ditentukan'}</span>
          {!h.is_active && (
            <span className="shrink-0 rounded bg-warning-wash px-1.5 py-px text-[10px] font-semibold text-warning">
              Nonaktif
            </span>
          )}
        </span>
        {/* Tanpa kepala kolom, ikon lokasi yang menandai mana yang tempat —
            di tabel ikon itu justru mubazir karena kolomnya sudah berlabel. */}
        <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground min-w-0">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{h.tempat || '—'}</span>
          <span className="shrink-0">· {h.student_count ?? 0} siswa</span>
        </span>
      </span>
      <span className="rounded-md bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground shrink-0">
        {JENJANG_LABELS[h.jenjang]}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
    </Link>
  )
}

function UnitChip({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

/**
 * Tautan daftar halaqoh dengan unit, sesi, dan kata kunci digabung.
 *
 * Ketiganya harus saling mempertahankan: memilih sesi tidak boleh membuang
 * unit atau pencarian yang sedang aktif, dan sebaliknya.
 */
function hrefFor(jenjang: Jenjang | undefined, sesi: number | null, q: string): string {
  const params = new URLSearchParams()
  if (jenjang) params.set('jenjang', jenjang)
  if (sesi) params.set('sesi', String(sesi))
  if (q) params.set('q', q)
  const qs = params.toString()
  return qs ? `/halaqoh?${qs}` : '/halaqoh'
}

function SesiTab({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
        active
          ? 'border-primary font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 text-xs text-muted-foreground tabular-nums">({n})</span>
}
