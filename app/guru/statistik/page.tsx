import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle, Trophy, BookOpen, BookMarked, Users, TrendingUp, BarChart3, Target, Check, ArrowDown, HelpCircle,
} from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import {
  getStatistikGuru, LABEL_PERIODE, type KodePeriode, type PeringkatSiswa, type StatistikGuru,
} from '@/lib/data/statistik-guru'
import { DashTop, Panel, Slicer, KpiCard, StackedBar, hrefDengan, persenUbah } from '@/components/dashboard/kit'
import { PanelTabs } from '@/components/dashboard/PanelTabs'
import { cn } from '@/lib/utils'

type Fokus = 'semua' | 'tahsin' | 'tahfidz'

interface PageProps {
  searchParams: Promise<{ periode?: string; halaqoh?: string; fokus?: string }>
}

const URUTAN: KodePeriode[] = ['minggu', 'bulan', 'tigabulan', 'semester', 'ta']
const PATH = '/guru/statistik'

/**
 * Dashboard statistik mengajar — tata letak Z, sama dengan dashboard manajemen:
 *
 *   judul & cakupan ─────────────────────► filter (periode · halaqoh · program)
 *   ◄──────── 4 KPI + perubahan vs periode sebanding ────────
 *   aktivitas setoran (lebar) ──────────► posisi vs target
 *   peringkat siswa ────────────────────► siswa perlu perhatian
 */
