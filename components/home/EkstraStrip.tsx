import Link from 'next/link'
import { ArrowRight, Clock, Users } from 'lucide-react'

/** Satu jenis ekstra yang boleh tampil ke publik — tanpa data peserta. */
export interface KartuEkstra {
  id: string
  nama: string
  bidang: string
  /** Sudah diformat: 'Rp 150.000 / bulan' atau 'Tanpa biaya'. */
  biaya: string
  /** '45 menit · Sore hari'. */
  waktu: string
  /** Sisa kursi semua jadwal yang dibuka untuk jenis ini. */
  sisa: number
  jadwal: number
}

const LABEL_BIDANG: Record<string, string> = {
  tahsin: 'Tahsin',
  tahfidz: 'Tahfidz',
  campuran: 'Tahsin & tahfidz',
}

/**
 * Ekstra tahsin & tahfidz di beranda. Seperti TeacherStrip, seksi ini hilang
 * total selama belum ada jenis ekstra yang membuka jadwal — beranda tidak
 * menampilkan blok kosong.
 */
export function EkstraStrip({ title, items }: { title: string; items: KartuEkstra[] }) {
  if (items.length === 0) return null

  return (
    <section id="ekstra" className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Pendaftaran dibuka</p>
          <h2
            className="m-0 text-[30px] font-normal leading-tight tracking-[-0.015em] text-foreground md:text-[40px]"
            style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
          >
            {title}
          </h2>
        </div>
        <Link
          href="/daftar-ekstra"
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-accent-warm px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Daftar ekstra <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${items.length >= 3 ? 'lg:grid-cols-3' : ''} ${items.length >= 4 ? 'xl:grid-cols-4' : ''}`}>
        {items.map(j => (
          <Link
            key={j.id}
            href={`/daftar-ekstra?jenis=${j.id}`}
            className="group flex min-w-0 flex-col rounded-2xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-accent-warm">
              {LABEL_BIDANG[j.bidang] ?? j.bidang}
            </span>
            <span className="mt-1.5 font-heading text-[22px] leading-snug group-hover:text-primary">{j.nama}</span>
            <span className="mt-3 font-heading text-lg leading-none text-primary">{j.biaya}</span>
            {j.waktu && (
              <span className="mt-3 flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">{j.waktu}</span>
              </span>
            )}
            <span className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-semibold">
              <Users className={`h-3.5 w-3.5 ${j.sisa > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={j.sisa > 0 ? 'text-primary' : 'text-muted-foreground'}>
                {j.sisa > 0 ? `${j.sisa} kursi tersedia` : 'Kuota penuh'}
              </span>
              <span className="ml-auto text-muted-foreground">{j.jadwal} jadwal</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
