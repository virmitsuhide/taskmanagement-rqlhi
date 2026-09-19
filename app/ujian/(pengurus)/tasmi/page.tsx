import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpenCheck, Layers, Users, AlertTriangle } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewUjian, getUjianUnits } from '@/lib/auth/permissions'
import { getStatusHafalan, type StatusHafalanSiswa, type ButirUjian } from '@/lib/data/verifikasi-riwayat'
import { labelKewajiban } from '@/lib/rq/hafalan'
import { UNIT_LABELS } from '@/lib/rq/programs'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'
import { DashTop, KpiCard, Panel, Slicer, hrefDengan } from '@/components/dashboard/kit'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; angkatan?: string; jenis?: string; status?: string }>
}

type Jenis = 'semua' | '3_juz' | '5_juz'
type Status = 'semua' | 'sudah' | 'belum'
const PATH = '/ujian/tasmi'
const URUT_JENJANG: Jenjang[] = ['sd', 'sd_juara', 'smp']

const sudah = (b: ButirUjian) => b.status === 'tercatat' || b.status === 'terverifikasi'
const tasmi = (b: ButirUjian, jenis: Jenis) => b.tipe !== '1_juz' && (jenis === 'semua' || b.tipe === jenis)

/**
 * Rekap tasmi' 3 & 5 juz per unit dan angkatan.
 *
 * Tasmi' disimpan sebagai ujian_tahfidz bertipe 3_juz / 5_juz — dari
 * pengajuan biasa, catat riwayat, maupun verifikasi. Selain yang SUDAH, halaman
 * ini juga menghitung yang WAJIB tapi belum tercatat: anak yang hafalannya
 * sudah melewati sebuah blok tanpa catatan tasmi' blok itu.
 */
