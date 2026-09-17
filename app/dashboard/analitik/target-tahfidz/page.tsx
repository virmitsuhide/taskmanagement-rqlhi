import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Target, UserCheck, Users } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import {
  canEditKalenderTahfidz, canTandaiAsalSdLhi, canViewUnitAnalytics, getAnalyticsJenjang,
} from '@/lib/auth/permissions'
import { getTabelTargetBulanan, getTargetTahfidz, type RingkasStatus, type SiswaTarget, type StatusSiswa } from '@/lib/data/target-tahfidz'
import { LABEL_ALASAN, RENCANA, TOLERANSI_PEKAN, URUTAN_RENCANA, type AlasanTanpaTarget, type KodeRencana } from '@/lib/rq/target-tahfidz'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KalenderPekanForm } from '@/components/dashboard/target-tahfidz/KalenderPekanForm'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ rencana?: string; kelas?: string }>
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const bulanTeks = (kunci: string) => `${BULAN[Number(kunci.slice(5, 7)) - 1]} ${kunci.slice(0, 4)}`
const tanggalTeks = (iso: string) => `${Number(iso.slice(8, 10))} ${bulanTeks(iso)}`

/** Unit yang harus ada di lingkup supaya sebuah rencana boleh dibuka. */
const UNIT_RENCANA: Record<KodeRencana, Jenjang[]> = {
  sd_clil: ['sd'],
  sd_quls: ['sd', 'sd_juara'],
  smp_internal: ['smp'],
  smp_eksternal: ['smp'],
}

const STATUS: { kunci: StatusSiswa; label: string; warna: string; wash: string }[] = [
  { kunci: 'di_bawah', label: 'Di bawah', warna: 'var(--destructive)', wash: 'var(--destructive-wash)' },
  { kunci: 'sesuai', label: 'Sesuai', warna: 'var(--success)', wash: 'var(--success-wash)' },
  { kunci: 'di_atas', label: 'Di atas', warna: 'var(--info)', wash: 'var(--info-wash)' },
  { kunci: 'belum_terukur', label: 'Belum terukur', warna: 'var(--muted-foreground)', wash: 'var(--muted)' },
]

