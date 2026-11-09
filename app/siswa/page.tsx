import { tolakAkses } from '@/lib/auth/tolak-akses'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import {
  canViewStudents, canManageStudents, getListProgramScope, getManageableJenjang, JENJANG_LABELS,
} from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { TabelSiswa } from '@/components/siswa/TabelSiswa'
import { Plus, Users, Upload, ArrowUpDown, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ARAH_AWAL, bacaUrutan, getBarisSiswa, jenjangTerlihat, ketArah, LABEL_SORT, SORT_KEYS, urutKelas, urutkanBaris,
  type Baris, type SortKey,
} from '@/lib/data/daftar-siswa'
import { tingkatOf } from '@/lib/rq/sesi'
import { kelasJelas } from '@/lib/rq/kelas'
import type { Jenjang } from '@/types'

/**
 * Daftar siswa — dibaca per kelas, bukan per unit.
 *
 * Tidak ada lagi tab "Semua". Tak seorang pun bekerja dengan 694 anak sekaligus:
 * yang dibawa koor ke layar ini selalu satu rombel — "siapa saja di 4B", "sudah
 * sampai mana tahsin 7A". Tab "Semua" hanya menjadi halaman pertama yang harus
 * dilewati sebelum pekerjaan yang sebenarnya dimulai.
 *
 * Konsekuensinya bukan sekadar tampilan. Karena satu kelas hanya berisi puluhan
 * anak, seluruh barisnya muat diambil sekaligus — dan itulah yang membuat
 * pengurutan menurut capaian tahfidz mungkin. Capaian itu DIHITUNG dari
 * tahfidz_logs, tidak tersimpan sebagai kolom, jadi ia tidak bisa diurutkan oleh
 * database. Pada daftar 694 baris berhalaman, kolom itu hanya bisa mengurutkan
 * halaman yang sedang terbuka — yang lebih menyesatkan daripada tidak ada.
 */

interface PageProps {
  searchParams: Promise<{
    q?: string
    jenjang?: string
    tingkat?: string
    kelas?: string
    sort?: string
    dir?: string
  }>
}