export default async function RekapTasmiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUjian(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const { siswa: semua } = await getStatusHafalan(getUjianUnits(session.role))

  const jenjangAda = URUT_JENJANG.filter(j => semua.some(s => s.jenjang === j))
  const unit = jenjangAda.includes(sp.unit as Jenjang) ? (sp.unit as Jenjang) : null
  const diUnit = unit ? semua.filter(s => s.jenjang === unit) : semua
  const tingkatAda = [...new Set(diUnit.map(s => s.tingkat).filter((t): t is number => t !== null))].sort((a, b) => a - b)
  const angkatan = tingkatAda.includes(Number(sp.angkatan)) ? Number(sp.angkatan) : null
  const jenis: Jenis = sp.jenis === '3_juz' || sp.jenis === '5_juz' ? sp.jenis : 'semua'
  const status: Status = sp.status === 'sudah' || sp.status === 'belum' ? sp.status : 'semua'

  const cakupan = angkatan ? diUnit.filter(s => s.tingkat === angkatan) : diUnit
  const sudahTasmi = (s: StatusHafalanSiswa, t: '3_juz' | '5_juz') => s.butir.some(b => b.tipe === t && sudah(b))
  const wajibBelum = (s: StatusHafalanSiswa) => s.butir.filter(b => tasmi(b, jenis) && !sudah(b))
  const catatanTasmi = (s: StatusHafalanSiswa) => s.butir.filter(b => tasmi(b, jenis) && sudah(b))

  // Pembagi = siswa yang memang sudah WAJIB tasmi' itu (hafalan ≥3 / ≥5 juz),
  // bukan seluruh siswa — anak kelas 1 yang baru juz 30 bukan 'belum tasmi''.
  const wajib3 = cakupan.filter(s => s.sampaiPosisi >= 3).length
  const wajib5 = cakupan.filter(s => s.sampaiPosisi >= 5).length
  const n3 = cakupan.filter(s => sudahTasmi(s, '3_juz')).length
  const n5 = cakupan.filter(s => sudahTasmi(s, '5_juz')).length
  const nBelum = cakupan.filter(s => wajibBelum(s).length > 0).length
  const nCatatan = cakupan.reduce((n, s) => n + catatanTasmi(s).length, 0)

  const daftar = cakupan
    .filter(s => status === 'sudah' ? catatanTasmi(s).length > 0
      : status === 'belum' ? wajibBelum(s).length > 0
      : catatanTasmi(s).length > 0 || wajibBelum(s).length > 0)
    .sort((a, b) => b.sampaiPosisi - a.sampaiPosisi || a.nama.localeCompare(b.nama))

  // Matriks unit × angkatan — ordinal, jadi urut jenjang lalu tingkat, bukan nilai.
  const baris = URUT_JENJANG.filter(j => !unit || j === unit).flatMap(j => {
    const diJ = semua.filter(s => s.jenjang === j)
    const t = [...new Set(diJ.map(s => s.tingkat))].sort((a, b) => (a ?? 99) - (b ?? 99))
    return t.map(tk => {
      const grup = diJ.filter(s => s.tingkat === tk)
      return {
        jenjang: j, tingkat: tk, siswa: grup.length,
        s3: grup.filter(s => sudahTasmi(s, '3_juz')).length,
        s5: grup.filter(s => sudahTasmi(s, '5_juz')).length,
        belum: grup.filter(s => s.butir.some(b => b.tipe !== '1_juz' && !sudah(b))).length,
      }
    })
  })

  const params = {
    unit: unit ?? undefined, angkatan: angkatan ? String(angkatan) : undefined,
    jenis: jenis === 'semua' ? undefined : jenis, status: status === 'semua' ? undefined : status,
  }
  const href = (g: Record<string, string | undefined>) => hrefDengan(PATH, params, g)
  const namaCakupan = `${unit ? UNIT_LABELS[unit] : 'Semua unit'}${angkatan ? ` · kelas ${angkatan}` : ''}`

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Rekap Tasmi'" showBack ownH1
        breadcrumbs={[{ label: 'Ujian', href: '/ujian/kelola' }, { label: "Rekap Tasmi'" }]} />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <UjianSubNav />

        <DashTop
          eyebrow="Ujian Tahfidz"
          title="Rekap Tasmi' 3 & 5 Juz"
          context={<>{namaCakupan} · {cakupan.length.toLocaleString('id-ID')} siswa aktif</>}
          filters={
            <>
              {jenjangAda.length > 1 && (
                <Slicer label="Unit" options={[
                  { label: 'Semua', href: href({ unit: undefined, angkatan: undefined }), active: !unit },
                  ...jenjangAda.map(j => ({ label: UNIT_LABELS[j], href: href({ unit: j, angkatan: undefined }), active: unit === j })),
                ]} />
              )}
              {tingkatAda.length > 1 && (
                <Slicer label="Angkatan (kelas)" options={[
                  { label: 'Semua', href: href({ angkatan: undefined }), active: !angkatan },
                  ...tingkatAda.map(t => ({ label: String(t), href: href({ angkatan: String(t) }), active: angkatan === t })),
                ]} />
              )}
              <Slicer label="Tasmi'" options={[
                { label: 'Semua', href: href({ jenis: undefined }), active: jenis === 'semua' },
                { label: '3 juz', href: href({ jenis: '3_juz' }), active: jenis === '3_juz' },
                { label: '5 juz', href: href({ jenis: '5_juz' }), active: jenis === '5_juz' },
              ]} />
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={<BookOpenCheck className="h-3.5 w-3.5" />} label="Sudah tasmi' 3 juz" value={n3}
            unit={`/ ${wajib3.toLocaleString('id-ID')}`} ratio={wajib3 ? Math.min(1, n3 / wajib3) : undefined} sub="dari siswa yang hafalannya ≥ 3 juz" />
          <KpiCard icon={<BookOpenCheck className="h-3.5 w-3.5" />} label="Sudah tasmi' 5 juz" value={n5}
            unit={`/ ${wajib5.toLocaleString('id-ID')}`} ratio={wajib5 ? Math.min(1, n5 / wajib5) : undefined} sub="dari siswa yang hafalannya ≥ 5 juz" />
          <KpiCard icon={<Layers className="h-3.5 w-3.5" />} label="Catatan tasmi'" value={nCatatan}
            sub={jenis === 'semua' ? 'seluruh blok, 3 & 5 juz' : `tasmi' ${jenis === '3_juz' ? 3 : 5} juz`} />
          <KpiCard icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Wajib, belum tercatat" value={nBelum}
            sub={<Link href="/ujian/verifikasi" className="text-primary hover:underline">Verifikasi riwayat →</Link>} />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-12">
          <Panel className="lg:col-span-5" title="Per Unit & Angkatan" icon={<Users className="h-4 w-4" />}
            sub="Jumlah siswa yang sudah tasmi'. Klik baris untuk menyaring.">
            {baris.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada siswa aktif.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[340px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-2 font-medium">Angkatan</th>
                      <th className="pb-2 pr-2 text-right font-medium">Siswa</th>
                      <th className="pb-2 pr-2 text-right font-medium">3 juz</th>
                      <th className="pb-2 pr-2 text-right font-medium">5 juz</th>
                      <th className="pb-2 text-right font-medium">Belum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baris.map(r => {
                      const aktif = (!unit || unit === r.jenjang) && angkatan === r.tingkat && r.tingkat !== null
                      return (
                        <tr key={`${r.jenjang}-${r.tingkat}`} className={cn('border-b last:border-0', aktif && 'bg-primary-wash')}>
                          <td className="py-2 pr-2">
                            {r.tingkat !== null ? (
                              <Link href={href({ unit: r.jenjang, angkatan: String(r.tingkat) })} className="hover:underline">
                                <span className="font-medium">{UNIT_LABELS[r.jenjang]}</span> · kelas {r.tingkat}
                              </Link>
                            ) : <span className="text-muted-foreground">{UNIT_LABELS[r.jenjang]} · kelas tak terbaca</span>}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.siswa}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.s3 || <span className="text-muted-foreground">0</span>}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.s5 || <span className="text-muted-foreground">0</span>}</td>
                          <td className={cn('py-2 text-right tabular-nums', r.belum > 0 ? 'font-semibold text-warning' : 'text-muted-foreground')}>{r.belum}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel className="lg:col-span-7" title="Daftar Siswa" icon={<BookOpenCheck className="h-4 w-4" />}
            sub={namaCakupan}>
            <div className="mb-3">
              <Slicer label="Status" options={[
                { label: 'Semua', href: href({ status: undefined }), active: status === 'semua' },
                { label: 'Sudah tasmi\'', href: href({ status: 'sudah' }), active: status === 'sudah' },
                { label: 'Wajib, belum tercatat', href: href({ status: 'belum' }), active: status === 'belum' },
              ]} />
            </div>
            {daftar.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {status === 'belum' ? 'Tidak ada tasmi\' wajib yang belum tercatat.' : 'Belum ada siswa yang tasmi\' di cakupan ini.'}
              </p>
            ) : (
              <ul className="divide-y">
                {daftar.map(s => (
                  <li key={s.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/siswa/${s.id}`} className="truncate text-sm font-medium hover:underline">{s.nama}</Link>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {!unit ? `${s.unitLabel} · ` : ''}{s.kelas ? `Kelas ${s.kelas}` : '—'} · {s.sampaiPosisi} juz
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {catatanTasmi(s).map(b => (
                        <span key={b.juz + b.tipe} className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{ background: 'var(--success-wash)', color: 'var(--success)' }}>
                          ✓ {labelKewajiban(b)}{b.bulanLabel ? ` · ${b.bulanLabel}` : b.status === 'terverifikasi' ? ' · diverifikasi' : ''}
                        </span>
                      ))}
                      {wajibBelum(s).map(b => (
                        <span key={b.juz + b.tipe} className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{ background: 'var(--warning-wash)', color: 'var(--warning)' }}>
                          ! {labelKewajiban(b)} {b.status === 'belum' ? 'belum ujian' : 'belum tercatat'}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
