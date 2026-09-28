import Link from 'next/link'
import { FileText } from 'lucide-react'
import type { Panduan } from '@/lib/data/panduan-guru'
import {
  LABEL_KATEGORI_PANDUAN, LABEL_SASARAN_PANDUAN, URUTAN_KATEGORI_PANDUAN, ukuranTeks, type KategoriPanduan,
} from '@/lib/rq/panduan-guru'
import { cn } from '@/lib/utils'

/**
 * Daftar dokumen panduan, dikelompokkan per kategori dengan tab. Dipakai
 * portal guru (baca) dan halaman pengurus (baca + hapus lewat `aksi`).
 */
export function DaftarPanduan({ daftar, kategori, hrefKategori, hrefDokumen, aksi, tampilSasaran = false }: {
  daftar: Panduan[]
  kategori: KategoriPanduan | null
  hrefKategori: (k: KategoriPanduan | null) => string
  hrefDokumen: (id: string) => string
  aksi?: (p: Panduan) => React.ReactNode
  tampilSasaran?: boolean
}) {
  const jumlah = (k: KategoriPanduan) => daftar.filter(p => p.kategori === k).length
  const tampil = kategori ? daftar.filter(p => p.kategori === kategori) : daftar
  const tab: { k: KategoriPanduan | null; label: string; n: number }[] = [
    { k: null, label: 'Semua', n: daftar.length },
    ...URUTAN_KATEGORI_PANDUAN.map(k => ({ k, label: LABEL_KATEGORI_PANDUAN[k], n: jumlah(k) })),
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kategori panduan">
        {tab.map(t => (
          <Link
            key={t.k ?? 'semua'}
            href={hrefKategori(t.k)}
            role="tab"
            aria-selected={kategori === t.k}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              kategori === t.k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label} <span className="opacity-70">{t.n}</span>
          </Link>
        ))}
      </div>

      {tampil.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
          Belum ada dokumen{kategori ? ` ${LABEL_KATEGORI_PANDUAN[kategori]}` : ''}.
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {tampil.map(p => (
            <li key={p.id} className="flex items-center gap-2 pr-2">
              <Link href={hrefDokumen(p.id)} className="flex min-w-0 flex-1 items-start gap-3 p-3 hover:bg-muted/40">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">{p.judul}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[
                      LABEL_KATEGORI_PANDUAN[p.kategori],
                      tampilSasaran ? LABEL_SASARAN_PANDUAN[p.sasaran] : null,
                      ukuranTeks(p.file_size),
                      new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }),
                    ].filter(Boolean).join(' · ')}
                  </span>
                  {p.keterangan && <span className="mt-0.5 block text-xs text-muted-foreground">{p.keterangan}</span>}
                </span>
              </Link>
              {aksi?.(p)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Pembaca PDF di tempat, tanpa mengunduh. Peramban desktop menampilkannya
 * langsung; sebagian peramban HP tidak menampilkan PDF di dalam halaman,
 * jadi tombol "Buka di tab baru" selalu ada sebagai jalan kedua.
 */
export function PembacaPdf({ judul, lihat, unduh }: { judul: string; lihat: string; unduh: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href={lihat} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent">
          Buka di tab baru
        </a>
        <a href={unduh}
          className="inline-flex items-center rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
          Unduh PDF
        </a>
      </div>
      <iframe src={`${lihat}#view=FitH`} title={judul} className="h-[75vh] w-full rounded-2xl border bg-card" />
    </div>
  )
}
