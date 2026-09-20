'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, FileDown, Link2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { teksWaLaporanOrtu, type LaporanOrtu } from '@/lib/rq/laporan-ortu'

/**
 * Tombol unduh PDF + kotak pesan WhatsApp untuk laporan orang tua satu sesi.
 *
 * PDF dibuat lewat cetak peramban ("Simpan sebagai PDF"), sama seperti rapor
 * dan laporan keuangan — tanpa pustaka PDF. Judul dokumen diganti sementara
 * saat mencetak karena peramban memakainya sebagai nama berkas PDF.
 */
export function TombolUnduhPdf({ namaBerkas }: { namaBerkas: string }) {
  function cetak() {
    const judulAsli = document.title
    document.title = namaBerkas
    const pulihkan = () => { document.title = judulAsli; window.removeEventListener('afterprint', pulihkan) }
    window.addEventListener('afterprint', pulihkan)
    window.print()
  }
  return (
    <Button type="button" onClick={cetak}>
      <FileDown className="mr-1.5 h-4 w-4" />Unduh PDF
    </Button>
  )
}

/**
 * Kotak pesan WhatsApp untuk grup wali.
 *
 * `tautan` adalah alamat publik laporan ini (/laporan/[token]) — sama polanya
 * dengan rapor per anak. Ia ditandatangani di server, jadi tak bisa ditebak,
 * dan tanggalnya dibekukan supaya tautan yang sama tetap menampilkan laporan
 * yang sama bulan depan.
 */
export function PesanWaLaporanOrtu({ laporan, tautan }: { laporan: LaporanOrtu; tautan: string }) {
  const [rincian, setRincian] = useState(true)
  const [sertakanTautan, setSertakanTautan] = useState(true)
  const [pesan, setPesan] = useState('')
  const dasar = useMemo(
    () => teksWaLaporanOrtu(laporan, { rincian, pesan, tautan: sertakanTautan ? tautan : undefined }),
    [laporan, rincian, pesan, sertakanTautan, tautan],
  )
  // Teks boleh disunting guru. Suntingan disimpan terpisah dan dibuang saat
  // opsi diubah — teksnya lalu disusun ulang dari awal.
  const [suntingan, setSuntingan] = useState<string | null>(null)
  const teks = suntingan ?? dasar
  const [tersalin, setTersalin] = useState<'teks' | 'tautan' | null>(null)

  async function salin(apa: 'teks' | 'tautan') {
    try {
      await navigator.clipboard.writeText(apa === 'teks' ? teks : tautan)
      setTersalin(apa)
      setTimeout(() => setTersalin(null), 2500)
    } catch {
      // Clipboard ditolak (non-HTTPS / izin): teks tetap bisa disalin manual.
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 print:hidden">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4" /> Pesan WhatsApp untuk Ayah/Bunda</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Kirim ke grup wali sesi ini. Teks di bawah boleh disunting sebelum disalin.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={rincian} onChange={e => { setRincian(e.target.checked); setSuntingan(null) }} className="h-4 w-4 accent-[var(--primary)]" />
          Sertakan rincian per anak
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={sertakanTautan} onChange={e => { setSertakanTautan(e.target.checked); setSuntingan(null) }} className="h-4 w-4 accent-[var(--primary)]" />
          Sertakan tautan laporan
        </label>
      </div>

      {/* Tautan yang sama dengan yang masuk ke pesan — untuk ditempel ke
          tempat lain, mis. japri ke satu wali. */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{tautan}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => salin('tautan')}>
          {tersalin === 'tautan'
            ? <><Check className="mr-1.5 h-3.5 w-3.5 text-success" /> Tersalin</>
            : <><Copy className="mr-1.5 h-3.5 w-3.5" /> Salin link</>}
        </Button>
      </div>
      <textarea
        value={pesan}
        onChange={e => { setPesan(e.target.value); setSuntingan(null) }}
        rows={2}
        placeholder="Pesan tambahan dari Ustadz/Ustadzah (opsional), mis. pengingat muroja'ah atau agenda pekan depan…"
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <textarea
        value={teks}
        onChange={e => setSuntingan(e.target.value)}
        rows={14}
        aria-label="Teks pesan WhatsApp"
        className={cn('w-full resize-y rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs outline-none')}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={() => salin('teks')}>
          {tersalin === 'teks'
            ? <><Check className="mr-1.5 h-4 w-4 text-success" /> Tersalin</>
            : <><Copy className="mr-1.5 h-4 w-4" /> Salin teks</>}
        </Button>
        <Button asChild style={{ background: '#25d366', borderColor: '#25d366', color: 'white' }}>
          <a href={`https://wa.me/?text=${encodeURIComponent(teks)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1.5 h-4 w-4" /> Buka WhatsApp
          </a>
        </Button>
      </div>
    </section>
  )
}
