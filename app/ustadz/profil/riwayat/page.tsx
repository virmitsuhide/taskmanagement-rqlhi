import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Printer, ChartNoAxesColumn, MessageSquareText, ThumbsUp, Target, StickyNote,
} from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import {
  canManageTeacherProfiles, canPrintKpiRapor, UNIT_PENUGASAN_LABELS,
} from '@/lib/auth/permissions'
import { getGuruProfile, getRiwayatKpi, type RiwayatKpiBulan } from '@/lib/data/guru-profil'
import { KPI_INDIKATOR_SINGKAT } from '@/lib/kpi/rapor-bulanan'
import { KPI_LEVEL_TONE } from '@/lib/kpi/parameter'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ guru?: string; unit?: string; tab?: string }>
}

type Tab = 'kpi' | 'rapor' | 'catatan'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'kpi', label: 'Riwayat KPI', icon: <ChartNoAxesColumn className="h-3.5 w-3.5" /> },
  { key: 'rapor', label: 'Riwayat Rapor', icon: <Printer className="h-3.5 w-3.5" /> },
  { key: 'catatan', label: 'Riwayat Catatan', icon: <MessageSquareText className="h-3.5 w-3.5" /> },
]

/**
 * Riwayat seorang guru — tiga sudut pandang atas data yang sama.
 *
 * Ketiganya lahir dari satu tabel (kpi_monthly), jadi ketiganya juga satu
 * halaman dengan tiga tab, bukan tiga halaman yang mengambil baris yang sama
 * tiga kali. Yang membedakan hanya apa yang ditonjolkan: angka per indikator,
 * lembar rapor yang bisa dicetak, atau kalimat evaluasinya.
 */
export default async function RiwayatGuruPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageTeacherProfiles(session.role)) redirect('/dashboard')

  const p = await searchParams
  if (!p.guru) redirect('/ustadz/profil')

  const tab: Tab = p.tab === 'rapor' || p.tab === 'catatan' ? p.tab : 'kpi'
  const { profile } = await getGuruProfile(p.guru)
  if (!profile) redirect('/ustadz/profil')

  const unit = (p.unit ?? profile.unit ?? 'sd') as Jenjang
  const riwayat = await getRiwayatKpi(profile.id)
  const kembali = `/ustadz/profil?unit=${unit}&guru=${profile.id}`
  const bolehCetak = canPrintKpiRapor(session.role)

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Riwayat Guru"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Profil Guru', href: kembali }, { label: 'Riwayat' }]}
      />

      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="mx-auto max-w-4xl p-4 md:p-6">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href={kembali}><ArrowLeft className="mr-1 h-4 w-4" />Kembali ke profil</Link>
          </Button>

          <h1 className="text-2xl font-bold leading-tight">{profile.full_name}</h1>
          <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
            {UNIT_PENUGASAN_LABELS[unit]} · {riwayat.length} bulan penilaian tercatat
          </p>

          <div className="mb-4 flex w-fit gap-1 rounded-lg bg-muted p-1">
            {TABS.map(t => (
              <Link
                key={t.key}
                href={`/ustadz/profil/riwayat?guru=${profile.id}&unit=${unit}&tab=${t.key}`}
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === t.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.icon}{t.label}
              </Link>
            ))}
          </div>

          {riwayat.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card py-12 text-center">
              <p className="text-sm font-medium">Belum ada penilaian KPI</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Riwayat terbentuk sendirinya begitu SDM mengisi KPI bulanan guru ini
                lewat menu <b>KPI Guru</b>.
              </p>
            </div>
          ) : tab === 'kpi' ? (
            <TabKpi riwayat={riwayat} />
          ) : tab === 'rapor' ? (
            <TabRapor riwayat={riwayat} guruId={profile.id} bolehCetak={bolehCetak} />
          ) : (
            <TabCatatan riwayat={riwayat} />
          )}
        </div>
      </div>
    </div>
  )
}

