import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, GraduationCap, ShieldCheck, Users } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageGukar, canViewGukarRecap } from '@/lib/auth/permissions'
import { getCurrentTerm, formatTerm } from '@/lib/data/terms'
import { getKesiapanGukar, type KesiapanPeserta, type RingkasKesiapan } from '@/lib/data/gukar-standar'
import { LABEL_STATUS_PEGAWAI, STANDAR_PERAN } from '@/lib/rq/gukar-standar'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { GukarStandarTable } from '@/components/gukar/GukarStandarTable'
import { currentPeriod, formatPeriod, isValidPeriod } from '@/lib/finance/period'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

/**
 * Kesiapan Standar Kepegawaian — bentuk Laporan Eksekutif SDM Juni 2026.
 *
 * Halaman ini menjawab pertanyaan kepegawaian, bukan pertanyaan program:
 * berapa GuKar yang sudah menyentuh ambang "Lulus UMMI Jilid 6", berapa yang
 * sudah menuntaskan satu juz, dan berapa yang memenuhi keduanya. Kehadiran
 * dan keberjalanan halaqoh tetap di /dashboard/analitik/gukar.
 *
 * Aksesnya sama dengan analitik gukar: SDM sebagai pemilik program, Kepala RQ
 * karena laporan bulanan ke BPH memuatnya. Penetapan status kepegawaian hanya
 * untuk yang berwenang mengelola (canManageGukar).
 */