export default async function TargetTahfidzPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  const scope = getAnalyticsJenjang(session.role)
  const params = await searchParams
  const rencanaBoleh = URUTAN_RENCANA.filter(k => UNIT_RENCANA[k].some(j => scope.includes(j)))
  const kode = rencanaBoleh.find(k => k === params.rencana) ?? rencanaBoleh[0]

  const data = await getTargetTahfidz(scope)
  if (!kode) {
    return (
      <div>
        <DashboardHeader displayName={session.displayName} role={session.role} title="Target Tahfidz" showBack />
        <p className="p-6 text-sm text-muted-foreground">Belum ada rencana target tahfidz untuk unit Anda.</p>
      </div>
    )
  }

  const tingkatList = RENCANA[kode].tingkat.map(t => t.tingkat)
  const tingkat = tingkatList.find(t => String(t) === params.kelas) ?? tingkatList[0]
  const tabel = await getTabelTargetBulanan(kode, tingkat, data.kalender.bulan)
  const bulanIni = data.tanggal.slice(0, 7)

  const siswaKelas = urutkanSiswa(data.siswa.filter(s => s.rencana === kode && s.tingkat === tingkat))
  const tanpaTarget = hitungAlasan(data.siswa)
  const smpDalamLingkup = scope.includes('smp')
  const jumlahInternal = data.siswa.filter(s => s.jenjang === 'smp' && s.asalSdLhi).length
  const href = (k: KodeRencana, t?: number) => `?rencana=${k}${t ? `&kelas=${t}` : ''}`

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Target Tahfidz" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Target Tahfidz · TA {data.kalender.tahunAjaran}</p>
          <h1 className="text-2xl font-bold leading-tight">Target Tahfidz Bulanan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Posisi per {tanggalTeks(data.tanggal)} · semester {data.progres.semester === 1 ? 'ganjil' : 'genap'},{' '}
            {Math.round(data.progres.fraksi * 100)}% pekan efektif sudah lewat
          </p>
        </div>

        {(data.kalender.sumber === 'bawaan' || !data.kolomAsalAda) && (
          <div className="rounded-xl border p-4 flex gap-3 text-sm" style={{ background: 'var(--warning-wash)' }}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
            <div className="space-y-1">
              {data.kalender.sumber === 'bawaan' && (
                <p>Kalender pekan efektif masih <strong>perkiraan</strong> — target di halaman ini ikut perkiraan sampai kalendernya disimpan di bawah.</p>
              )}
              {!data.kolomAsalAda && (
                <p>Migrasi 0070 belum dijalankan: semua siswa SMP sementara dihitung dengan target <strong>eksternal</strong>.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Posisi hari ini ─────────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Posisi Siswa vs Target Hari Ini</h2>
          <p className="text-xs text-muted-foreground mt-0.5 mb-4">
            &quot;Sesuai&quot; = selisih paling jauh {TOLERANSI_PEKAN} pekan materi dari target. Terukur dari setoran ziyadah &amp; ujian yang tercatat di sistem.
          </p>

          {data.perRencana.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada siswa yang masuk rencana target mana pun.</p>
          ) : (
            <div className="space-y-5">
              {data.perRencana.map(r => {
                const terukur = r.ringkas.total - r.ringkas.belum_terukur
                return (
                  <div key={r.kode}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-1.5">
                      <Link href={href(r.kode)} className="text-sm font-medium hover:underline">{RENCANA[r.kode].label}</Link>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        terukur {terukur.toLocaleString('id-ID')} dari {r.ringkas.total.toLocaleString('id-ID')} siswa
                        {r.ringkas.perluDiujikan > 0 && ` · ${r.ringkas.perluDiujikan} perlu diujikan`}
                      </span>
                    </div>
                    <BarStatus ringkas={r.ringkas} />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.perTingkat.filter(t => t.ringkas.total > 0).map(t => (
                        <Link
                          key={t.tingkat}
                          href={href(r.kode, t.tingkat)}
                          className="rounded-full border px-2.5 py-1 text-[11px] hover:bg-muted/40 transition-colors tabular-nums"
                        >
                          Kelas {t.tingkat}
                          <span className="text-muted-foreground">
                            {' · '}{t.ringkas.di_bawah} bawah · {t.ringkas.sesuai} sesuai · {t.ringkas.di_atas} atas
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tanpaTarget.length > 0 && (
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Tidak dibandingkan dengan target: {tanpaTarget.map(([alasan, n]) => `${LABEL_ALASAN[alasan]} (${n} siswa)`).join(' · ')}.
            </p>
          )}
        </section>

        {/* ── Target akhir bulan ──────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Target Akhir Bulan</h2>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Sampai mana hafalan semestinya di akhir tiap bulan, bila anak mengikuti rencana sejak kelas pertama programnya.
          </p>

          <div className="flex gap-1.5 flex-wrap mb-2">
            {rencanaBoleh.map(k => (
              <Chip key={k} href={href(k)} aktif={k === kode}>{RENCANA[k].label}</Chip>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {tingkatList.map(t => (
              <Chip key={t} href={href(kode, t)} aktif={t === tingkat} kecil>Kelas {t}</Chip>
            ))}
          </div>

          {!tabel ? (
            <p className="text-sm text-muted-foreground">Rencana untuk kelas ini tidak ditemukan.</p>
          ) : (
            <>
              <p className="text-xs mb-3">
                <span className="text-muted-foreground">{RENCANA[kode].keterangan}. Kelas {tingkat}: </span>
                {tabel.halamanSetahun > 0
                  ? <>{tabel.awalTeks} → {tabel.akhirTeks} · <span className="tabular-nums">{tabel.halamanSetahun.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</span> halaman setahun</>
                  : 'murojaah penuh, tanpa hafalan baru — target: tuntas juz rencana & diujikan'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[460px]">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Akhir bulan</th>
                      <th className="py-2 px-2 text-right font-medium">Pekan efektif</th>
                      <th className="py-2 px-2 font-medium">Target sampai</th>
                      <th className="py-2 pl-2 font-medium w-[30%]">Materi setahun</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabel.baris.map((b, i) => {
                      const aktif = b.bulan === bulanIni
                      const awalSemester = i > 0 && tabel.baris[i - 1].semester !== b.semester
                      return (
                        <tr key={b.bulan} className={cn('border-b last:border-0', awalSemester && 'border-t-2')} style={aktif ? { background: 'var(--primary-wash)' } : undefined}>
                          <td className="py-2 pr-2 whitespace-nowrap">
                            {bulanTeks(b.bulan)}
                            {aktif && <span className="ml-1.5 text-[10px] font-semibold" style={{ color: 'var(--primary)' }}>BULAN INI</span>}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                            {b.pekanEfektif.toLocaleString('id-ID')} <span className="text-[11px]">(Σ {b.pekanKumulatif.toLocaleString('id-ID')})</span>
                          </td>
                          <td className={cn('py-2 px-2 font-medium', b.jenis === 'murojaah' && 'text-muted-foreground font-normal')}>{b.targetTeks}</td>
                          <td className="py-2 pl-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.round(b.persenTahun * 100)}%`, background: 'var(--primary)' }} />
                              </div>
                              <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">{Math.round(b.persenTahun * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* ── Siswa di kelas terpilih ─────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Siswa {RENCANA[kode].label} · Kelas {tingkat}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Diurutkan dari yang paling tertinggal. Selisih dalam pekan materi; positif berarti mendahului target.
          </p>
          {siswaKelas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada siswa aktif di kelas ini.</p>
          ) : (
            <ul className="divide-y">
              {siswaKelas.map(s => <BarisSiswa key={s.id} s={s} />)}
            </ul>
          )}
        </section>

        {smpDalamLingkup && canTandaiAsalSdLhi(session.role) && (
          <Link
            href="/dashboard/analitik/target-tahfidz/asal-siswa"
            className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
                <UserCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Tandai Siswa SMP Lulusan SD LHI →</p>
                <p className="text-xs text-muted-foreground">
                  {jumlahInternal} siswa bertarget internal · sisanya memakai target eksternal
                </p>
              </div>
            </div>
          </Link>
        )}

        <KalenderPekanForm
          key={data.kalender.bulan.map(b => b.pekan).join('|')}
          tahunAjaran={data.kalender.tahunAjaran}
          bulan={data.kalender.bulan}
          sumber={data.kalender.sumber}
          tabelAda={data.kalender.tabelAda}
          bisaUbah={canEditKalenderTahfidz(session.role)}
        />
      </div>
    </div>
  )
}

function BarStatus({ ringkas }: { ringkas: RingkasStatus }) {
  const total = ringkas.total - ringkas.tanpa_target
  if (total === 0) return null
  return (
    <>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted" role="img"
        aria-label={STATUS.map(s => `${ringkas[s.kunci]} ${s.label.toLowerCase()}`).join(', ')}>
        {STATUS.map(s => ringkas[s.kunci] > 0 && (
          <div key={s.kunci} style={{ width: `${(ringkas[s.kunci] / total) * 100}%`, background: s.kunci === 'belum_terukur' ? 'transparent' : s.warna }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {STATUS.map(s => (
          <span key={s.kunci} className="rounded-full px-2 py-0.5 text-[11px] tabular-nums" style={{ background: s.wash, color: s.warna }}>
            {ringkas[s.kunci].toLocaleString('id-ID')} {s.label.toLowerCase()}
          </span>
        ))}
      </div>
    </>
  )
}

function BarisSiswa({ s }: { s: SiswaTarget }) {
  const st = STATUS.find(x => x.kunci === s.status)
  return (
    <li className="py-2.5 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <Link href={`/siswa/${s.id}`} className="text-sm font-medium hover:underline">{s.nama}</Link>
        <p className="text-[11px] text-muted-foreground">
          {s.kelas ? `Kelas ${s.kelas}` : 'Tanpa kelas'}{s.halaqoh && ` · ${s.halaqoh}`}
        </p>
        <p className="text-xs mt-0.5">
          <span className="text-muted-foreground">Capaian:</span> {s.capaianTeks ?? 'belum ada setoran/ujian tercatat'}
          {s.sumberCapaian === 'juz' && (
            <span className="text-muted-foreground" title="Hanya dari juz yang sudah tuntas/diujikan — hafalan sesudahnya belum tercatat sebagai setoran.">
              {' '}(dari ujian, minimal)
            </span>
          )}
          <span className="text-muted-foreground"> · Target:</span> {s.targetTeks}
        </p>
        {s.tindakLanjut && <p className="text-xs mt-0.5" style={{ color: 'var(--warning)' }}>{s.tindakLanjut}</p>}
      </div>
      <div className="text-right shrink-0">
        {st && (
          <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: st.wash, color: st.warna }}>
            {st.label}
          </span>
        )}
        {s.selisihPekan !== null && s.selisihHalaman !== null && (
          <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
            <SelisihTeks pekan={s.selisihPekan} halaman={s.selisihHalaman} />
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Jarak pendek dibaca dalam pekan ("−1,5 pekan"), jarak jauh dalam halaman.
 * "−88 pekan" benar secara hitungan tapi tidak bisa dibayangkan siapa pun;
 * "−53 halaman" langsung terbayang sebagai dua setengah juz.
 */
function SelisihTeks({ pekan, halaman }: { pekan: number; halaman: number }) {
  const tanda = (n: number) => (n > 0 ? '+' : '')
  if (Math.abs(pekan) <= 12) return <>{tanda(pekan)}{pekan.toLocaleString('id-ID', { maximumFractionDigits: 1 })} pekan</>
  return <>{tanda(halaman)}{Math.round(halaman).toLocaleString('id-ID')} halaman</>
}

function Chip({ href, aktif, kecil, children }: { href: string; aktif: boolean; kecil?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={aktif ? 'page' : undefined}
      className={cn(
        'rounded-full font-medium border transition-colors',
        kecil ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        aktif ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground border-border',
      )}
    >
      {children}
    </Link>
  )
}

const URUTAN_STATUS: Record<StatusSiswa, number> = { di_bawah: 0, sesuai: 1, di_atas: 2, belum_terukur: 3, tanpa_target: 4 }

function urutkanSiswa(siswa: SiswaTarget[]): SiswaTarget[] {
  return [...siswa].sort((a, b) =>
    URUTAN_STATUS[a.status] - URUTAN_STATUS[b.status]
    || (a.selisihPekan ?? 0) - (b.selisihPekan ?? 0)
    || a.nama.localeCompare(b.nama))
}

function hitungAlasan(siswa: SiswaTarget[]): [AlasanTanpaTarget, number][] {
  const peta = new Map<AlasanTanpaTarget, number>()
  for (const s of siswa) if (s.alasan) peta.set(s.alasan, (peta.get(s.alasan) ?? 0) + 1)
  return [...peta]
}
