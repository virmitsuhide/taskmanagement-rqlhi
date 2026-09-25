import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { getHalaqohSesiGuru } from '@/lib/data/setoran-sesi'
import { BELUM_TERCATAT, getPosisiUnit, type PosisiSiswaUnit } from '@/lib/data/capaian-kelas'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

/**
 * Capaian unit — guru melihat sebaran capaian seluruh halaqoh di unitnya.
 *
 * Hanya JUMLAH per tingkat yang ditampilkan; nama siswa halaqoh lain tidak
 * pernah dikirim ke halaman ini. Posisi tiap siswa dihitung dengan aturan
 * yang sama dengan laporan capaian pengurus (getPosisiUnit), jadi angkanya
 * tidak akan berbeda dengan Analitik RQ.
 */

interface PageProps {
  searchParams: Promise<{ unit?: string; jenis?: string; metode?: string; kelas?: string; urut?: string }>
}

const PATH = '/guru/capaian-unit'
const NETRAL = '#E4DFD3'

/** Satu hue teal, terang → gelap: tingkat yang berurutan dibaca sebagai besaran. */
function ramp(n: number): string[] {
  const a = [0xcf, 0xe5, 0xdf]
  const b = [0x0e, 0x3f, 0x37]
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 1 : i / (n - 1)
    return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('')
  })
}

interface Sebaran {
  kolom: string[]
  warna: string[]
  jumlah: number[]
  total: number
}

type Kunci = (s: PosisiSiswaUnit) => string

function sebaran(siswa: PosisiSiswaUnit[], kunci: Kunci, urutan: string[]): Sebaran {
  const hitung = new Map<string, number>()
  for (const s of siswa) hitung.set(kunci(s), (hitung.get(kunci(s)) ?? 0) + 1)
  const tingkat = urutan.filter(k => (hitung.get(k) ?? 0) > 0)
  // Label di luar urutan baku (level lama) tetap ikut, di akhir tangga.
  const lain = [...hitung.keys()].filter(k => k !== BELUM_TERCATAT && !urutan.includes(k)).sort()
  const kolom = [...tingkat, ...lain]
  const warna = ramp(kolom.length)
  if ((hitung.get(BELUM_TERCATAT) ?? 0) > 0) { kolom.push(BELUM_TERCATAT); warna.push(NETRAL) }
  return { kolom, warna, jumlah: kolom.map(k => hitung.get(k) ?? 0), total: siswa.length }
}

function median(siswa: PosisiSiswaUnit[], kunci: Kunci, urutan: string[]): string | null {
  const pos = siswa.map(s => urutan.indexOf(kunci(s))).filter(i => i >= 0).sort((a, b) => a - b)
  if (pos.length === 0) return null
  return urutan[pos[Math.floor((pos.length - 1) / 2)]]
}

