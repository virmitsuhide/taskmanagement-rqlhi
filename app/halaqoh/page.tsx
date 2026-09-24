import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewHalaqoh, canManageHalaqoh, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { Plus, Users, ChevronRight, Pencil, MapPin, Upload } from 'lucide-react'
import { sesiLabel, sesiKelasLabel } from '@/lib/rq/sesi'
import { programLabel } from '@/lib/rq/programs'
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
// # · Pengampu · Tempat · Siswa · Capaian · aksi.
// Unit tidak lagi jadi kolom sendiri — ia menempel sebagai lencana di sel
// Pengampu, sehingga keterangannya tidak hilang tapi juga tidak memakan lebar
// yang lebih dibutuhkan capaian.
const COLS = 'grid-cols-[34px_1.7fr_1.3fr_0.5fr_1.1fr_104px]'


export default async function HalaqohListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewHalaqoh(session.role)) redirect('/dashboard')

  const params = await searchParams
  const jenjangFilter = params.jenjang as Jenjang | undefined
  /*
    Sesi SELALU terpilih; tidak ada lagi keadaan ‘semua sesi’.

    Menayangkan 72 halaqoh sekaligus tidak menjawab pertanyaan siapa pun — yang
    dibawa koor ke layar ini selalu satu sesi, sebab sesi itulah jam yang sedang
    berjalan. Nilainya ditetapkan di bawah, setelah terlihat sesi mana yang
    benar-benar berisi.
  */
  const sesiParam = ['1', '2', '3'].includes(params.sesi ?? '') ? Number(params.sesi)
    : params.sesi === 'tanpa' ? 0
    : null
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
  //
  // Penyaringan program ikut di sini, sebab aturannya milik canViewHalaqoh:
  // koor QULS SD hanya melihat kelompok QULS, sementara koor SD melihat
  // seluruh SD. Menyalin aturan itu jadi kondisi SQL berarti dua tempat yang
  // harus sepakat selamanya.
  const allInScope = ((halaqohData ?? []) as HalaqohWithStats[])
    .filter(h => canViewHalaqoh(session.role, h.jenjang, h.program))
    .filter(h =>
      !q ||
      h.name.toLowerCase().includes(q) ||
      (h.wali_teacher?.full_name ?? '').toLowerCase().includes(q),
    )

  const sesiCount = new Map<number, number>()
  for (const h of allInScope) {
    if (h.sesi) sesiCount.set(h.sesi, (sesiCount.get(h.sesi) ?? 0) + 1)
  }
  const tanpaSesi = allInScope.filter(h => !h.sesi).length

  /*
    Tab yang ditawarkan: sesi yang ada isinya, ditambah penampungan ‘0’ untuk
    halaqoh yang sesinya belum diisi.

    Penampungan itu bukan kerapian. Tanpa keadaan ‘semua’, halaqoh tanpa sesi
    tidak punya satu pun tab yang memuatnya — ia lenyap dari layar tanpa galat,
    dan satu-satunya cara membetulkan sesinya adalah lewat halaman yang tidak
    lagi menampilkannya.
  */
  const sesiTabs: number[] = [1, 2, 3].filter(s => (sesiCount.get(s) ?? 0) > 0)
  if (tanpaSesi > 0) sesiTabs.push(0)

  const sesiFilter: number | null =
    sesiParam !== null && (sesiParam === 0 ? tanpaSesi > 0 : (sesiCount.get(sesiParam) ?? 0) > 0)
      ? sesiParam
      : sesiTabs[0] ?? null

  const halaqohList = sesiFilter === null
    ? []
    : allInScope.filter(h => (h.sesi ?? 0) === sesiFilter)

  /*
    Jumlah siswa DAN capaiannya, dari satu ambilan yang sama.

    Capaian dibagi tiga menurut penanda pada jilid_levels, bukan menurut tebakan
    atas nama levelnya: is_quran menandai tingkat Al-Qur’an (‘Talaqqi Al-Qur’an’,
    ‘Al-Qur’an T1’, …), is_terminal menandai ‘Lulus Tahsin’ — anak yang sudah
    selesai tahsin dan kini fokus tahfidz. Sisanya jilid.

    Enam metode hidup berdampingan (UMMI, KIBAR, Syajaroh, Tilawati, Ummi, Iqro)
    dengan penamaan yang berbeda-beda, jadi mencocokkan teks label akan salah
    pada sebagian di antaranya. Kedua penanda itu ada justru supaya tidak perlu.
  */
  const capaian = new Map<string, { jilid: number; quran: number; tahfidz: number }>()
  if (halaqohList.length > 0) {
    const ids = halaqohList.map(h => h.id)
    const [{ data: siswa }, { data: levels }] = await Promise.all([
      supabase.from('students')
        .select('halaqoh_id, current_jilid_id')
        .in('halaqoh_id', ids)
        .eq('is_active', true),
      supabase.from('jilid_levels').select('id, is_quran, is_terminal'),
    ])

    const level = new Map(
      ((levels ?? []) as { id: string; is_quran: boolean | null; is_terminal: boolean | null }[])
        .map(l => [l.id, l]),
    )

    const countMap = new Map<string, number>()
    for (const row of (siswa ?? []) as { halaqoh_id: string; current_jilid_id: string | null }[]) {
      countMap.set(row.halaqoh_id, (countMap.get(row.halaqoh_id) ?? 0) + 1)

      const c = capaian.get(row.halaqoh_id) ?? { jilid: 0, quran: 0, tahfidz: 0 }
      const l = row.current_jilid_id ? level.get(row.current_jilid_id) : undefined
      // Belum terdata tidak dihitung ke mana pun. Memasukkannya ke ‘jilid’
      // membuat halaqoh yang levelnya belum diisi tampak seperti halaqoh jilid.
      if (l?.is_terminal) c.tahfidz++
      else if (l?.is_quran) c.quran++
      else if (l) c.jilid++
      capaian.set(row.halaqoh_id, c)
    }
    for (const h of halaqohList) h.student_count = countMap.get(h.id) ?? 0
  }

  const totalSiswa = halaqohList.reduce((t, h) => t + (h.student_count ?? 0), 0)

  // Keterangan sesi tidak lagi jadi kepala kelompok DI DALAM tabel.
  //
  // Kepala itu sticky (top-[85px] z-10), dan begitu daftar digulir ia menempel
  // lalu MENUTUPI baris pertama: yang terbaca di posisi halaqoh nomor 1 adalah
  // ‘Sesi 1 · 08.00–09.00 · 26’, sementara tombol Edit di bawahnya tetap milik
  // baris yang tertutup. Dulu ia sepadan harganya karena satu layar memuat tiga
  // sesi sekaligus; sejak sesi selalu tunggal, ia hanya menutupi satu baris
  // tanpa memberi keterangan apa pun yang belum ada di tab di atasnya.
  const ringkasKelas = kelasRingkas(halaqohList)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Halaqoh" showBack ownH1 />
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Tahsin &amp; tahfidz</p>
            <h1 className="mt-2 text-3xl leading-tight md:text-4xl">Halaqoh</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Kelompok belajar tahsin &amp; tahfidz ·{' '}
              <b className="font-semibold text-foreground tabular-nums">{halaqohList.length}</b> halaqoh ·{' '}
              <b className="font-semibold text-foreground tabular-nums">{totalSiswa}</b> siswa
            </p>
          </div>
          {canCreateAny && (
            <div className="flex gap-2">
              {/* Impor kelompok ditaruh berdampingan dengan Buat Halaqoh: yang
                  satu menyiapkan wadahnya, yang lain mengisinya — dan urutan
                  itulah yang harus dikerjakan saat pembagian semester baru. */}
              <Button asChild variant="outline">
                <Link href="/halaqoh/impor"><Upload className="h-4 w-4 mr-1" />Impor Kelompok</Link>
              </Button>
              <Button asChild>
                <Link href="/halaqoh/baru"><Plus className="h-4 w-4 mr-1" />Buat Halaqoh</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Baris alat: cari · unit · ringkasan. Ringkasannya di kanan supaya
            mata jatuh ke daftar dulu, bukan ke angka. */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-full sm:w-72">
            <SearchInput placeholder="Cari wali atau nama halaqoh…" />
          </div>
          <div role="group" aria-label="Unit" className="flex gap-0.5 rounded-[10px] bg-muted p-[3px] overflow-x-auto">
            <UnitChip href={hrefFor(undefined, sesiFilter, q)} active={!jenjangFilter}>Semua Unit</UnitChip>
            {viewableJenjang.map(j => (
              <UnitChip key={j} href={hrefFor(j, sesiFilter, q)} active={jenjangFilter === j}>
                {JENJANG_LABELS[j]}
              </UnitChip>
            ))}
          </div>
        </div>

        {/* Tab sesi. Jam ikut ditampilkan karena itulah pembeda sesungguhnya
            antar sesi — nomornya sendiri tidak memberi tahu apa-apa. */}
        <div className="flex gap-2 mb-4 overflow-x-auto border-b">
          {sesiTabs.map(s => (
            <SesiTab key={s} href={hrefFor(jenjangFilter, s, q)} active={sesiFilter === s}>
              {s === 0 ? 'Belum ada sesi' : sesiLabel(s)}{' '}
              <Count n={s === 0 ? tanpaSesi : sesiCount.get(s) ?? 0} />
            </SesiTab>
          ))}
        </div>

        {sesiFilter === 0 && (
          <p className="mb-3 text-xs text-warning">
            {tanpaSesi} halaqoh belum punya sesi — jamnya kosong sampai diisi lewat Edit.
          </p>
        )}

        {ringkasKelas && (
          <p className="mb-3 text-xs text-muted-foreground">{ringkasKelas}</p>
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
          <div className="rounded-2xl border bg-card overflow-hidden">
            {/* ── Layar lebar: tabel padat ── */}
            <div className="hidden md:block">
              <div className={cn('grid px-5 bg-muted/50 border-b', COLS)}>
                <HeadCell className="text-right pr-3">#</HeadCell>
                <HeadCell>Pengampu</HeadCell>
                <HeadCell>Tempat</HeadCell>
                <HeadCell className="text-right pr-3">Siswa</HeadCell>
                <HeadCell>Capaian</HeadCell>
                <span />
              </div>
              {halaqohList.map((h, i) => (
                <DesktopRow key={h.id} h={h} no={i + 1} role={session.role} cap={capaian.get(h.id)} />
              ))}
            </div>

            {/* ── Layar sempit: daftar ── */}
            <div className="md:hidden">
              {halaqohList.map((h, i) => (
                <MobileRow key={h.id} h={h} no={i + 1} cap={capaian.get(h.id)} />
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

/**
 * Penanda program kelompok, mis. 'QULS'.
 *
 * Hanya muncul kalau programnya ditandai. Sebagian besar halaqoh reguler dan
 * programnya NULL; melabeli semuanya 'Reguler' berarti menambah 70 lencana
 * yang tidak membedakan apa pun.
 */
function ProgramChip({ h }: { h: HalaqohWithStats }) {
  if (!h.program) return null
  return (
    <span className="shrink-0 rounded bg-primary-wash px-1.5 py-px text-[10px] font-semibold text-primary">
      {programLabel(h.jenjang, h.program)}
    </span>
  )
}

/** Sebaran capaian satu halaqoh. Nol tidak ditampilkan — lihat CapaianChips. */
interface Capaian { jilid: number; quran: number; tahfidz: number }

/**
 * Sebaran capaian satu halaqoh: berapa anak di jilid, di Al-Qur’an, dan di
 * tahfidz.
 *
 * Yang bernilai nol DIBUANG, bukan ditulis ‘0’. Satu halaqoh jarang memuat
 * ketiganya sekaligus; menuliskan ketiga golongan pada 72 baris berarti dua per
 * tiganya berisi nol, dan angka yang berarti tenggelam di antara yang tidak.
 */
function CapaianChips({ c }: { c?: Capaian }) {
  const bagian = [
    { n: c?.jilid ?? 0, label: 'Jilid', kelas: 'bg-muted text-muted-foreground' },
    { n: c?.quran ?? 0, label: 'Al-Qur’an', kelas: 'bg-primary-wash text-primary' },
    { n: c?.tahfidz ?? 0, label: 'Tahfidz', kelas: 'bg-success-wash text-success' },
  ].filter(b => b.n > 0)

  if (bagian.length === 0) {
    return <span className="text-[11.5px] text-muted-foreground">—</span>
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {bagian.map(b => (
        <span
          key={b.label}
          className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', b.kelas)}
        >
          {b.n} {b.label}
        </span>
      ))}
    </span>
  )
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

function DesktopRow(
  { h, no, role, cap }:
  { h: HalaqohWithStats; no: number; role: UserRole; cap?: Capaian },
) {
  const wali = h.wali_teacher?.full_name ?? null
  return (
    // `group` + tautan meregang: barisnya bisa diklik seluruhnya tanpa
    // membungkus tombol Edit di dalam <a> lain (anchor bersarang tidak sah).
    <div
      className={cn(
        'group relative grid items-center h-16 px-5 border-b last:border-b-0 transition-colors hover:bg-primary-wash/40',
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
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
              {JENJANG_LABELS[h.jenjang]}
            </span>
            <ProgramChip h={h} />
            <span className="block truncate text-[11.5px] text-muted-foreground" title={h.name}>{namaRingkas(h.name)}</span>
          </span>
        </span>
      </span>
      {/* Sebagian tempat panjang ('Perpustakaan bagian depan meja pak Har',
          39 karakter) dan terpotong di layar ~768px — `title` menjaga teks
          penuhnya tetap bisa dibaca tanpa membuka detail. */}
      <span className="text-[13px] text-muted-foreground truncate pr-3" title={h.tempat || undefined}>
        {h.tempat || '—'}
      </span>
      <span className="pr-3 text-sm font-semibold text-right tabular-nums">{h.student_count ?? 0}</span>
      <span className="pr-3"><CapaianChips c={cap} /></span>
      {/* Aksi muncul saat hover; `focus-within` menjaganya tetap terjangkau
          lewat keyboard, yang tidak bisa diungkapkan mockup statis. */}
      <span className="relative z-10 flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {canManageHalaqoh(role, h.jenjang, h.program) && (
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

function MobileRow({ h, no, cap }: { h: HalaqohWithStats; no: number; cap?: Capaian }) {
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
          <ProgramChip h={h} />
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{h.tempat || '—'}</span>
          <span className="shrink-0">· {h.student_count ?? 0} siswa</span>
        </span>
        <span className="mt-1 flex"><CapaianChips c={cap} /></span>
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
        'whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
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
  // 0 adalah penampungan 'belum punya sesi'; nilainya harus ikut tertulis,
  // sebab tanpa itu tabnya tidak bisa dipilih sama sekali.
  if (sesi === 0) params.set('sesi', 'tanpa')
  else if (sesi) params.set('sesi', String(sesi))
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
        '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
        active
          ? 'border-primary text-foreground'
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
