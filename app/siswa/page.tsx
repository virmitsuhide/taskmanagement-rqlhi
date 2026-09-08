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
import { SiswaRowActions } from '@/components/siswa/SiswaRowActions'
import { Plus, Users, Upload, ArrowDown, ArrowUp } from 'lucide-react'
import { SURAH } from '@/lib/rq/quran'
import { tingkatOf } from '@/lib/rq/sesi'
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

const UNITS: Jenjang[] = ['paud', 'sd', 'sd_juara', 'smp', 'sma']

type SortKey = 'nama' | 'pengampu' | 'tahsin' | 'tahfidz'
const SORT_KEYS: SortKey[] = ['nama', 'pengampu', 'tahsin', 'tahfidz']

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

interface Baris {
  id: string
  full_name: string
  nis: string | null
  kelas: string | null
  program: string | null
  jenjang: Jenjang
  is_active: boolean
  halaqoh: string | null
  pengampu: string | null
  /** order_num jilid — kunci urut tahsin; label untuk ditampilkan. */
  tahsinUrut: number
  tahsinLabel: string
  /** Nomor surah terjauh; makin KECIL makin jauh hafalannya. */
  tahfidzUrut: number
  tahfidzLabel: string
}

/** Urut kelas secara alami: 1A, 1B, 2A … 10A — bukan 1A, 10A, 2A. */
function urutKelas(a: string, b: string): number {
  const ta = tingkatOf(a) ?? 0
  const tb = tingkatOf(b) ?? 0
  return ta !== tb ? ta - tb : a.localeCompare(b, 'id')
}

