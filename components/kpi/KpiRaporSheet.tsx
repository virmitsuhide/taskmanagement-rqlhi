import {
  User, IdCard, CalendarDays, Briefcase, Building2, UserCog,
  ThumbsUp, Target, TrendingUp, TrendingDown, Minus, Award,
} from 'lucide-react'
import { KpiRadar, KpiSparkline } from './KpiRadar'
import { UNIT_PENUGASAN_LABELS, ROLE_LABELS } from '@/lib/auth/permissions'
import { MONTH_NAMES } from '@/lib/data/kpi'
import type { KpiRapor } from '@/lib/data/kpi-rapor'

/**
 * Lembar rapor KPI bulanan — satu halaman A4 potret.
 *
 * Komponen server murni. Kelas `kpi-sheet` yang membungkusnya dipakai
 * app/globals.css untuk mempertahankan warna saat dicetak dan mengunci
 * lebarnya ke A4; tanpa kelas itu, blok cetak umum akan memaksa seluruh isinya
 * jadi hitam putih (aturan mode gelap di @media print).
 *
 * Ditulis untuk MUAT DALAM SATU HALAMAN. Setiap penambahan blok baru di sini
 * harus dibayar dengan pengurangan di tempat lain — rapor yang tumpah ke
 * halaman kedua akan tercetak sebagai satu lembar berisi tanda tangan sendirian.
 */

const TONE: Record<number, { teks: string; latar: string; batas: string }> = {
  5: { teks: 'var(--success)', latar: 'var(--success-wash)', batas: 'color-mix(in srgb, var(--success) 35%, transparent)' },
  4: { teks: 'var(--primary)', latar: 'var(--primary-wash)', batas: 'color-mix(in srgb, var(--primary) 35%, transparent)' },
  3: { teks: 'var(--warning)', latar: 'var(--warning-wash)', batas: 'color-mix(in srgb, var(--warning) 35%, transparent)' },
  2: { teks: 'var(--destructive)', latar: 'var(--destructive-wash)', batas: 'color-mix(in srgb, var(--destructive) 35%, transparent)' },
  1: { teks: 'var(--destructive)', latar: 'var(--destructive-wash)', batas: 'color-mix(in srgb, var(--destructive) 35%, transparent)' },
}