export default async function GukarStandarPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewGukarRecap(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const term = await getCurrentTerm()
  const data = term
    ? await getKesiapanGukar(term.id, period)
    : null

  const dapatMenyunting = canManageGukar(session.role)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Kesiapan Standar Kepegawaian"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">
              Mentoring Qur&apos;an Guru &amp; Karyawan
            </p>
            <h1 className="text-2xl font-bold leading-tight">Kesiapan Standar Kepegawaian</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {term ? formatTerm(term) : 'Belum ada semester berjalan'} · capaian terakhir s.d.{' '}
              {formatPeriod(period)}
              {' · '}
              <Link href="/dashboard/analitik/gukar" className="text-primary hover:underline">
                ← Kehadiran &amp; keberjalanan
              </Link>
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        {!data || data.peserta.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            {!term
              ? 'Belum ada semester berjalan. Tetapkan dulu di panel Tahun Ajaran.'
              : 'Belum ada peserta pembinaan pada semester ini.'}
          </p>
        ) : (
          <>
            {/* ── 01 Ringkasan eksekutif ───────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi
                icon={<Users className="h-4 w-4" />}
                nilai={String(data.ringkas.total)}
                label="GuKar termonitor"
                hint={`${data.perUnit.length} unit · ${data.perKelompok.length} kelompok`}
              />
              <Kpi
                icon={<GraduationCap className="h-4 w-4" />}
                nilai={String(data.ringkas.terdata)}
                label="Terdata capaian"
                hint={`${data.ringkas.persenTerdata}% cakupan`}
              />
              <Kpi
                icon={<ShieldCheck className="h-4 w-4" />}
                nilai={String(data.ringkas.tahsinAmbang)}
                label="Tahsin ≥ ambang Jilid 6"
                hint={persenDari(data.ringkas.tahsinAmbang, data.ringkas.terdata, 'dari terdata')}
              />
              <Kpi
                icon={<ShieldCheck className="h-4 w-4" />}
                nilai={String(data.ringkas.inti)}
                label="Memenuhi inti baseline"
                hint={persenDari(data.ringkas.inti, data.ringkas.terdata, 'tahsin + tahfidz')}
              />
            </div>

            {data.kelompokTanpaData.length > 0 && (
              <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                <div className="text-sm">
                  <p className="font-medium text-warning">
                    {data.kelompokTanpaData.length} kelompok belum punya catatan capaian sama sekali
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {data.kelompokTanpaData
                      .map(k => `${k.pengampu} (${k.total} orang)`)
                      .join(', ')}
                    {' — jadi prioritas pendataan agar masuk laporan berikutnya.'}
                  </p>
                </div>
              </div>
            )}

            {/* ── 03 Cakupan & partisipasi per unit ────────────────── */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Cakupan &amp; Partisipasi per Unit</h2>
              <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
                Jumlah peserta dan kelengkapan data tiap unit.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Unit</th>
                      <th className="py-2 px-2 text-right font-medium">Total</th>
                      <th className="py-2 px-2 text-right font-medium">Terdata</th>
                      <th className="py-2 px-2 text-right font-medium">%</th>
                      <th className="py-2 pl-2 font-medium">Kelompok pengampu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perUnit.map(u => (
                      <tr key={u.unit} className="border-b last:border-0">
                        <td className="py-2 pr-2 font-medium">{u.unit}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{u.total}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{u.terdata}</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          <span className={u.persenTerdata >= 100 ? 'text-success' : 'text-warning'}>
                            {u.persenTerdata}%
                          </span>
                        </td>
                        <td className="py-2 pl-2 text-xs text-muted-foreground">
                          {[...new Set(u.kelompok)].join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <td className="py-2 pr-2">TOTAL</td>
                      <td className="py-2 px-2 text-right tabular-nums">{data.ringkas.total}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{data.ringkas.terdata}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{data.ringkas.persenTerdata}%</td>
                      <td className="py-2 pl-2 text-xs text-muted-foreground">
                        {data.perKelompok.length} kelompok aktif
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 05.1 & 05.2 Sebaran capaian ──────────────────────── */}
            <div className="grid gap-4 md:grid-cols-2">
              <Sebaran
                judul="Sebaran Tahap Tahsin"
                keterangan={`n = ${data.ringkas.terdata} yang terdata`}
                baris={data.sebaranTahsin.map(s => ({
                  label: s.label,
                  jumlah: s.jumlah,
                  memenuhi: s.kategori === 'lanjut' || s.kategori === 'jilid_6',
                }))}
                total={data.ringkas.terdata}
              />
              <Sebaran
                judul="Sebaran Capaian Tahfidz"
                keterangan={`n = ${data.ringkas.terdata} yang terdata`}
                baris={data.sebaranTahfidz.map(s => ({
                  label: s.label,
                  jumlah: s.jumlah,
                  memenuhi: s.kategori === 'min_1_juz',
                }))}
                total={data.ringkas.terdata}
              />
            </div>

            {/* ── 05.3 Corong kesiapan ─────────────────────────────── */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Corong Kesiapan terhadap Baseline Inti</h2>
              <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
                Penyusutan dari populasi termonitor sampai yang memenuhi kedua syarat inti
                (tahsin ≥ Jilid 6 <span className="font-medium">dan</span> tahfidz ≥ 1 juz).
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Termonitor', nilai: data.ringkas.total },
                  { label: 'Terdata capaian', nilai: data.ringkas.terdata },
                  { label: 'Tahsin ≥ ambang Jilid 6', nilai: data.ringkas.tahsinAmbang },
                  { label: 'Tahfidz ≥ 1 juz', nilai: data.ringkas.tahfidz1Juz },
                  { label: 'Memenuhi keduanya', nilai: data.ringkas.inti },
                ].map(langkah => (
                  <div key={langkah.label} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 text-xs">{langkah.label}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full rounded bg-primary/70"
                        style={{ width: `${lebar(langkah.nilai, data.ringkas.total)}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {langkah.nilai} · {lebar(langkah.nilai, data.ringkas.total)}%
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── 08 Lampiran: rekap per kelompok pengampu ─────────── */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Rekap Kesiapan per Kelompok Pengampu</h2>
              <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
                &quot;Inti&quot; = memenuhi ambang tahsin sekaligus tahfidz ≥ 1 juz.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Unit</th>
                      <th className="py-2 px-2 font-medium">Pengampu</th>
                      <th className="py-2 px-2 text-right font-medium">n</th>
                      <th className="py-2 px-2 text-right font-medium">Terdata</th>
                      <th className="py-2 px-2 text-right font-medium">Tahsin ≥ J6</th>
                      <th className="py-2 px-2 text-right font-medium">Tahfidz ≥ 1 juz</th>
                      <th className="py-2 pl-2 text-right font-medium">Inti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perKelompok.map(k => (
                      <tr key={k.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 text-xs text-muted-foreground">{k.unit}</td>
                        <td className="py-2 px-2">{k.pengampu}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{k.total}</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {k.terdata === 0
                            ? <span className="text-warning">0</span>
                            : k.terdata}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{k.tahsinAmbang}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{k.tahfidz1Juz}</td>
                        <td className="py-2 pl-2 text-right tabular-nums font-medium">{k.inti}</td>
                      </tr>
                    ))}
                    <BarisTotal ringkas={data.ringkas} kolom={data.perKelompok.length} />
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 06 Kelompok fokus & tindak lanjut ────────────────── */}
            <Fokus
              judul="Calon Pegawai Tetap"
              keterangan="Difokuskan agar memenuhi ambang sebelum batas berkas kepegawaian."
              kosong="Belum ada peserta yang ditandai sebagai calon pegawai tetap. Tandai lewat kolom Kepegawaian di daftar bawah."
              peserta={data.peserta.filter(p => p.statusPegawai === 'calon_tetap')}
            />
            <Fokus
              judul="Pegawai Tetap yang Belum Memenuhi Standar"
              keterangan="Perlu pendampingan intensif agar sesuai standar pemeliharaan kompetensi."
              kosong="Tidak ada pegawai tetap yang tercatat di bawah standar."
              peserta={data.peserta.filter(p => p.statusPegawai === 'tetap' && !p.status.memenuhi)}
            />

            {/* ── 04 Acuan standar kepegawaian ─────────────────────── */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Acuan Standar Kepegawaian</h2>
              <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
                Syarat minimal Al-Qur&apos;an per kategori peran — Peraturan Kepegawaian Yayasan
                Pionir Pendidikan Indonesia, SOP Pengajuan Pegawai Tetap 2025.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Kategori peran</th>
                      <th className="py-2 px-2 font-medium">Tahsin (min.)</th>
                      <th className="py-2 px-2 font-medium">Tahfidz (min.)</th>
                      <th className="py-2 pl-2 font-medium">B. Inggris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STANDAR_PERAN.map(s => (
                      <tr key={s.key} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-2">{s.label}</td>
                        <td className="py-2 px-2 text-muted-foreground">{s.tahsin}</td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {s.minJuz} juz, nilai ≥ {s.nilaiMin}
                          {s.suratPilihan > 0 && ` + ${s.suratPilihan} surat pilihan`}
                          {s.catatan && (
                            <span className="block text-xs opacity-80">{s.catatan}</span>
                          )}
                        </td>
                        <td className="py-2 pl-2 text-muted-foreground">{s.bahasaInggris}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Predikat hafalan: Mumtaz (95–100), Jayyid Jiddan (85–94), Jayyid (70–84),
                Maqbul (60–69). Peserta yang kategori perannya belum ditetapkan dibandingkan
                terhadap ambang inti (Jilid 6 + 1 juz), sama seperti Laporan Eksekutif SDM.
              </p>
            </section>

            {/* ── Rincian & penetapan status ───────────────────────── */}
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Rincian Seluruh Peserta</h2>
                <p className="text-xs text-muted-foreground">
                  {dapatMenyunting
                    ? 'Tetapkan status kepegawaian dan kategori peran di sini — dua kolom itu yang menentukan ambang pembanding tiap orang.'
                    : 'Status kepegawaian ditetapkan oleh SDM.'}
                </p>
              </div>
              <GukarStandarTable peserta={data.peserta} dapatMenyunting={dapatMenyunting} />
            </section>

            <section className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">Metodologi &amp; keterbatasan data</p>
              <p>
                Dipakai capaian terakhir yang tercatat tiap orang, bukan rata-rata bulanan.
                Bila pengampu sudah mengisi kolom terukur (tahap tahsin, juz tuntas), itu yang
                dibaca; bila belum, catatan teks bebasnya yang disimpulkan — baris hasil
                penyimpulan ditandai <em>tersirat</em>.
              </p>
              <p>
                Ambang &ldquo;≥ 1 juz&rdquo; berarti juz 30 tuntas atau sudah masuk juz 29 ke
                atas. Peserta bermetode Syajaroh tidak dipetakan ke ambang UMMI, sehingga
                angka kesiapannya bukan indikasi ketidaksiapan.
              </p>
              <p>
                Belum mencakup verifikasi surat pilihan dan tes Bahasa Inggris yang juga
                menjadi syarat kepegawaian.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function lebar(bagian: number, total: number): number {
  return total ? Math.round((bagian / total) * 100) : 0
}

function persenDari(bagian: number, total: number, akhiran: string): string {
  return total ? `${Math.round((bagian / total) * 100)}% ${akhiran}` : 'belum ada data'
}

function Kpi({
  icon, nilai, label, hint,
}: {
  icon: React.ReactNode
  nilai: string
  label: string
  hint: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <span
        className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}
      >
        {icon}
      </span>
      <p className="text-2xl font-bold leading-none tabular-nums">{nilai}</p>
      <p className="mt-1 text-xs font-medium">{label}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function Sebaran({
  judul, keterangan, baris, total,
}: {
  judul: string
  keterangan: string
  baris: { label: string; jumlah: number; memenuhi: boolean }[]
  total: number
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{judul}</h2>
      <p className="mt-0.5 mb-3 text-xs text-muted-foreground">{keterangan}</p>
      <div className="space-y-1.5">
        {baris.map(b => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-xs">{b.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
              <div
                className={`h-full rounded ${b.memenuhi ? 'bg-success/60' : 'bg-primary/50'}`}
                style={{ width: `${lebar(b.jumlah, total)}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {b.jumlah}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function BarisTotal({ ringkas, kolom }: { ringkas: RingkasKesiapan; kolom: number }) {
  return (
    <tr className="font-medium">
      <td className="py-2 pr-2 text-xs text-muted-foreground">TOTAL</td>
      <td className="py-2 px-2">{kolom} kelompok</td>
      <td className="py-2 px-2 text-right tabular-nums">{ringkas.total}</td>
      <td className="py-2 px-2 text-right tabular-nums">{ringkas.terdata}</td>
      <td className="py-2 px-2 text-right tabular-nums">{ringkas.tahsinAmbang}</td>
      <td className="py-2 px-2 text-right tabular-nums">{ringkas.tahfidz1Juz}</td>
      <td className="py-2 pl-2 text-right tabular-nums">{ringkas.inti}</td>
    </tr>
  )
}

function Fokus({
  judul, keterangan, kosong, peserta,
}: {
  judul: string
  keterangan: string
  kosong: string
  peserta: KesiapanPeserta[]
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{judul}</h2>
      <p className="mt-0.5 mb-3 text-xs text-muted-foreground">{keterangan}</p>
      {peserta.length === 0 ? (
        <p className="text-sm text-muted-foreground">{kosong}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Nama</th>
                <th className="py-2 px-2 font-medium">Tahsin terakhir</th>
                <th className="py-2 px-2 font-medium">Tahfidz terakhir</th>
                <th className="py-2 pl-2 font-medium">Status vs standar</th>
              </tr>
            </thead>
            <tbody>
              {peserta.map(p => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    <p className="font-medium">{p.nama}</p>
                    <p className="text-xs text-muted-foreground">
                      {[p.unit, p.statusPegawai ? LABEL_STATUS_PEGAWAI[p.statusPegawai] : '']
                        .filter(Boolean).join(' · ')}
                    </p>
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{p.tahsin.tahap || '—'}</td>
                  <td className="py-2 px-2 text-muted-foreground">{p.tahfidz.label || '—'}</td>
                  <td className="py-2 pl-2">
                    <span className={p.status.memenuhi ? 'text-success' : 'text-warning'}>
                      {p.status.teks}
                    </span>
                    <span className="block text-xs text-muted-foreground">acuan: {p.status.acuan}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