export default async function CapaianUnitPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')
  const sp = await searchParams

  const halaqohSaya = await getHalaqohSesiGuru(session.teacherId)
  const unitSaya = [...new Set(halaqohSaya.map(h => h.jenjang))] as Jenjang[]
  const unit = unitSaya.includes(sp.unit as Jenjang) ? (sp.unit as Jenjang) : unitSaya[0]
  const jenis: 'tahsin' | 'tahfidz' = sp.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'

  if (!unit) {
    return (
      <Bingkai>
        <Judul unit={null} />
        <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
          Anda belum mengampu halaqoh aktif, jadi belum ada unit yang bisa ditampilkan.
        </p>
      </Bingkai>
    )
  }

  const data = await getPosisiUnit(unit)
  const metodeAda = data.metode
  const idSaya = new Set(halaqohSaya.map(h => h.id))
  /*
    Tahsin SELALU dibaca per metode: Jilid 4 KIBAR bukan Jilid 4 Ummi, jadi
    menggabungkannya menyesatkan. Bawaannya metode yang paling banyak dipakai
    siswa halaqoh guru ini sendiri.
  */
  const hitungMetodeSaya = new Map<string, number>()
  for (const s of data.siswa) if (s.metode_id && s.halaqoh_id && idSaya.has(s.halaqoh_id)) hitungMetodeSaya.set(s.metode_id, (hitungMetodeSaya.get(s.metode_id) ?? 0) + 1)
  const metodeBawaan = [...hitungMetodeSaya.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? metodeAda[0]?.id ?? null
  const metode = jenis === 'tahsin'
    ? (metodeAda.some(m => m.id === sp.metode) ? sp.metode! : metodeBawaan)
    : null
  const namaMetode = metodeAda.find(m => m.id === metode)?.name
  const kelasAda = [...new Set(data.siswa.map(s => s.tingkat).filter((t): t is number => t !== null))].sort((a, b) => a - b)
  const kelas = kelasAda.includes(Number(sp.kelas)) ? Number(sp.kelas) : null
  const urut = sp.urut === 'median' ? 'median' : 'nama'

  const diKelas = data.siswa.filter(s => kelas === null || s.tingkat === kelas)
  const siswa = jenis === 'tahsin' ? diKelas.filter(s => s.metode_id === metode) : diKelas
  // Siswa yang belum punya level sama sekali tidak bisa dimasukkan ke metode mana pun.
  const tanpaMetode = jenis === 'tahsin' ? diKelas.filter(s => !s.metode_id).length : 0
  const urutan = jenis === 'tahsin' ? (metode ? data.tangga[metode] ?? [] : []) : data.urutanTahfidz
  const kunci: Kunci = jenis === 'tahsin' ? s => s.level ?? BELUM_TERCATAT : s => s.tahfidz
  const unitSeb = sebaran(siswa, kunci, urutan)
  const warnaDari = new Map(unitSeb.kolom.map((k, i) => [k, unitSeb.warna[i]]))
  const siswaSaya = siswa.filter(s => s.halaqoh_id && idSaya.has(s.halaqoh_id))
  const medianUnit = median(siswa, kunci, urutan)
  const medianSaya = median(siswaSaya, kunci, urutan)
  const belum = unitSeb.jumlah[unitSeb.kolom.indexOf(BELUM_TERCATAT)] ?? 0

  // Nama halaqoh & pengampu — tanpa daftar anggota.
  const idHalaqoh = [...new Set(siswa.map(s => s.halaqoh_id).filter((x): x is string => Boolean(x)))]
  const supabase = createServerClient()
  const { data: hRows } = idHalaqoh.length
    ? await supabase.from('halaqoh')
        .select('id, name, sesi, wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(full_name)')
        .in('id', idHalaqoh)
    : { data: [] }
  const infoHalaqoh = new Map(((hRows ?? []) as unknown as { id: string; name: string; sesi: number | null; wali_teacher: { full_name: string } | null }[])
    .map(h => [h.id, h]))
  const perHalaqoh = idHalaqoh.map(id => {
    const anggota = siswa.filter(s => s.halaqoh_id === id)
    const hitung = new Map<string, number>()
    for (const s of anggota) hitung.set(kunci(s), (hitung.get(kunci(s)) ?? 0) + 1)
    const med = median(anggota, kunci, urutan)
    return {
      id,
      nama: infoHalaqoh.get(id)?.name ?? 'Halaqoh',
      pengampu: infoHalaqoh.get(id)?.wali_teacher?.full_name ?? null,
      total: anggota.length,
      sel: unitSeb.kolom.map(k => hitung.get(k) ?? 0),
      median: med,
      posMedian: med ? urutan.indexOf(med) : -1,
      saya: idSaya.has(id),
    }
  }).sort((a, b) => urut === 'median'
    ? b.posMedian - a.posMedian || a.nama.localeCompare(b.nama, 'id')
    : a.nama.localeCompare(b.nama, 'id', { numeric: true }))

  const href = (g: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const isi = { unit: unitSaya.length > 1 ? unit : undefined, jenis: jenis === 'tahfidz' ? 'tahfidz' : undefined, metode: metode ?? undefined, kelas: kelas?.toString(), urut: urut === 'median' ? 'median' : undefined, ...g }
    for (const [k, v] of Object.entries(isi)) if (v) p.set(k, v)
    const qs = p.toString()
    return qs ? `${PATH}?${qs}` : PATH
  }
  const namaTingkat = jenis === 'tahsin' ? 'jilid' : 'juz'
  const persen = (n: number, t: number) => (t ? Math.round((n / t) * 100) : 0)

  return (
    <Bingkai>
      <Judul unit={JENJANG_LABELS[unit]} />

      {/* ── Saringan ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border bg-card p-4">
        <Kelompok label="Lihat">
          <Pil href={href({ jenis: undefined, metode: undefined })} aktif={jenis === 'tahsin'}>Tahsin · jilid</Pil>
          <Pil href={href({ jenis: 'tahfidz', metode: undefined })} aktif={jenis === 'tahfidz'}>Tahfidz · juz</Pil>
        </Kelompok>
        {unitSaya.length > 1 && (
          <Kelompok label="Unit">
            {unitSaya.map(u => <Pil key={u} href={href({ unit: u, metode: undefined, kelas: undefined })} aktif={u === unit}>{JENJANG_LABELS[u]}</Pil>)}
          </Kelompok>
        )}
        {jenis === 'tahsin' && metodeAda.length > 0 && (
          <Kelompok label="Metode">
            {metodeAda.map(m => <Pil key={m.id} href={href({ metode: m.id })} aktif={metode === m.id}>{m.name}</Pil>)}
          </Kelompok>
        )}
        {kelasAda.length > 1 && (
          <Kelompok label="Kelas">
            <Pil href={href({ kelas: undefined })} aktif={kelas === null}>Semua</Pil>
            {kelasAda.map(t => <Pil key={t} href={href({ kelas: String(t) })} aktif={kelas === t}>{t}</Pil>)}
          </Kelompok>
        )}
      </div>

      {/* ── Angka ringkas ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Angka label="Siswa" nilai={String(unitSeb.total)} ket={`${perHalaqoh.length} halaqoh${namaMetode ? ` · ${namaMetode}` : ''}`} />
        <Angka label="Median unit" nilai={medianUnit ?? '—'} ket={`posisi tengah ${namaTingkat}`} nada="primary" />
        <Angka label="Halaqoh Anda" nilai={medianSaya ?? '—'} ket={`${siswaSaya.length} siswa · median`} nada="warm" />
        <Angka label="Belum tercatat" nilai={String(belum)} ket={`${persen(belum, unitSeb.total)}% belum punya posisi`} />
      </div>

      {tanpaMetode > 0 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {tanpaMetode} siswa di unit ini belum punya level tahsin, jadi belum masuk metode mana pun.
        </p>
      )}

      {unitSeb.total === 0 ? (
        <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
          Tidak ada siswa yang cocok dengan saringan ini.
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* ── Sebaran se-unit ── */}
          <section className="rounded-2xl border bg-card p-5 md:p-6">
            <h2 className="font-heading text-xl leading-tight">
              {jenis === 'tahsin' ? 'Sebaran jilid se-unit' : 'Juz yang sedang dihafal'}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {JENJANG_LABELS[unit]}{namaMetode ? ` · metode ${namaMetode}` : ''}{kelas ? ` · kelas ${kelas}` : ''}
            </p>
            <div className="my-5 flex justify-center">
              <Donut seb={unitSeb} tengah={medianUnit ?? String(unitSeb.total)} bawah={medianUnit ? 'median unit' : 'siswa'} />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="pb-1.5 font-semibold">Tingkat</th>
                  <th className="pb-1.5 text-right font-semibold">Siswa</th>
                  <th className="pb-1.5 text-right font-semibold">%</th>
                  <th className="pb-1.5 text-right font-semibold">Halaqoh Anda</th>
                </tr>
              </thead>
              <tbody>
                {unitSeb.kolom.map((k, i) => {
                  const milik = siswaSaya.filter(s => kunci(s) === k).length
                  return (
                    <tr key={k} className="border-t">
                      <td className="py-1.5">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: unitSeb.warna[i] }} />
                          {k}
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{unitSeb.jumlah[i]}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{persen(unitSeb.jumlah[i], unitSeb.total)}%</td>
                      <td className={cn('py-1.5 text-right text-xs tabular-nums', milik ? 'font-semibold text-accent-warm' : 'text-muted-foreground')}>
                        {milik ? `${milik} siswa` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {medianUnit && medianSaya && (
              <p className="mt-4 rounded-xl bg-primary-wash px-4 py-3 text-sm leading-relaxed">
                Median unit <b>{medianUnit}</b>; halaqoh Anda <b>{medianSaya}</b>
                {medianSaya === medianUnit ? ' — sejajar dengan unit.' : urutan.indexOf(medianSaya) > urutan.indexOf(medianUnit) ? ' — di depan median unit.' : ' — di belakang median unit.'}
              </p>
            )}
          </section>

          {/* ── Per halaqoh ── */}
          <section className="rounded-2xl border bg-card p-5 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl leading-tight">Per halaqoh</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Batang penuh = seluruh siswa halaqoh itu</p>
              </div>
              <Kelompok label="Urutkan">
                <Pil href={href({ urut: undefined })} aktif={urut === 'nama'} kecil>Nama</Pil>
                <Pil href={href({ urut: 'median' })} aktif={urut === 'median'} kecil>Median tertinggi</Pil>
              </Kelompok>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
              {unitSeb.kolom.map((k, i) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: unitSeb.warna[i] }} />{k}
                </span>
              ))}
            </div>
            <ul className="mt-4 space-y-1">
              {perHalaqoh.map(h => (
                <li
                  key={h.id}
                  className={cn('grid grid-cols-1 gap-1.5 rounded-xl px-3 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)_110px] sm:items-center sm:gap-4',
                    h.saya && 'bg-accent-warm-wash')}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{h.nama}</span>
                      {h.saya && <span className="shrink-0 rounded-md bg-accent-warm px-1.5 py-0.5 text-[10px] font-bold text-white">Anda</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {h.pengampu ? `${h.pengampu} · ` : ''}{h.total} siswa
                    </span>
                  </span>
                  <span className="flex h-5 overflow-hidden rounded-md bg-muted" role="img"
                    aria-label={`${h.nama}: ${unitSeb.kolom.map((k, i) => h.sel[i] ? `${k} ${h.sel[i]}` : '').filter(Boolean).join(', ')}`}>
                    {h.sel.map((n, i) => n > 0 && (
                      <span
                        key={i}
                        title={`${unitSeb.kolom[i]}: ${n} siswa`}
                        className="flex items-center justify-center border-r-2 border-card text-[10px] font-bold last:border-r-0"
                        style={{ width: `${(n / h.total) * 100}%`, background: warnaDari.get(unitSeb.kolom[i]), color: i >= unitSeb.warna.length / 2 && unitSeb.kolom[i] !== BELUM_TERCATAT ? '#fff' : 'var(--foreground)' }}
                      >
                        {n / h.total >= 0.1 ? n : ''}
                      </span>
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground sm:text-right">
                    median <b className="text-foreground">{h.median ?? '—'}</b>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Arahkan kursor (atau ketuk) batang untuk jumlah per tingkat. Nama siswa halaqoh lain tidak ditampilkan — hanya jumlahnya.
            </p>
          </section>
        </div>
      )}
    </Bingkai>
  )
}

function Bingkai({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8">{children}</div>
    </div>
  )
}

function Judul({ unit }: { unit: string | null }) {
  return (
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">
        Siswa &amp; capaian · capaian unit{unit ? ` · ${unit}` : ''}
      </p>
      <h1 className="mt-1 text-3xl tracking-tight">Sampai mana halaqoh-halaqoh di unit saya?</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Bandingkan capaian halaqoh Anda dengan kelompok lain di unit yang sama — tahsin menurut jilid, tahfidz menurut juz.
      </p>
    </header>
  )
}

function Kelompok({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Pil({ href, aktif, kecil, children }: { href: string; aktif: boolean; kecil?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={aktif ? 'true' : undefined}
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-colors',
        kecil ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-sm',
        aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

function Angka({ label, nilai, ket, nada }: { label: string; nilai: string; ket: string; nada?: 'primary' | 'warm' }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-heading text-3xl leading-none', nada === 'primary' && 'text-primary', nada === 'warm' && 'text-accent-warm')}>{nilai}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{ket}</p>
    </div>
  )
}

/** Donut SVG: tiap segmen punya celah tipis dan <title> untuk hover. */
function Donut({ seb, tengah, bawah }: { seb: Sebaran; tengah: string; bawah: string }) {
  const size = 220, tebal = 34
  const r = size / 2 - tebal / 2 - 2
  const keliling = 2 * Math.PI * r
  const celah = seb.kolom.length > 1 ? 2.5 : 0
  let geser = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Sebaran ${seb.total} siswa`}>
      {seb.kolom.map((k, i) => {
        const panjang = (keliling * seb.jumlah[i]) / (seb.total || 1)
        const garis = Math.max(panjang - celah, 0.5)
        const el = (
          <circle
            key={k}
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={seb.warna[i]} strokeWidth={tebal}
            strokeDasharray={`${garis} ${keliling - garis}`}
            strokeDashoffset={-geser}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          >
            <title>{`${k}: ${seb.jumlah[i]} siswa (${Math.round((seb.jumlah[i] / (seb.total || 1)) * 100)}%)`}</title>
          </circle>
        )
        geser += panjang
        return el
      })}
      <text x={size / 2} y={size / 2 + 2} textAnchor="middle" className="fill-foreground font-heading" fontSize={tengah.length > 8 ? 24 : 32}>{tengah}</text>
      <text x={size / 2} y={size / 2 + 24} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>{bawah}</text>
    </svg>
  )
}