function tanggalPanjang(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

export function KpiRaporSheet({ rapor, terbit }: { rapor: KpiRapor; terbit: Date }) {
  const { teacher, hasil, baris, catatan, periode, banding, tren, koordinator } = rapor

  // Unit yang dicetak adalah unit tempat guru DINILAI pada bulan itu (tersimpan
  // di barisnya), bukan unit tempat ia berada sekarang. Rapor Agustus milik
  // guru yang pindah ke SMP pada September tetap harus berbunyi SDIT LHI.
  const unitPenugasan = rapor.entry.unit ?? teacher.unit
  const tone = TONE[hasil.level]

  const trenLabel = tren.map(t => ({ label: MONTH_NAMES[t.month - 1].slice(0, 3), rapot: t.rapot }))
  const bulanLalu = tren.length >= 2 ? tren[tren.length - 2] : null

  return (
    <div className="kpi-sheet mx-auto bg-card text-foreground">
      {/* ── Kepala ─────────────────────────────────────────────── */}
      <header className="kpi-band flex items-center gap-3 rounded-t-lg px-5 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="" className="h-11 w-11 shrink-0 object-contain" />
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[15px] font-bold uppercase leading-tight tracking-wide">
            Rapor KPI Bulanan Guru Qur&apos;an
          </p>
          <p className="text-[10px] opacity-85">Rumah Qur&apos;an LHI · Membumikan Al-Qur&apos;an, Menyemai Peradaban</p>
        </div>
        <span className="kpi-chip shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase">
          {periode.label}
        </span>
      </header>

      <div className="rounded-b-lg border border-t-0 px-4 py-3">
        {/* ── Identitas ────────────────────────────────────────── */}
        <section className="mb-2.5 grid grid-cols-2 gap-x-5 gap-y-1 rounded-md border bg-muted/30 px-3 py-2">
          <Identitas icon={<User />} label="Nama Lengkap" value={teacher.fullName} />
          <Identitas
            icon={<Briefcase />}
            label="Tahun Bergabung"
            value={
              teacher.tahunGabung
                ? `${teacher.tahunGabung}${teacher.masaKerjaTahun !== null ? ` · ${teacher.masaKerjaTahun} tahun` : ''}`
                : '—'
            }
          />
          <Identitas icon={<IdCard />} label="NIP / ID Guru" value={teacher.nip || '—'} />
          <Identitas
            icon={<Building2 />}
            label="Unit Penugasan"
            value={unitPenugasan ? UNIT_PENUGASAN_LABELS[unitPenugasan] : '—'}
          />
          <Identitas icon={<CalendarDays />} label="Periode Rapor" value={periode.label} />
          <Identitas
            icon={<UserCog />}
            label="Koordinator"
            value={koordinator ? koordinator.nama : '—'}
          />
        </section>

        {/* ── Ringkasan ────────────────────────────────────────── */}
        <section className="mb-2.5 grid grid-cols-3 gap-2">
          <Kotak judul="Total Skor KPI Akhir">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-[30px] font-bold leading-none tabular-nums" style={{ color: tone.teks }}>
                {hasil.rapot.toFixed(1)}
              </span>
              <span className="text-[11px] text-muted-foreground">/100</span>
            </div>
            <p className="mt-0.5 text-[11px] font-bold uppercase" style={{ color: tone.teks }}>
              {hasil.predikat}
            </p>
            <p className="text-[9px] tracking-[0.2em]" style={{ color: tone.teks }} aria-hidden>
              {'★'.repeat(hasil.level)}
              <span className="opacity-25">{'★'.repeat(5 - hasil.level)}</span>
            </p>
            <p className="sr-only">Level {hasil.level} dari 5</p>
          </Kotak>

          <Kotak judul="Perbandingan Periode">
            {banding.selisih === null ? (
              <p className="pt-3 text-[10px] italic text-muted-foreground">
                Belum ada nilai bulan sebelumnya sebagai pembanding.
              </p>
            ) : (
              <>
                <p
                  className="flex items-center justify-center gap-1 text-[17px] font-bold leading-none tabular-nums"
                  style={{
                    color: banding.arah === 'naik' ? 'var(--success)'
                      : banding.arah === 'turun' ? 'var(--destructive)'
                      : 'var(--muted-foreground)',
                  }}
                >
                  {banding.arah === 'naik' ? <TrendingUp className="h-4 w-4" />
                    : banding.arah === 'turun' ? <TrendingDown className="h-4 w-4" />
                    : <Minus className="h-4 w-4" />}
                  {banding.selisih > 0 ? '+' : ''}{banding.selisih.toFixed(1)}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  dibanding {bulanLalu ? MONTH_NAMES[bulanLalu.month - 1] : '—'}
                </p>
              </>
            )}
            <div className="mt-1 flex justify-center">
              <KpiSparkline titik={trenLabel} />
            </div>
          </Kotak>

          <Kotak judul="Predikat / Status">
            <Award className="mx-auto h-7 w-7" style={{ color: tone.teks }} />
            <p className="mt-1 text-[12px] font-bold uppercase leading-tight" style={{ color: tone.teks }}>
              {hasil.level >= 5 ? 'Apresiasi Guru Teladan'
                : hasil.level === 4 ? 'Kinerja Baik'
                : hasil.level === 3 ? 'Perlu Pendampingan'
                : 'Perlu Pembinaan'}
            </p>
            <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{hasil.tindakLanjut}</p>
          </Kotak>
        </section>

        {/* ── Radar & tabel ────────────────────────────────────── */}
        <section className="mb-2.5 grid grid-cols-[300px_1fr] gap-2">
          <div className="rounded-md border">
            <p className="kpi-subhead rounded-t-[5px] px-2 py-1 text-center text-[10px] font-semibold uppercase">
              Grafik Radar · 11 Indikator
            </p>
            <div className="px-1 py-1">
              <KpiRadar baris={baris} size={294} />
            </div>
            <p className="border-t px-2 py-1 text-center text-[8px] text-muted-foreground">
              Skala 0–100 per indikator · lingkaran terluar = 100
            </p>
          </div>

          <div className="overflow-hidden rounded-md border">
            <p className="kpi-subhead px-2 py-1 text-center text-[10px] font-semibold uppercase">
              Tabel Detail Indikator KPI
            </p>
            <table className="kpi-table w-full border-collapse text-[8.5px]">
              <thead>
                <tr className="bg-muted/50">
                  <th className="w-5 border-b px-1 py-1 text-center font-semibold">No</th>
                  <th className="border-b px-1.5 py-1 text-left font-semibold">Indikator</th>
                  <th className="border-b px-1 py-1 text-left font-semibold">Target</th>
                  <th className="border-b px-1 py-1 text-left font-semibold">Capaian Riil</th>
                  <th className="w-9 border-b px-1 py-1 text-center font-semibold">Nilai</th>
                  <th className="w-6 border-b px-1 py-1 text-center font-semibold">Lv</th>
                  <th className="border-b px-1 py-1 text-center font-semibold">Ket.</th>
                </tr>
              </thead>
              <tbody>
                {baris.map(b => {
                  const t = TONE[b.level]
                  return (
                    <tr key={b.no} className="border-b last:border-b-0">
                      <td className="px-1 py-[3px] text-center tabular-nums text-muted-foreground">{b.no}</td>
                      <td className="px-1.5 py-[3px] leading-tight">{b.nama}</td>
                      <td className="px-1 py-[3px] leading-tight text-muted-foreground">{b.target}</td>
                      <td className="px-1 py-[3px] leading-tight">{b.capaian}</td>
                      <td className="px-1 py-[3px] text-center font-semibold tabular-nums">{b.nilai}</td>
                      <td className="px-1 py-[3px] text-center tabular-nums">{b.level}</td>
                      <td className="px-1 py-[3px] text-center">
                        <span
                          className="inline-block whitespace-nowrap rounded px-1 py-[1px] font-medium"
                          style={{ color: t.teks, background: t.latar }}
                        >
                          {b.predikat}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-1 py-1 text-center" colSpan={4}>
                    <span className="float-left pl-0.5">TOTAL · Nilai Rapot = total ÷ 11</span>
                  </td>
                  <td className="px-1 py-1 text-center tabular-nums">{hasil.rapot.toFixed(1)}</td>
                  <td className="px-1 py-1 text-center tabular-nums">{hasil.level}</td>
                  <td className="px-1 py-1 text-center" style={{ color: tone.teks }}>{hasil.predikat}</td>
                </tr>
              </tbody>
            </table>
            <p className="border-t px-2 py-1 text-[8px] leading-snug text-muted-foreground">
              Kesebelas indikator berbobot sama — Nilai Rapot adalah rata-ratanya
              (total {hasil.total.toFixed(1)} ÷ 11). Level 1–5 memakai ambang yang sama
              dengan predikat akhir.
            </p>
          </div>
        </section>

        {/* ── Apresiasi & pengembangan ─────────────────────────── */}
        <section className="mb-2.5 grid grid-cols-2 gap-2">
          <Catatan
            icon={<ThumbsUp className="h-3.5 w-3.5" />}
            judul="Apresiasi & Catatan Positif"
            warna="var(--success)"
            latar="var(--success-wash)"
            items={catatan.apresiasi}
          />
          <Catatan
            icon={<Target className="h-3.5 w-3.5" />}
            judul="Area Pengembangan (Action Plan)"
            warna="var(--warning)"
            latar="var(--warning-wash)"
            items={catatan.pengembangan}
            bernomor
          />
        </section>

        {/* ── Pengesahan ───────────────────────────────────────── */}
        <section className="grid grid-cols-3 items-end gap-3 border-t pt-2.5">
          <div>
            <p className="text-[9px] text-muted-foreground">Tanggal Penerbitan Rapor</p>
            <p className="text-[11px] font-semibold">{tanggalPanjang(terbit)}</p>
            <p className="mt-1.5 rounded border-l-2 pl-2 text-[8.5px] italic leading-snug text-muted-foreground"
              style={{ borderColor: 'var(--primary)' }}>
              &ldquo;Teruslah berproses menjadi pribadi yang lebih baik setiap hari untuk
              membentuk generasi Qur&apos;ani.&rdquo;
            </p>
          </div>

          <TandaTangan
            peran={koordinator ? ROLE_LABELS[koordinator.role] : 'Koordinator Unit'}
            nama={koordinator?.nama ?? '.........................'}
            keterangan={unitPenugasan ? UNIT_PENUGASAN_LABELS[unitPenugasan] : undefined}
          />
          <TandaTangan
            peran="Guru Qur'an"
            nama={teacher.fullName}
            keterangan={teacher.nip ? `NIP. ${teacher.nip}` : undefined}
            catatan="Telah menerima & me-review hasil KPI"
          />
        </section>
      </div>
    </div>
  )
}

function Identitas({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="shrink-0 text-muted-foreground [&>svg]:h-3 [&>svg]:w-3">{icon}</span>
      <span className="w-[92px] shrink-0 text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">:</span>
      <span className="min-w-0 flex-1 truncate font-semibold" title={value}>{value}</span>
    </div>
  )
}

function Kotak({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border text-center">
      <p className="kpi-subhead px-2 py-1 text-[9.5px] font-semibold uppercase">{judul}</p>
      <div className="px-2 py-1.5">{children}</div>
    </div>
  )
}

function Catatan({
  icon, judul, warna, latar, items, bernomor,
}: {
  icon: React.ReactNode
  judul: string
  warna: string
  latar: string
  items: string[]
  bernomor?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-md border" style={{ borderColor: `color-mix(in srgb, ${warna} 35%, transparent)` }}>
      <p
        className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase"
        style={{ color: warna, background: latar }}
      >
        {icon}{judul}
      </p>
      <ol className="space-y-1 px-2 py-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-1.5 text-[8.5px] leading-snug">
            <span
              className="mt-[1px] flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[7px] font-bold"
              style={{ color: warna, background: latar }}
            >
              {bernomor ? i + 1 : '✓'}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function TandaTangan({
  peran, nama, keterangan, catatan,
}: {
  peran: string
  nama: string
  keterangan?: string
  catatan?: string
}) {
  return (
    <div className="text-center">
      <p className="text-[9.5px] font-semibold">{peran},</p>
      {/* Ruang tanda tangan basah — rapor ini dicetak untuk ditandatangani. */}
      <div className="h-11" />
      <p className="border-t pt-1 text-[10px] font-bold">{nama}</p>
      {keterangan && <p className="text-[8.5px] text-muted-foreground">{keterangan}</p>}
      {catatan && <p className="text-[7.5px] italic text-muted-foreground">({catatan})</p>}
    </div>
  )
}
