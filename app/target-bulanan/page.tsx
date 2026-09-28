import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import {
  canKelolaTargetBulanan, canViewTargetBulanan, getManageableJenjang, JENJANG_LABELS,
} from '@/lib/auth/permissions'
import { getKalenderTahfidz } from '@/lib/data/target-tahfidz'
import { getTanggaTahsin, getTargetBulanan, type TargetBulanan } from '@/lib/data/target-bulanan'
import { tahunAjaranDari } from '@/lib/rq/target-tahfidz'
import {
  bulanTahunAjaran, kelompokTarget, LABEL_KATEGORI, labelBulan, labelTingkat, teksPosisiTahsin,
  type JenisTarget, type KategoriTarget,
} from '@/lib/rq/target-bulanan'
import { SURAH } from '@/lib/rq/quran'
import { UNIT_ORDER } from '@/lib/rq/programs'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop } from '@/components/dashboard/kit'
import { FormAmbang, SelTarget } from '@/components/target-bulanan/SelTarget'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; jenis?: string; kelompok?: string }>
}

const namaSurat = (n: number | null) => (n ? SURAH[n - 1]?.nama ?? `Surah ${n}` : '')

function teksTarget(t: TargetBulanan | undefined): string | null {
  if (!t) return null
  if (t.jenis === 'tahsin') {
    if (!t.awal_tahap) return null
    const awal = teksPosisiTahsin(t.awal_tahap, t.awal_halaman)
    const akhir = teksPosisiTahsin(t.akhir_tahap, t.akhir_halaman)
    return awal === akhir ? awal : `${awal} – ${akhir}`
  }
  if (!t.awal_surat || !t.akhir_surat) return null
  const awal = `${namaSurat(t.awal_surat)} ${t.awal_ayat}`
  const akhir = `${namaSurat(t.akhir_surat)} ${t.akhir_ayat}`
  return awal === akhir ? awal : `${awal} – ${akhir}`
}

const Pil = ({ href, aktif, children }: { href: string; aktif: boolean; children: React.ReactNode }) => (
  <Link
    href={href}
    aria-current={aktif ? 'page' : undefined}
    className={cn(
      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
      aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
    )}
  >
    {children}
  </Link>
)

/**
 * Target bulanan tahsin & tahfidz (0103) — Kumik menetapkan rentang "sesuai
 * target" tiap kelas tiap bulan; kategori lain dihitung dari ambang unit.
 * Koordinator unit membaca target unitnya.
 */
