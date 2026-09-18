import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { LABEL_PERIODE, type KodePeriode } from '@/lib/data/statistik-guru'
import type { ProgresSiswa, TitikProgres } from '@/lib/data/progres-siswa'
import { cn } from '@/lib/utils'

/** Urutan tombol: dari rentang terpendek ke terpanjang. */
export const URUTAN_PROGRES: KodePeriode[] = ['minggu', 'bulan', 'tigabulan', 'semester', 'ta']

const TINGGI = 96
const angka1 = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 })

/**
 * Grafik progres satu anak: tahsin dan tahfidz sebagai dua grafik terpisah,
 * karena halaman buku jilid dan halaman mushaf tidak bisa dijumlahkan.
 * Batang dari div seperti di Statistik Mengajar — ikut tema gelap dan
 * tercetak tanpa JavaScript.
 */
export function GrafikProgres({ data, kode, hrefDasar, tanpaTahsin }: {
  data: ProgresSiswa
  kode: KodePeriode
  /** URL halaman anak; filter ditambahkan sebagai ?periode=. */
  hrefDasar: string
  /** Anak murni tahfidz — grafik tahsinnya tidak berlaku, bukan nol. */
  tanpaTahsin: boolean
}) {
  const satuanWadah = kode === 'semester' || kode === 'tigabulan' ? 'per pekan' : kode === 'ta' ? 'per bulan' : 'per hari sekolah'

  return (
    <section id="progres" className="scroll-mt-4">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" /> Grafik Progres
      </h2>
      <div className="rounded-xl border bg-card p-5 space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Periode progres">
            {URUTAN_PROGRES.map(k => (
              <Link
                key={k}
                href={`${hrefDasar}?periode=${k}#progres`}
                scroll={false}
                aria-current={k === kode ? 'page' : undefined}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  k === kode ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
                )}
              >
                {LABEL_PERIODE[k]}
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{data.periode.keterangan} · {satuanWadah}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {tanpaTahsin ? (
            <div>
              <p className="text-sm font-semibold">Tahsin</p>
              <p className="mt-2 text-sm text-muted-foreground">Tidak berlaku — anak ini murni tahfidz.</p>
            </div>
          ) : (
            <Batang
              judul="Tahsin"
              ringkas={`${data.total.tahsinLulus.toLocaleString('id-ID')} halaman lulus`}
              catatan={data.total.tahsinUlang > 0 ? `${data.total.tahsinUlang.toLocaleString('id-ID')} setoran masih diulang` : null}
              titik={data.titik}
              nilai={t => t.tahsinLulus}
              teks={t => t.tahsinLulus.toLocaleString('id-ID')}
              tooltip={t => `${t.judul}: ${t.tahsinLulus} halaman lulus${t.tahsinUlang ? `, ${t.tahsinUlang} ulang` : ''}`}
              warna="var(--seri-1)"
              kosong="Belum ada halaman tahsin lulus pada periode ini."
            />
          )}
          <Batang
            judul="Tahfidz (ziyadah)"
            ringkas={`${angka1(data.total.tahfidzHalaman)} halaman mushaf`}
            catatan={data.total.tahfidzAyat > 0 ? `${data.total.tahfidzAyat.toLocaleString('id-ID')} ayat hafalan baru` : null}
            titik={data.titik}
            nilai={t => t.tahfidzHalaman}
            teks={t => angka1(t.tahfidzHalaman)}
            tooltip={t => `${t.judul}: ${angka1(t.tahfidzHalaman)} halaman (${t.tahfidzAyat} ayat)`}
            warna="var(--seri-2)"
            kosong="Belum ada hafalan baru pada periode ini."
          />
        </div>
      </div>
    </section>
  )
}

function Batang({ judul, ringkas, catatan, titik, nilai, teks, tooltip, warna, kosong }: {
  judul: string
  ringkas: string
  catatan: string | null
  titik: TitikProgres[]
  nilai: (t: TitikProgres) => number
  teks: (t: TitikProgres) => string
  tooltip: (t: TitikProgres) => string
  warna: string
  kosong: string
}) {
  const total = titik.reduce((n, t) => n + nilai(t), 0)
  const maks = Math.max(...titik.map(nilai), 0)
  // Sebulan = ±22 batang; angka di bawah tiap batang bertumpuk di layar HP.
  const rapat = titik.length > 12

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{judul}</p>
        <p className="text-sm font-bold tabular-nums">{ringkas}</p>
      </div>
      {catatan && <p className="text-[11px] text-muted-foreground text-right">{catatan}</p>}

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{kosong}</p>
      ) : (
        <div className="mt-3 flex items-end justify-between gap-1">
          {titik.map(t => {
            const v = nilai(t)
            return (
              <div key={t.judul} className="flex-1 min-w-0 flex flex-col items-center gap-1" title={tooltip(t)}>
                {/* Tinggi dalam piksel: persen di kolom flex tidak punya acuan pasti. */}
                <div className="w-full flex flex-col justify-end" style={{ height: TINGGI }}>
                  {v > 0 && (
                    <div className="w-full rounded-t" style={{ height: Math.max(3, Math.round((v / maks) * TINGGI)), background: warna }} />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground truncate max-w-full">{t.label}</span>
                <span className={cn('min-h-[15px] text-[10px] font-semibold tabular-nums', rapat && 'hidden sm:block')}>
                  {v > 0 ? teks(t) : null}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