export default async function GuruStatistikPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const kode: KodePeriode = URUTAN.includes(sp.periode as KodePeriode) ? (sp.periode as KodePeriode) : 'bulan'
  const fokus: Fokus = sp.fokus === 'tahsin' || sp.fokus === 'tahfidz' ? sp.fokus : 'semua'
  const s = await getStatistikGuru(session.teacherId, kode, { halaqohId: sp.halaqoh })

  const params = {
    periode: kode === 'bulan' ? undefined : kode,
    halaqoh: s.halaqohTerpilih?.id,
    fokus: fokus === 'semua' ? undefined : fokus,
  }
  const href = (ganti: Record<string, string | undefined>) => hrefDengan(PATH, params, ganti)
  const tahsin = fokus !== 'tahfidz'
  const tahfidz = fokus !== 'tahsin'

  const lalu = s.pembanding
  const delta = (pick: (r: StatistikGuru['ringkas']) => number) =>
    lalu ? { pct: persenUbah(pick(lalu.ringkas), pick(s.ringkas)), vs: lalu.keterangan } : undefined

  const cakupan = s.halaqohTerpilih ? s.halaqohTerpilih.name : s.halaqoh.length > 1 ? `${s.halaqoh.length} halaqoh` : s.halaqoh[0]?.name

  // Posisi vs target: yang tidak masuk "perhatian" dan tidak "tak terukur" = sudah sesuai.
  const tahsinSesuai = s.jumlahSiswa - s.perhatianTahsin.length - s.tahsinTakTerukur
  const tahfidzSesuai = s.jumlahSiswa - s.perhatianTahfidz.length - s.tahfidzTakTerukur
  const tahsinTerukur = tahsinSesuai + s.perhatianTahsin.length
  const tahfidzTerukur = tahfidzSesuai + s.perhatianTahfidz.length

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6">

        {/* ── Z · garis atas ── */}
        <DashTop
          serif
          eyebrow="Statistik"
          title="Statistik Mengajar"
          context={<>{s.periode.keterangan}{cakupan ? ` · ${cakupan}` : ''} · {s.jumlahSiswa.toLocaleString('id-ID')} siswa</>}
          filters={
            <>
              <Slicer
                label="Periode"
                options={URUTAN.map(k => ({ label: LABEL_PERIODE[k], href: href({ periode: k === 'bulan' ? undefined : k }), active: k === kode }))}
              />
              {s.halaqoh.length > 1 && (
                <Slicer
                  label="Halaqoh"
                  options={[
                    { label: 'Semua', href: href({ halaqoh: undefined }), active: !s.halaqohTerpilih },
                    // Satu halaqoh = satu sesi guru, jadi "Sesi 2" sudah cukup membedakan;
                    // nama lengkap hanya dipakai bila nomor sesinya kosong atau kembar.
                    ...s.halaqoh.map(h => ({
                      label: h.sesi && s.halaqoh.filter(x => x.sesi === h.sesi).length === 1 ? `Sesi ${h.sesi}` : h.name,
                      href: href({ halaqoh: h.id }),
                      active: s.halaqohTerpilih?.id === h.id,
                    })),
                  ]}
                />
              )}
              <Slicer
                label="Program"
                options={(['semua', 'tahsin', 'tahfidz'] as Fokus[]).map(f => ({
                  label: f === 'semua' ? 'Semua' : f === 'tahsin' ? 'Tahsin' : 'Tahfidz',
                  href: href({ fokus: f === 'semua' ? undefined : f }),
                  active: fokus === f,
                }))}
              />
            </>
          }
        />

        {s.jumlahSiswa === 0 ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            {s.halaqohTerpilih
              ? 'Halaqoh ini belum berisi siswa aktif.'
              : 'Anda belum mengampu halaqoh aktif, atau halaqohnya belum berisi siswa.'}
          </div>
        ) : (
          <>
            {/* ── Z · diagonal: KPI ── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {tahsin && (
                <KpiCard icon={<BookOpen className="h-3.5 w-3.5" />} label="Setoran tahsin"
                  value={s.ringkas.setoranTahsin} delta={delta(r => r.setoranTahsin)} />
              )}
              {tahfidz && (
                <KpiCard icon={<BookMarked className="h-3.5 w-3.5" />} label="Setoran tahfidz"
                  value={s.ringkas.setoranTahfidz} delta={delta(r => r.setoranTahfidz)} />
              )}
              <KpiCard
                icon={<Users className="h-3.5 w-3.5" />}
                label="Siswa sudah setor"
                value={s.ringkas.siswaSetor}
                unit={`/ ${s.jumlahSiswa.toLocaleString('id-ID')}`}
                ratio={s.ringkas.siswaSetor / s.jumlahSiswa}
                delta={delta(r => r.siswaSetor)}
                sub={s.jumlahSiswa - s.ringkas.siswaSetor > 0 ? `${s.jumlahSiswa - s.ringkas.siswaSetor} siswa belum setor` : 'Semua siswa sudah setor'}
              />
              <KpiCard
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label={fokus === 'tahsin' ? 'Naik jilid' : fokus === 'tahfidz' ? 'Naik juz' : 'Naik jilid · juz'}
                value={fokus === 'semua'
                  ? `${s.ringkas.naikJilid.toLocaleString('id-ID')} · ${s.ringkas.naikJuz.toLocaleString('id-ID')}`
                  : fokus === 'tahsin' ? s.ringkas.naikJilid : s.ringkas.naikJuz}
                delta={delta(r => (tahsin ? r.naikJilid : 0) + (tahfidz ? r.naikJuz : 0))}
              />
              {/* Program tunggal: slot kosong diisi jumlah anak yang perlu perhatian. */}
              {fokus !== 'semua' && (
                <KpiCard
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  label="Perlu perhatian"
                  value={fokus === 'tahsin' ? s.perhatianTahsin.length : s.perhatianTahfidz.length}
                  unit={`/ ${(fokus === 'tahsin' ? tahsinTerukur : tahfidzTerukur).toLocaleString('id-ID')}`}
                  sub="di bawah target · posisi hari ini"
                />
              )}
            </div>
            {!lalu && (
              <p className="-mt-2 text-[11px] text-muted-foreground">
                Perbandingan hanya tersedia untuk minggu, bulan, dan 3 bulan — periode semester/tahun sebelumnya bukan pembanding yang setara.
              </p>
            )}

            {/* ── Z · garis tengah: aktivitas ► posisi vs target ── */}
            <div className="grid gap-5 lg:grid-cols-12">
              <Panel
                className="lg:col-span-8"
                title="Aktivitas Setoran"
                icon={<BarChart3 className="h-4 w-4" />}
                sub={`${kode === 'semester' || kode === 'tigabulan' ? 'Per pekan' : kode === 'ta' ? 'Per bulan' : 'Per hari sekolah'} · ${s.periode.keterangan}`}
              >
                <AktivitasChart s={s} fokus={fokus} rapat={s.aktivitas.length > 12} />
              </Panel>

              <Panel
                className="lg:col-span-4"
                title="Posisi vs Target"
                icon={<Target className="h-4 w-4" />}
                sub="Posisi siswa hari ini — tidak mengikuti filter periode."
              >
                <div className="space-y-5">
                  {tahsin && (
                    <div>
                      <p className="mb-2 text-xs font-semibold">Tahsin · target semester kelas</p>
                      <StackedBar segments={[
                        { label: 'Sudah mencapai target', value: Math.max(0, tahsinSesuai), color: 'var(--success)', icon: <Check className="h-3.5 w-3.5" /> },
                        { label: 'Di bawah target', value: s.perhatianTahsin.length, color: 'var(--warning)', icon: <ArrowDown className="h-3.5 w-3.5" /> },
                        { label: 'Belum terukur', value: s.tahsinTakTerukur, color: 'var(--muted-foreground)', icon: <HelpCircle className="h-3.5 w-3.5" /> },
                      ]} />
                    </div>
                  )}
                  {tahfidz && (
                    <div>
                      <p className="mb-2 text-xs font-semibold">Tahfidz · target bulanan program</p>
                      <StackedBar segments={[
                        { label: 'Sesuai / di atas target', value: Math.max(0, tahfidzSesuai), color: 'var(--success)', icon: <Check className="h-3.5 w-3.5" /> },
                        { label: 'Tertinggal > 2 pekan', value: s.perhatianTahfidz.length, color: 'var(--warning)', icon: <ArrowDown className="h-3.5 w-3.5" /> },
                        { label: 'Belum terukur', value: s.tahfidzTakTerukur, color: 'var(--muted-foreground)', icon: <HelpCircle className="h-3.5 w-3.5" /> },
                      ]} />
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            {/* ── Z · garis bawah: peringkat ► perhatian ── */}
            <div className="grid gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-7" title="Peringkat Siswa" icon={<Trophy className="h-4 w-4" />}
                sub="Tertinggi = capaian saat ini · Tercepat = kemajuan selama periode terpilih">
                <PanelTabs tabs={[
                  {
                    key: 'tertinggi', label: 'Tertinggi',
                    content: (
                      <DuaKolom>
                        {tahsin && <DaftarPeringkat judul="Tahsin" sub="Capaian akhir tahsin" daftar={s.tahsinTertinggi} tanpaBatang
                          kosong="Belum ada siswa dengan posisi tahsin tercatat." />}
                        {tahfidz && <DaftarPeringkat judul="Tahfidz" sub="Total hafalan, halaman mushaf" daftar={s.tahfidzTertinggi}
                          kosong="Belum ada hafalan yang terukur." />}
                      </DuaKolom>
                    ),
                  },
                  {
                    key: 'tercepat', label: `Tercepat · ${LABEL_PERIODE[kode].toLowerCase()}`,
                    content: (
                      <DuaKolom>
                        {tahsin && <DaftarPeringkat judul="Tahsin" sub="Halaman lulus terbanyak" daftar={s.tahsinTercepat}
                          kosong="Belum ada setoran tahsin lulus pada periode ini." />}
                        {tahfidz && <DaftarPeringkat judul="Tahfidz" sub="Halaman ziyadah terbanyak" daftar={s.tahfidzTercepat}
                          kosong="Belum ada ziyadah pada periode ini." />}
                      </DuaKolom>
                    ),
                  },
                ]} />
              </Panel>

              <Panel className="lg:col-span-5" title="Perlu Perhatian" icon={<AlertTriangle className="h-4 w-4 text-warning" />}
                sub="Dihitung dari posisi hari ini terhadap target.">
                <PanelTabs tabs={[
                  ...(tahsin ? [{
                    key: 'tahsin', label: `Tahsin · ${s.perhatianTahsin.length}`,
                    content: (
                      <DaftarPerhatian
                        ket="Posisi di bawah target tahsin semester kelasnya."
                        kosong="Semua anak yang terukur sudah mencapai target."
                        takTerukur={s.tahsinTakTerukur > 0 ? `${s.tahsinTakTerukur} anak tidak dinilai: posisi tahsin atau target kelasnya belum tercatat.` : null}
                        baris={s.perhatianTahsin.map(p => ({
                          id: p.id, nama: p.nama, kelas: p.kelas,
                          detail: `${p.posisi} → target ${p.target}`,
                          lencana: `kurang ${p.kurang} tahap`,
                        }))}
                      />
                    ),
                  }] : []),
                  ...(tahfidz ? [{
                    key: 'tahfidz', label: `Tahfidz · ${s.perhatianTahfidz.length}`,
                    content: (
                      <DaftarPerhatian
                        ket="Hafalan tertinggal lebih dari 2 pekan dari target bulanan programnya."
                        kosong="Tidak ada anak yang tertinggal dari target."
                        takTerukur={s.tahfidzTakTerukur > 0 ? `${s.tahfidzTakTerukur} anak tidak dinilai: belum ada ziyadah tercatat atau programnya tanpa target.` : null}
                        baris={s.perhatianTahfidz.map(p => ({
                          id: p.id, nama: p.nama, kelas: p.kelas,
                          detail: `${p.capaian ?? '—'} → target ${p.target ?? '—'}`,
                          lencana: p.selisihPekan !== null
                            ? `${Math.abs(p.selisihPekan).toLocaleString('id-ID', { maximumFractionDigits: 1 })} pekan`
                            : null,
                        }))}
                      />
                    ),
                  }] : []),
                ]} />
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Grafik aktivitas ────────────────────────────────────────────────────────

/** Batas atas sumbu yang bulat — 17 jadi 20, bukan 17. */
function niceCeil(v: number): number {
  if (v <= 5) return 5
  if (v <= 10) return 10
  const mag = 10 ** Math.floor(Math.log10(v))
  const step = mag / 2
  return Math.ceil(v / step) * step
}

/**
 * Batang bertumpuk dari div — tanpa pustaka chart. Tinggi dalam piksel, bukan
 * persen: persen di dalam kolom flex tidak punya tinggi acuan yang pasti dan
 * batangnya kempis ke tinggi minimum.
 */
function AktivitasChart({ s, fokus, rapat }: { s: StatistikGuru; fokus: Fokus; rapat: boolean }) {
  const nilai = (a: StatistikGuru['aktivitas'][number]) =>
    (fokus !== 'tahfidz' ? a.tahsin : 0) + (fokus !== 'tahsin' ? a.tahfidz : 0)
  const total = s.aktivitas.reduce((n, a) => n + nilai(a), 0)
  if (total === 0) return <p className="text-sm text-muted-foreground">Belum ada setoran pada periode ini.</p>

  const TINGGI = 160
  const atas = niceCeil(Math.max(...s.aktivitas.map(nilai)))
  const px = (n: number) => (n === 0 ? 0 : Math.max(3, Math.round((n / atas) * TINGGI)))
  const terisi = s.aktivitas.filter(a => nilai(a) > 0).length
  const rata = total / Math.max(1, terisi)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {fokus !== 'tahfidz' && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'var(--seri-1)' }} /> Tahsin</span>}
        {fokus !== 'tahsin' && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'var(--seri-2)' }} /> Tahfidz</span>}
        <span className="ml-auto">
          Total <b className="text-foreground tabular-nums">{total.toLocaleString('id-ID')}</b> · rata-rata{' '}
          <b className="text-foreground tabular-nums">{rata.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</b> per {s.periode.kode === 'ta' ? 'bulan' : s.periode.kode === 'semester' || s.periode.kode === 'tigabulan' ? 'pekan' : 'hari'} aktif
        </span>
      </div>

      <div className="flex gap-2">
        {/* Sumbu Y */}
        <div className="relative w-6 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground" style={{ height: TINGGI }}>
          {[1, 0.5, 0].map(f => (
            <span key={f} className="absolute right-0 -translate-y-1/2" style={{ top: (1 - f) * TINGGI }}>{(atas * f).toLocaleString('id-ID')}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: TINGGI }}>
            {[0, 0.5, 1].map(f => (
              <div key={f} className="absolute inset-x-0 border-t" style={{ top: f * TINGGI, borderColor: 'var(--border)' }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-1">
              {s.aktivitas.map(a => {
                const ts = fokus !== 'tahfidz' ? a.tahsin : 0
                const tf = fokus !== 'tahsin' ? a.tahfidz : 0
                return (
                  <div key={a.judul} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-px"
                    title={`${a.judul}: ${[fokus !== 'tahfidz' ? `${a.tahsin} tahsin` : null, fokus !== 'tahsin' ? `${a.tahfidz} tahfidz` : null].filter(Boolean).join(', ')}`}>
                    {tf > 0 && <div className="w-full rounded-t-[3px]" style={{ height: px(tf), background: 'var(--seri-2)' }} />}
                    {ts > 0 && <div className={cn('w-full', tf > 0 ? '' : 'rounded-t-[3px]')} style={{ height: px(ts), background: 'var(--seri-1)' }} />}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-1.5 flex gap-1">
            {s.aktivitas.map((a, i) => (
              <div key={a.judul} className="min-w-0 flex-1 text-center">
                {/* Batang rapat di HP: label tiap kelima saja, supaya tidak jadi deretan "1.." terpotong. */}
                <span className={cn('block whitespace-nowrap text-[10px] text-muted-foreground', rapat && i % 5 !== 0 && 'invisible sm:visible')}>{a.label}</span>
                {/* Sebulan = ±22 batang; angka tiap batang bertumpuk di HP — di sana cukup lewat tooltip. */}
                <span className={cn('block min-h-[14px] text-[10px] font-semibold tabular-nums', rapat && 'hidden sm:block')}>{nilai(a) || null}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Daftar ──────────────────────────────────────────────────────────────────

function DuaKolom({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2">{children}</div>
}

function DaftarPeringkat({ judul, sub, daftar, kosong, tanpaBatang = false }: {
  judul: string
  sub: string
  daftar: PeringkatSiswa[]
  kosong: string
  /** Untuk peringkat berupa posisi (Jilid 6, Lulus Tahsin) — batang tidak bermakna. */
  tanpaBatang?: boolean
}) {
  const maks = Math.max(1, ...daftar.map(d => d.nilai))
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold">{judul}</p>
      <p className="mb-3 text-[11px] text-muted-foreground">{sub}</p>
      {daftar.length === 0 ? (
        <p className="text-sm text-muted-foreground">{kosong}</p>
      ) : (
        <ol className="space-y-3">
          {daftar.map((d, i) => (
            <li key={d.id}>
              <Link href={`/guru/siswa/${d.id}`} className="block hover:opacity-80">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className={cn('w-4 shrink-0 text-xs font-bold tabular-nums', i < 3 ? 'text-primary' : 'text-muted-foreground')}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{d.nama}</span>
                  {/* Posisi berupa teks panjang ("Jilid 6 halaman 30") pindah ke baris bawah
                      supaya nama tidak terpotong; angka tetap di kanan. */}
                  {!tanpaBatang && <span className="shrink-0 font-semibold tabular-nums">{d.nilaiTeks}</span>}
                  {!tanpaBatang && d.satuan && <span className="shrink-0 text-[11px] text-muted-foreground">{d.satuan}</span>}
                </div>
                {tanpaBatang && <p className="ml-6 mt-0.5 truncate text-xs font-semibold text-primary">{d.nilaiTeks}</p>}
                {!tanpaBatang && (
                  <div className="ml-6 mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(d.nilai / maks) * 100}%`, background: 'var(--primary)' }} />
                  </div>
                )}
                <p className="ml-6 mt-0.5 truncate text-[11px] text-muted-foreground">
                  {[d.kelas ? `Kelas ${d.kelas}` : null, d.keterangan].filter(Boolean).join(' · ')}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function DaftarPerhatian({ ket, kosong, takTerukur, baris }: {
  ket: string
  kosong: string
  takTerukur: string | null
  baris: { id: string; nama: string; kelas: string | null; detail: string; lencana: string | null }[]
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] text-muted-foreground">{ket}</p>
      {baris.length === 0 ? (
        <p className="rounded-lg p-3 text-sm" style={{ background: 'var(--success-wash)', color: 'var(--success)' }}>
          <Check className="mr-1 inline h-4 w-4" />{kosong}
        </p>
      ) : (
        <ul className="max-h-[360px] divide-y overflow-y-auto">
          {baris.map(p => (
            <li key={p.id}>
              <Link href={`/guru/siswa/${p.id}`} className="flex items-center gap-2 py-2 hover:bg-muted/30">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.nama}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {p.kelas ? `Kelas ${p.kelas} · ` : ''}{p.detail}
                  </span>
                </span>
                {p.lencana && (
                  <span className="shrink-0 rounded-full bg-warning-wash px-2 py-0.5 text-[11px] text-warning">{p.lencana}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {takTerukur && <p className="mt-2 text-[11px] text-muted-foreground">{takTerukur}</p>}
    </div>
  )
}