export default async function TargetBulananPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewTargetBulanan(session.role)) redirect('/dashboard')

  const bolehUbah = canKelolaTargetBulanan(session.role)
  const unitBoleh: Jenjang[] = bolehUbah ? UNIT_ORDER : getManageableJenjang(session.role)
  if (unitBoleh.length === 0) redirect('/dashboard')

  const sp = await searchParams
  const unit = (unitBoleh.includes(sp.unit as Jenjang) ? sp.unit : unitBoleh[0]) as Jenjang
  const jenis: JenisTarget = sp.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'
  const daftarKelompok = kelompokTarget(unit, jenis)
  const kelompok = daftarKelompok.find(k => k.kode === sp.kelompok) ?? daftarKelompok[0]

  const hariIni = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const tahunAjaran = tahunAjaranDari(hariIni)
  const [data, tangga, kalender] = await Promise.all([
    getTargetBulanan(tahunAjaran, unit, jenis, kelompok.kode),
    jenis === 'tahsin' ? getTanggaTahsin() : Promise.resolve({} as Awaited<ReturnType<typeof getTanggaTahsin>>),
    getKalenderTahfidz(tahunAjaran),
  ])
  const pekan = new Map(kalender.bulan.map(b => [b.bulan, b]))
  const perSel = new Map(data.baris.map(t => [`${t.bulan}|${t.tingkat}`, t]))
  const bulanIni = hariIni.slice(0, 7)
  const surat = SURAH.map(s => ({ nomor: s.nomor, nama: s.nama }))
  const metodeBeda = !!kelompok.metode && new Set(kelompok.tingkat.map(t => kelompok.metode!(t))).size > 1

  const href = (p: { unit?: string; jenis?: string; kelompok?: string }) => {
    const q = new URLSearchParams({ unit: p.unit ?? unit, jenis: p.jenis ?? jenis })
    if (p.kelompok) q.set('kelompok', p.kelompok)
    return `/target-bulanan?${q}`
  }

  const KATEGORI: { k: KategoriTarget; r: string; w: string }[] = [
    { k: 'jauh_di_bawah', r: `lebih dari ${data.ambang.bawah} hal. di belakang awal`, w: 'bg-destructive-wash text-destructive' },
    { k: 'di_bawah', r: `≤ ${data.ambang.bawah} hal. di belakang awal`, w: 'bg-warning-wash text-warning' },
    { k: 'sesuai', r: 'di dalam rentang', w: 'bg-success-wash text-success' },
    { k: 'melampaui', r: `≤ ${data.ambang.atas} hal. di depan akhir`, w: 'bg-info-wash text-info' },
    { k: 'sangat_melampaui', r: `lebih dari ${data.ambang.atas} hal. di depan akhir`, w: 'bg-primary-wash text-primary' },
  ]

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Target Bulanan" ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <DashTop
          eyebrow={`Kurikulum · Tahun ajaran ${tahunAjaran}`}
          title="Target Bulanan Tahsin & Tahfidz"
          context={<>Rentang posisi yang dianggap <b>sesuai target</b> di akhir tiap bulan, per kelas. Analisis capaian unit mengacu ke sini.</>}
          filters={null}
        />

        <div className="space-y-2">
          {unitBoleh.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Unit">
              {unitBoleh.map(u => <Pil key={u} href={href({ unit: u })} aktif={u === unit}>{JENJANG_LABELS[u]}</Pil>)}
            </div>
          )}
          <div className="flex flex-wrap gap-2" aria-label="Jenis dan kelompok">
            <Pil href={href({ jenis: 'tahsin' })} aktif={jenis === 'tahsin'}>Tahsin</Pil>
            <Pil href={href({ jenis: 'tahfidz' })} aktif={jenis === 'tahfidz'}>Tahfidz</Pil>
            {daftarKelompok.length > 1 && <span className="mx-1 w-px self-stretch bg-border" aria-hidden />}
            {daftarKelompok.length > 1 && daftarKelompok.map(k => (
              <Pil key={k.kode} href={href({ kelompok: k.kode })} aktif={k.kode === kelompok.kode}>{k.label}</Pil>
            ))}
          </div>
        </div>

        {!data.tabelAda ? (
          <p className="rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm">
            Tabel target belum ada. Jalankan <code className="text-xs">drizzle/0103_target_bulanan_PASTE_TO_SUPABASE.sql</code> di Supabase.
          </p>
        ) : (
          <>
            <section className="rounded-2xl border bg-card">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3">
                <h2 className="text-sm font-semibold">
                  {JENJANG_LABELS[unit]}{daftarKelompok.length > 1 ? ` · ${kelompok.label}` : ''} · {jenis === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
                </h2>
                {jenis === 'tahsin' && kelompok.metode && (
                  <p className="text-xs text-muted-foreground">
                    Metode: {[...new Set(kelompok.tingkat.map(t => kelompok.metode!(t)))].join(' / ')}
                  </p>
                )}
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="sticky left-0 z-10 w-28 bg-card px-4 py-2 font-medium">Bulan</th>
                      {kelompok.tingkat.map(t => (
                        <th key={t} className="px-2 py-2 font-medium">
                          {labelTingkat(unit, t)}
                          {metodeBeda && <span className="block font-normal">{kelompok.metode!(t)}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulanTahunAjaran(tahunAjaran).map(b => {
                      const k = pekan.get(b)
                      return (
                        <tr key={b} className={cn('border-b align-top last:border-0', b === bulanIni && 'bg-primary-wash/40')}>
                          <th scope="row" className={cn('sticky left-0 z-10 px-4 py-2 text-left font-medium', b === bulanIni ? 'bg-primary-wash' : 'bg-card')}>
                            {labelBulan(b)}
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              {k ? `Smt ${k.semester} · ${k.pekan} pekan` : '—'}
                            </span>
                          </th>
                          {kelompok.tingkat.map(t => {
                            const sel = perSel.get(`${b}|${t}`)
                            return (
                              <td key={t} className="px-1.5 py-1.5">
                                <SelTarget
                                  teks={teksTarget(sel)}
                                  keterangan={sel?.keterangan ?? ''}
                                  bolehUbah={bolehUbah}
                                  judul={`${labelTingkat(unit, t)} · ${labelBulan(b)}`}
                                  kunci={{ tahun_ajaran: tahunAjaran, bulan: b, jenjang: unit, kelompok: kelompok.kode, tingkat: t }}
                                  jenis={jenis}
                                  tangga={jenis === 'tahsin' && kelompok.metode ? tangga[kelompok.metode(t)] ?? [] : []}
                                  surat={surat}
                                  nilai={{
                                    id: sel?.id ?? null,
                                    awal_tahap: sel?.awal_tahap ?? null, awal_halaman: sel?.awal_halaman ?? null,
                                    akhir_tahap: sel?.akhir_tahap ?? null, akhir_halaman: sel?.akhir_halaman ?? null,
                                    awal_surat: sel?.awal_surat ?? null, awal_ayat: sel?.awal_ayat ?? null,
                                    akhir_surat: sel?.akhir_surat ?? null, akhir_ayat: sel?.akhir_ayat ?? null,
                                    keterangan: sel?.keterangan ?? '',
                                  }}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Kategori kesesuaian target</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Dihitung dari jarak posisi siswa ke rentang bulan itu, dalam halaman. Berlaku untuk seluruh {JENJANG_LABELS[unit]} · {jenis}.
              </p>
              <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-5">
                {KATEGORI.map(x => (
                  <li key={x.k} className={cn('rounded-xl px-3 py-2', x.w)}>
                    <span className="block text-xs font-semibold">{LABEL_KATEGORI[x.k]}</span>
                    <span className="block text-[11px] opacity-90">{x.r}</span>
                  </li>
                ))}
              </ol>
              {bolehUbah && (
                <div className="mt-4 border-t pt-4">
                  <FormAmbang key={`${unit}-${jenis}`} jenjang={unit} jenis={jenis} bawah={data.ambang.bawah} atas={data.ambang.atas} />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