export default async function SiswaListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewStudents(session.role)) await tolakAkses()

  const params = await searchParams
  const query = (params.q ?? '').trim()
  const { sort, dir } = bacaUrutan(params.sort, params.dir)

  const allowed = getManageableJenjang(session.role)
  const viewableJenjang = jenjangTerlihat(session.role)

  if (viewableJenjang.length === 0) await tolakAkses()

  const supabase = createServerClient()
  const programScope = getListProgramScope(session.role, viewableJenjang)

  // ── Cakupan: jenjang & kelas seluruh siswa yang boleh dilihat.
  // Dua kolom untuk ~700 baris — dari sinilah angka pada tab unit dan daftar
  // kelasnya dihitung, sehingga keduanya selalu jujur terhadap pencarian aktif.
  let scopeQuery = supabase.from('students').select('jenjang, kelas, program').eq('is_active', true)
  if (programScope) scopeQuery = scopeQuery.in('program', programScope as string[])
  if (query) scopeQuery = scopeQuery.or(`full_name.ilike.%${query}%,nis.ilike.%${query}%`)
  const { data: scopeData } = await scopeQuery
  const scopeRows = (scopeData ?? []) as {
    jenjang: Jenjang; kelas: string | null; program: string | null
  }[]

  const jenjangCount = new Map<Jenjang, number>()
  for (const row of scopeRows) jenjangCount.set(row.jenjang, (jenjangCount.get(row.jenjang) ?? 0) + 1)

  // Unit terpilih: dari URL kalau sah, kalau tidak unit pertama yang ADA ISINYA.
  // Membuka halaman ini di tab PAUD yang kosong membuat sistem tampak rusak
  // padahal cuma belum ada muridnya.
  const jenjang: Jenjang =
    viewableJenjang.includes(params.jenjang as Jenjang)
      ? (params.jenjang as Jenjang)
      : viewableJenjang.find(j => (jenjangCount.get(j) ?? 0) > 0) ?? viewableJenjang[0]

  // Daftar kelas nyata di unit ini — termasuk nilai bawaan Excel seperti "4.0".
  // Sengaja TIDAK disembunyikan: selama ia muncul sebagai tab, ada yang melihat
  // dan bisa membetulkannya lewat tombol sunting. Disembunyikan berarti 33 anak
  // itu lenyap dari layar tanpa seorang pun tahu mereka salah kelas.
  const kelasCount = new Map<string, number>()
  for (const row of scopeRows) {
    if (row.jenjang !== jenjang || !row.kelas) continue
    kelasCount.set(row.kelas, (kelasCount.get(row.kelas) ?? 0) + 1)
  }

  /*
    Dua lapis: tingkat dulu, rombelnya menyusul setelah tingkat dipilih.

    Menayangkan 23 rombel SD sekaligus memaksa mata menyaring sendiri apa yang
    seharusnya disaring layar — dan pada layar sempit deretan itu menggulung
    jauh melewati tepi. Tingkat lebih dulu memotongnya jadi paling empat pilihan.

    Tetap tanpa pilihan ‘semua’ di kedua lapis: satu kelas selalu terpilih, dan
    tidak ada halaman antara yang harus dilewati sebelum sampai ke sana.
  */
  const perTingkat = new Map<number, string[]>()
  for (const k of [...kelasCount.keys()].sort(urutKelas)) {
    // Kelas tanpa angka (mis. rombel PAUD 'A') dikumpulkan di tingkat 0 dan
    // ditampilkan sebagai ‘Lainnya’. Membuangnya berarti anak-anak itu lenyap
    // dari layar tanpa seorang pun tahu mereka ada.
    const t = tingkatOf(k) ?? 0
    const daftar = perTingkat.get(t) ?? []
    daftar.push(k)
    perTingkat.set(t, daftar)
  }
  const tingkatList = [...perTingkat.keys()].sort((a, b) => a - b)

  /*
    Anak yang kelasnya belum jelas — '4.0' dan kawan-kawannya dari impor Excel.

    Mereka TETAP terhitung pada tingkatnya di deretan atas; tab ini menyorot,
    bukan memindahkan. Sebuah tab "belum jelas" yang mengambil alih 31 anak
    dari Kelas 4 akan membuat jumlah di tab Kelas 4 tidak lagi cocok dengan
    jumlah anak kelas 4 yang sebenarnya — dan itu persoalan kedua, bukan
    perbaikan atas yang pertama.

    Disaring per program juga, bukan cuma jenjang: koor SD melihat siswa QULS
    tetapi tidak boleh menyuntingnya, dan tab yang menghitung anak yang tak
    bisa ia sentuh hanya mengantarnya ke halaman kosong.
  */
  const belumJelas = scopeRows.filter(
    r => r.jenjang === jenjang
      && !kelasJelas(r.jenjang, r.kelas)
      && canManageStudents(session.role, r.jenjang, r.program),
  ).length
  const tingkat = perTingkat.has(Number(params.tingkat))
    ? Number(params.tingkat)
    : tingkatList[0] ?? null
  const rombelList = tingkat === null ? [] : perTingkat.get(tingkat)!
  const kelas = rombelList.includes(params.kelas ?? '') ? params.kelas! : rombelList[0] ?? null

  // ── Baris kelas terpilih. Tanpa penghalaman: satu rombel puluhan anak.
  let baris: Baris[] = []
  if (kelas) {
    baris = urutkanBaris(await getBarisSiswa({ role: session.role, jenjang, kelas: [kelas], query }), sort, dir)
  }

  const bolehUbah = canManageStudents(session.role, jenjang)
  const canCreate = allowed.length > 0

  function href(next: {
    jenjang?: Jenjang; tingkat?: number | null; kelas?: string | null
    sort?: SortKey; dir?: string
  }): string {
    const p = new URLSearchParams()
    if (query) p.set('q', query)
    p.set('jenjang', next.jenjang ?? jenjang)
    const t = next.tingkat === undefined ? tingkat : next.tingkat
    if (t !== null) p.set('tingkat', String(t))
    const k = next.kelas === undefined ? kelas : next.kelas
    if (k) p.set('kelas', k)
    const s = next.sort ?? sort
    if (s !== 'nama') p.set('sort', s)
    const d = next.dir ?? dir
    if (d !== ARAH_AWAL[s]) p.set('dir', d)
    return `/siswa?${p.toString()}`
  }

  /** Klik urutan yang sama membalik arah; urutan lain mulai dari arah awalnya. */
  function hrefSort(key: SortKey): string {
    return href({ sort: key, dir: sort === key ? (dir === 'asc' ? 'desc' : 'asc') : ARAH_AWAL[key] })
  }

  // Unduhan membawa unit, kelas, pencarian & urutan yang sedang dipakai di layar.
  const paramUnduh: Record<string, string> = { jenjang, sort, dir }
  if (tingkat !== null) paramUnduh.tingkat = String(tingkat)
  if (kelas) paramUnduh.kelas = kelas
  if (query) paramUnduh.q = query

  // ── Angka ringkas untuk rombel yang sedang terbuka (dari baris yang sudah dimuat).
  const tanpaPengampu = baris.filter(s => !s.pengampu).length
  const tahsinTercatat = baris.filter(s => s.tahsinLabel !== '—').length
  const tahfidzTercatat = baris.filter(s => s.tahfidzLabel !== '—').length
  const persen = (n: number) => (baris.length ? Math.round((n / baris.length) * 100) : 0)
  const siswaTingkat = tingkat === null ? 0 : rombelList.reduce((n, k) => n + (kelasCount.get(k) ?? 0), 0)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Siswa" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Pembinaan Qur&rsquo;an · siswa</p>
            <h1 className="mt-1 max-w-3xl font-heading text-3xl leading-tight md:text-[34px]">
              {kelas ? (
                <>
                  Siswa {JENJANG_LABELS[jenjang]} kelas {kelas} — {baris.length} anak
                  {tanpaPengampu > 0 ? <>, <i>{tanpaPengampu} belum punya pengampu.</i></> : '.'}
                </>
              ) : (
                <>Siswa {JENJANG_LABELS[jenjang]} — <i>belum ada kelas.</i></>
              )}
            </h1>
          </div>
          {canCreate && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/siswa/impor"><Upload className="mr-1 h-4 w-4" />Impor Excel</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/siswa/baru"><Plus className="mr-1 h-4 w-4" />Tambah siswa</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Unit — seluruhnya selalu tampil, termasuk yang belum berisi siswa,
            supaya terlihat unit mana saja yang memang didukung. */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <nav aria-label="Unit" className="flex flex-wrap gap-1.5">
            {viewableJenjang.map(j => (
              <Link
                key={j}
                href={href({ jenjang: j, tingkat: null, kelas: null })}
                aria-current={jenjang === j ? 'page' : undefined}
                className={cn('inline-flex h-[34px] items-center gap-1 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
                  jenjang === j ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground')}
              >
                {JENJANG_LABELS[j]}
                <span className="tabular-nums opacity-70">{jenjangCount.get(j) ?? 0}</span>
              </Link>
            ))}
          </nav>
          <div className="md:ml-auto md:w-64">
            <SearchInput placeholder="Cari nama atau NIS" />
          </div>
        </div>

        {/* Tingkat — lapis pertama, sebagai ubin. Tanpa "Semua Kelas". */}
        {tingkatList.length > 0 && (
          <nav aria-label="Tingkat kelas" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {tingkatList.map(t => {
              const n = perTingkat.get(t)!.reduce((m, k) => m + (kelasCount.get(k) ?? 0), 0)
              const on = tingkat === t
              return (
                <Link
                  key={t}
                  // Berganti tingkat membuang rombel: rombel itu milik tingkat
                  // yang ditinggalkan, dan '1A' tidak ada di kelas 2.
                  href={href({ tingkat: t, kelas: null })}
                  aria-current={on ? 'page' : undefined}
                  className={cn('flex flex-col rounded-xl border px-3.5 py-2.5 transition-colors',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/40')}
                >
                  <span className="text-sm font-bold">{t === 0 ? 'Lainnya' : `Kelas ${t}`}</span>
                  <span className={cn('text-xs tabular-nums', on ? 'opacity-80' : 'text-muted-foreground')}>{n} siswa</span>
                </Link>
              )
            })}
          </nav>
        )}

        {/* Rombel — lapis kedua, hanya rombel milik tingkat yang sedang dipilih.
            Di sampingnya tautan pembenahan untuk anak yang kelasnya belum jelas —
            hilang sendiri begitu tidak ada lagi yang menggantung. */}
        {(rombelList.length > 0 || belumJelas > 0) && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {rombelList.length > 0 && (
              <nav aria-label="Rombel" className="flex flex-wrap gap-1.5">
                {rombelList.map(k => (
                  <Link
                    key={k}
                    href={href({ kelas: k })}
                    aria-current={kelas === k ? 'page' : undefined}
                    className={cn('inline-flex h-[34px] items-center gap-1 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
                      kelas === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground')}
                  >
                    {k}
                    <span className="tabular-nums opacity-70">{kelasCount.get(k)}</span>
                  </Link>
                ))}
              </nav>
            )}
            {belumJelas > 0 && (
              <Link
                href="/siswa/kelas"
                className="inline-flex items-center gap-2 self-start rounded-full bg-accent-warm-wash px-3.5 py-2 text-[12.5px] font-semibold text-accent-warm transition-opacity hover:opacity-80 md:ml-auto md:self-auto"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {belumJelas} siswa kelasnya belum jelas — rapikan →
              </Link>
            )}
          </div>
        )}

        {kelas && baris.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label={`Siswa di ${kelas}`}
              value={baris.length}
              note={rombelList.length > 1 ? `${tingkat === 0 ? 'Lainnya' : `Kelas ${tingkat}`}: ${siswaTingkat} siswa` : 'satu-satunya rombel'}
            />
            <StatTile label="Tahsin tercatat" value={tahsinTercatat} note={`${persen(tahsinTercatat)}% dari rombel`} />
            <StatTile label="Tahfidz tercatat" value={tahfidzTercatat} note={`${persen(tahfidzTercatat)}% dari rombel`} />
            <StatTile label="Tanpa pengampu" value={tanpaPengampu} note="belum masuk halaqoh berpengampu" warm={tanpaPengampu > 0} />
          </div>
        )}

        {baris.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card py-12 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Tidak ada siswa</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {query
                ? `Tidak ada hasil untuk "${query}" di ${JENJANG_LABELS[jenjang]}`
                : `Belum ada siswa di ${JENJANG_LABELS[jenjang]}`}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
          {/* Pilihan urut yang terlihat — kepala kolom tetap bisa diklik, tapi di
              HP tabelnya menggulir mendatar dan kepala kolom mudah terlewat. */}
          <nav aria-label="Urutkan" className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />Urutkan
            </span>
            {SORT_KEYS.map(k => {
              const on = sort === k
              return (
                <Link
                  key={k}
                  href={hrefSort(k)}
                  aria-current={on ? 'true' : undefined}
                  title={on ? 'Klik lagi untuk membalik arah' : undefined}
                  className={cn('inline-flex h-[30px] items-center gap-1 rounded-full border px-3 text-[12px] font-semibold transition-colors',
                    on ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground')}
                >
                  {LABEL_SORT[k]}
                  {on && <span className="font-normal opacity-80">· {ketArah(k, dir)}</span>}
                </Link>
              )
            })}
          </nav>
          <TabelSiswa
            key={`${jenjang}:${kelas}:${query}`}
            baris={baris}
            bolehUbah={bolehUbah}
            sort={sort}
            dir={dir}
            hrefSort={{ nama: hrefSort('nama'), pengampu: hrefSort('pengampu'), tahsin: hrefSort('tahsin'), tahfidz: hrefSort('tahfidz') }}
            unduh={paramUnduh}
            kelas={kelas ?? ''}
            labelAngkatan={tingkat === 0 ? 'Lainnya' : `Kelas ${tingkat}`}
            jumlahAngkatan={siswaTingkat}
          />
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, note, warm }: { label: string; value: number; note: string; warm?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3.5 md:px-5 md:py-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-heading text-[34px] leading-none tabular-nums', warm && 'text-accent-warm')}>{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