/** Nilai tiap indikator per bulan — bulan sebagai baris, indikator sebagai kolom. */
function TabKpi({ riwayat }: { riwayat: RiwayatKpiBulan[] }) {
  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-2 text-left font-medium">Periode</th>
              {KPI_INDIKATOR_SINGKAT.map(s => (
                <th key={s} className="px-2 py-2 text-center font-medium whitespace-nowrap">{s}</th>
              ))}
              <th className="px-2 py-2 text-center font-medium">Rapot</th>
              <th className="px-2 py-2 text-center font-medium">Predikat</th>
            </tr>
          </thead>
          <tbody>
            {riwayat.map(r => (
              <tr key={`${r.year}-${r.month}`} className="border-t hover:bg-muted/30">
                <td className="whitespace-nowrap px-2 py-2 font-medium">{r.label}</td>
                {r.nilai.map((n, i) => (
                  <td key={i} className="px-2 py-2 text-center tabular-nums">{Math.round(n * 10) / 10}</td>
                ))}
                <td className="px-2 py-2 text-center font-bold tabular-nums">{r.rapot.toFixed(1)}</td>
                <td className="px-2 py-2 text-center">
                  <span className={cn('inline-block whitespace-nowrap rounded px-1.5 py-0.5 font-medium', KPI_LEVEL_TONE[r.level])}>
                    {r.level} · {r.predikat}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Terbaru di atas. Setiap nilai dihitung ulang dengan rubrik yang berlaku pada
        unit tempat guru dinilai bulan itu — bukan unitnya sekarang.
      </p>
    </>
  )
}

/** Daftar bulan yang rapornya sudah bisa dicetak. */
function TabRapor({
  riwayat, guruId, bolehCetak,
}: {
  riwayat: RiwayatKpiBulan[]
  guruId: string
  bolehCetak: boolean
}) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
      {riwayat.map(r => (
        <div key={`${r.year}-${r.month}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{r.label}</p>
            <p className="text-[11px] text-muted-foreground">
              Nilai rapot <b className="tabular-nums text-foreground">{r.rapot.toFixed(1)}</b> · {r.predikat}
              {r.unit && ` · ${UNIT_PENUGASAN_LABELS[r.unit]}`}
            </p>
          </div>
          {bolehCetak && r.unit && (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={`/kpi/cetak?teacher=${guruId}&unit=${r.unit}&year=${r.year}&month=${r.month}`}>
                <Printer className="mr-1 h-3.5 w-3.5" />Lihat &amp; Cetak
              </Link>
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Kalimat evaluasi tiap bulan.
 *
 * Hanya menampilkan yang BENAR-BENAR ditulis SDM. Kalimat turunan yang muncul
 * di lembar rapor sengaja tidak diulang di sini: yang dicari di halaman riwayat
 * adalah apa yang pernah disampaikan seseorang kepada guru ini, dan mencampurnya
 * dengan kalimat yang dihasilkan rumus membuat keduanya tak bisa dibedakan lagi.
 */
function TabCatatan({ riwayat }: { riwayat: RiwayatKpiBulan[] }) {
  const berisi = riwayat.filter(r => r.apresiasi.length || r.pengembangan.length || r.notes)

  if (berisi.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card py-12 text-center">
        <p className="text-sm font-medium">Belum ada catatan tertulis</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Catatan diisi saat menilai KPI, di kartu <b>Catatan untuk Rapor Guru</b>.
          Bulan yang dibiarkan kosong tetap mencetak rapor — dengan kalimat yang
          disusun otomatis dari nilainya, dan kalimat itu tidak ditampilkan di sini.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {berisi.map(r => (
        <div key={`${r.year}-${r.month}`} className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
            <h2 className="text-sm font-semibold">{r.label}</h2>
            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', KPI_LEVEL_TONE[r.level])}>
              {r.rapot.toFixed(1)} · {r.predikat}
            </span>
          </div>
          <div className="space-y-3 p-4">
            {r.apresiasi.length > 0 && (
              <Blok icon={<ThumbsUp className="h-3.5 w-3.5" />} judul="Apresiasi & Catatan Positif" warna="var(--success)" items={r.apresiasi} />
            )}
            {r.pengembangan.length > 0 && (
              <Blok icon={<Target className="h-3.5 w-3.5" />} judul="Area Pengembangan" warna="var(--warning)" items={r.pengembangan} />
            )}
            {r.notes && (
              <Blok icon={<StickyNote className="h-3.5 w-3.5" />} judul="Catatan Internal (tidak dicetak)" warna="var(--muted-foreground)" items={[r.notes]} />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Blok({
  icon, judul, warna, items,
}: {
  icon: React.ReactNode
  judul: string
  warna: string
  items: string[]
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase" style={{ color: warna }}>
        {icon}{judul}
      </p>
      <ul className="space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-xs leading-snug">
            <span className="shrink-0" style={{ color: warna }}>•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