export default async function SiswaListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewStudents(session.role)) redirect('/dashboard')

  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort: SortKey = SORT_KEYS.includes(params.sort as SortKey) ? (params.sort as SortKey) : 'nama'
  const dir: 'asc' | 'desc' = params.dir === 'desc' ? 'desc' : 'asc'

  const allowed = getManageableJenjang(session.role)
  const viewableJenjang: Jenjang[] = ['kepala_rq', 'kumik', 'sdm', 'bendahara'].includes(session.role)
    ? UNITS
    : allowed.filter(j => UNITS.includes(j))

  if (viewableJenjang.length === 0) redirect('/dashboard')

  const supabase = createServerClient()
  const programScope = getListProgramScope(session.role, viewableJenjang)

  // ── Cakupan: jenjang & kelas seluruh siswa yang boleh dilihat.
  // Dua kolom untuk ~700 baris — dari sinilah angka pada tab unit dan daftar
  // kelasnya dihitung, sehingga keduanya selalu jujur terhadap pencarian aktif.
  let scopeQuery = supabase.from('students').select('jenjang, kelas').eq('is_active', true)
  if (programScope) scopeQuery = scopeQuery.in('program', programScope as string[])
  if (query) scopeQuery = scopeQuery.or(`full_name.ilike.%${query}%,nis.ilike.%${query}%`)
  const { data: scopeData } = await scopeQuery
  const scopeRows = (scopeData ?? []) as { jenjang: Jenjang; kelas: string | null }[]

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
  const tingkat = perTingkat.has(Number(params.tingkat))
    ? Number(params.tingkat)
    : tingkatList[0] ?? null
  const rombelList = tingkat === null ? [] : perTingkat.get(tingkat)!
  const kelas = rombelList.includes(params.kelas ?? '') ? params.kelas! : rombelList[0] ?? null

  // ── Baris kelas terpilih. Tanpa penghalaman: satu rombel puluhan anak.
  let baris: Baris[] = []
  if (kelas) {
    let q = supabase
      .from('students')
      .select(
        'id, full_name, nis, jenjang, kelas, program, is_active, current_jilid_page, current_jilid_id,' +
        ' halaqoh:halaqoh!students_halaqoh_id_fkey(name, wali:teachers!halaqoh_wali_teacher_id_fkey(full_name))',
      )
      .eq('is_active', true)
      .eq('jenjang', jenjang)
      .eq('kelas', kelas)
    if (programScope) q = q.in('program', programScope as string[])
    if (query) q = q.or(`full_name.ilike.%${query}%,nis.ilike.%${query}%`)

    const { data } = await q
    const rows = (data ?? []) as unknown as {
      id: string; full_name: string; nis: string | null; jenjang: Jenjang
      kelas: string | null; program: string | null; is_active: boolean
      current_jilid_page: number | null; current_jilid_id: string | null
      halaqoh: { name: string; wali: { full_name: string } | null } | null
    }[]

    const ids = rows.map(r => r.id)

    // Jilid & setoran tahfidz diambil sekali untuk seluruh kelas, lalu
    // dipasangkan di memori — bukan satu kueri per anak.
    const [{ data: jilidData }, { data: logData }] = await Promise.all([
      supabase.from('jilid_levels').select('id, label, order_num'),
      ids.length > 0
        ? supabase.from('tahfidz_logs').select('student_id, surat_id').in('student_id', ids)
        : Promise.resolve({ data: [] }),
    ])

    const jilid = new Map(
      ((jilidData ?? []) as { id: string; label: string; order_num: number }[])
        .map(j => [j.id, j]),
    )

    // Surah terjauh = NOMOR TERKECIL. Hafalan berjalan mundur dari juz 30
    // (An-Naba', 78) ke depan, jadi anak yang sudah di Al-Mulk (67) lebih jauh
    // daripada yang di An-Nas (114) — mengurutkan menaik akan membalikkannya.
    const surahMin = new Map<string, number>()
    for (const log of (logData ?? []) as { student_id: string; surat_id: number }[]) {
      const kini = surahMin.get(log.student_id)
      if (kini === undefined || log.surat_id < kini) surahMin.set(log.student_id, log.surat_id)
    }

    baris = rows.map(r => {
      const j = r.current_jilid_id ? jilid.get(r.current_jilid_id) : undefined
      const nomor = surahMin.get(r.id)
      const surah = nomor ? SURAH[nomor - 1] : undefined
      return {
        id: r.id,
        full_name: r.full_name,
        nis: r.nis,
        kelas: r.kelas,
        program: r.program,
        jenjang: r.jenjang,
        is_active: r.is_active,
        halaqoh: r.halaqoh?.name ?? null,
        pengampu: r.halaqoh?.wali?.full_name ?? null,
        // Belum terdata ditaruh di ujung apa pun arah urutannya, supaya baris
        // kosong tidak menyela deretan yang justru sedang dibandingkan.
        tahsinUrut: j?.order_num ?? Number.MAX_SAFE_INTEGER,
        tahsinLabel: j ? `${j.label}${r.current_jilid_page ? ` hal ${r.current_jilid_page}` : ''}` : '—',
        tahfidzUrut: nomor ?? Number.MAX_SAFE_INTEGER,
        tahfidzLabel: surah ? `Juz ${surah.juz} · ${surah.nama}` : '—',
      }
    })

    const arah = dir === 'asc' ? 1 : -1
    baris.sort((a, b) => {
      switch (sort) {
        case 'pengampu':
          return arah * (a.pengampu ?? 'zzz').localeCompare(b.pengampu ?? 'zzz', 'id')
        case 'tahsin':
          return arah * (a.tahsinUrut - b.tahsinUrut) || a.full_name.localeCompare(b.full_name, 'id')
        case 'tahfidz':
          return arah * (a.tahfidzUrut - b.tahfidzUrut) || a.full_name.localeCompare(b.full_name, 'id')
        default:
          return arah * a.full_name.localeCompare(b.full_name, 'id')
      }
    })
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
    if (d !== 'asc') p.set('dir', d)
    return `/siswa?${p.toString()}`
  }

  /** Klik kolom yang sama membalik arah; kolom lain selalu mulai menaik. */
  function hrefSort(key: SortKey): string {
    return href({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc' })
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Siswa" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Siswa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {JENJANG_LABELS[jenjang]}
              {kelas ? ` · Kelas ${kelas} · ${baris.length} siswa` : ' · belum ada kelas'}
            </p>
          </div>
          {canCreate && (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/siswa/impor"><Upload className="h-4 w-4 mr-1" />Impor Excel</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/siswa/baru"><Plus className="h-4 w-4 mr-1" />Tambah Siswa</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="mb-3">
          <SearchInput placeholder="Cari nama atau NIS..." />
        </div>

        {/* Unit — seluruhnya selalu tampil, termasuk yang belum berisi siswa,
            supaya terlihat unit mana saja yang memang didukung. */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {viewableJenjang.map(j => (
            <Link
              key={j}
              href={href({ jenjang: j, tingkat: null, kelas: null })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                jenjang === j
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover:bg-muted text-muted-foreground'
              }`}
            >
              {JENJANG_LABELS[j]}
              <span className="opacity-60 ml-1 tabular-nums">({jenjangCount.get(j) ?? 0})</span>
            </Link>
          ))}
        </div>

        {/* Tingkat — lapis pertama. Tanpa "Semua Kelas". */}
        {tingkatList.length > 0 && (
          <div className="flex gap-1 mb-3 overflow-x-auto border-b">
            {tingkatList.map(t => (
              <Link
                key={t}
                // Berganti tingkat membuang rombel: rombel itu milik tingkat
                // yang ditinggalkan, dan '1A' tidak ada di kelas 2.
                href={href({ tingkat: t, kelas: null })}
                className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  tingkat === t
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 0 ? 'Lainnya' : `Kelas ${t}`}
                <span className="opacity-60 ml-1 tabular-nums">
                  ({perTingkat.get(t)!.reduce((n, k) => n + (kelasCount.get(k) ?? 0), 0)})
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Rombel — lapis kedua, hanya rombel milik tingkat yang sedang dipilih. */}
        {rombelList.length > 0 && (
          <div className="flex w-fit max-w-full gap-1 mb-4 rounded-lg bg-muted p-1 overflow-x-auto">
            {rombelList.map(k => (
              <Link
                key={k}
                href={href({ kelas: k })}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  kelas === k ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {k}
                <span className="opacity-60 ml-1 tabular-nums">({kelasCount.get(k)})</span>
              </Link>
            ))}
          </div>
        )}

        {baris.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-sm">Tidak ada siswa</p>
            <p className="text-xs text-muted-foreground mt-1">
              {query
                ? `Tidak ada hasil untuk "${query}" di ${JENJANG_LABELS[jenjang]}`
                : `Belum ada siswa di ${JENJANG_LABELS[jenjang]}`}
            </p>
          </div>
        ) : (
          /* Tabel lebar menggulir di dalam wadahnya sendiri — halamannya tidak
             ikut bergeser mendatar di layar sempit. */
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <Th href={hrefSort('nama')} aktif={sort === 'nama'} dir={dir}>Nama</Th>
                  <Th href={hrefSort('pengampu')} aktif={sort === 'pengampu'} dir={dir}>Pengampu</Th>
                  <Th href={hrefSort('tahsin')} aktif={sort === 'tahsin'} dir={dir}>Capaian Tahsin</Th>
                  <Th href={hrefSort('tahfidz')} aktif={sort === 'tahfidz'} dir={dir}>Capaian Tahfidz</Th>
                  {bolehUbah && <th className="w-20 px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {baris.map(s => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      <Link href={`/siswa/${s.id}`} className="font-medium hover:underline">
                        {s.full_name}
                      </Link>
                      {s.nis && (
                        <span className="block text-[11px] text-muted-foreground">NIS {s.nis}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.pengampu ?? <em className="opacity-70">tanpa pengampu</em>}
                      {s.halaqoh && (
                        <span className="block text-[11px] opacity-70">{s.halaqoh}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{s.tahsinLabel}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.tahfidzLabel}</td>
                    {bolehUbah && (
                      <td className="px-3 py-2">
                        <SiswaRowActions id={s.id} name={s.full_name} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/** Kepala kolom yang bisa diklik untuk mengurutkan. */
function Th({
  href, aktif, dir, children,
}: { href: string; aktif: boolean; dir: 'asc' | 'desc'; children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-medium">
      <Link href={href} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {aktif && (dir === 'asc'
          ? <ArrowUp className="h-3 w-3" />
          : <ArrowDown className="h-3 w-3" />)}
      </Link>
    </th>
  )
}
