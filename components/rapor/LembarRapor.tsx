import { cariSlot, tebakDariLabel, type KodeMedan } from '@/lib/rapor/medan'
import type { Blok } from '@/lib/rapor/docx'
import { cn } from '@/lib/utils'

/**
 * Lembar rapor A4 — hasil terjemahan template Word koordinator.
 *
 * Yang diambil dari Word adalah ISI dan URUTANNYA, bukan tipografinya: font,
 * ukuran huruf, dan posisi kotak diurus CSS cetak sistem (.rapor-sheet di
 * app/globals.css). Hasilnya tidak identik dengan berkas aslinya, dan memang
 * tidak diniatkan begitu — yang dijaga adalah tiap bagian ada, berurutan, dan
 * terisi data yang benar.
 *
 * PDF dibuat lewat cetak peramban, sama seperti rapor KPI dan Laporan Orang
 * Tua. Tidak ada LibreOffice di Vercel yang bisa mengubah .docx menjadi PDF.
 */

interface Props {
  blok: Blok[]
  pemetaan: Record<string, KodeMedan>
  /** Isi per kode medan. Kosong = pratinjau, template ditampilkan apa adanya. */
  nilai?: Record<KodeMedan, string>
  /** Tandai slot yang terpetakan dengan latar kuning — hanya untuk pratinjau. */
  tandai?: boolean
  className?: string
}

/** Isi sebuah slot: teks template, data, atau kosong. */
function isiSlot(
  slotId: string,
  asli: string,
  prefiks: string,
  pemetaan: Record<string, KodeMedan>,
  nilai: Record<KodeMedan, string> | undefined,
): { teks: string; terisi: boolean } {
  const kode = pemetaan[slotId]
  if (!kode || kode === 'tetap') return { teks: prefiks + asli, terisi: false }
  if (kode === 'kosongkan') return { teks: prefiks.trimEnd(), terisi: true }
  // Tanpa data (pratinjau koordinator) contoh dari template dibiarkan tampil,
  // supaya lembarnya terbaca sebagai rapor dan bukan sebagai formulir kosong.
  if (!nilai) return { teks: prefiks + asli, terisi: true }
  return { teks: prefiks + (nilai[kode] ?? ''), terisi: true }
}

export function LembarRapor({ blok, pemetaan, nilai, tandai, className }: Props) {
  // Slot dihitung ulang dari blok yang sama dengan yang dipakai saat memetakan,
  // jadi id-nya pasti cocok — tidak ada daftar slot kedua yang bisa basi.
  const slot = new Map(cariSlot(blok).map(s => [s.id, s]))
  const sorot = (terisi: boolean) => (tandai && terisi ? 'rounded bg-[color:var(--chart-4)]/20 px-0.5' : undefined)

  return (
    <div className={cn('rapor-sheet space-y-2 bg-white p-8 text-[11pt] leading-relaxed text-black', className)}>
      {blok.map((b, i) => {
        if (b.jenis === 'kotak') {
          const s = slot.get(`k${i}`)
          const adaJudul = tebakDariLabel(b.paragraf[0] ?? '') !== null && (b.paragraf[0]?.length ?? 0) <= 60
          const { teks, terisi } = isiSlot(`k${i}`, (adaJudul ? b.paragraf.slice(1) : b.paragraf).join('\n'), '', pemetaan, nilai)
          return (
            <div key={i} className="my-3 border border-black p-4">
              {adaJudul && <p className="mb-2 text-center font-bold">{b.paragraf[0]}</p>}
              <div className={cn('space-y-2 text-justify', sorot(terisi))}>
                {(teks || ' ').split('\n').map((p, j) => <p key={j}>{p}</p>)}
              </div>
            </div>
          )
        }

        if (b.jenis === 'tabel') {
          return (
            <table key={i} className="rapor-table my-3 w-full border-collapse">
              <tbody>
                {b.baris.map((baris, r) => (
                  <tr key={r}>
                    {baris.map((sel, c) => {
                      const id = `t${i}.${r}.${c}`
                      const kepala = r === 0 && b.baris.length > 1
                      const { teks, terisi } = kepala
                        ? { teks: sel, terisi: false }
                        : isiSlot(id, sel, '', pemetaan, nilai)
                      return (
                        <td key={c} className={cn('border border-black px-2 py-1 text-center', kepala && 'font-bold')}>
                          <span className={sorot(terisi)}>{teks || ' '}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }

        const berisi = b.segmen.filter(Boolean)
        if (berisi.length === 0) return <p key={i}>&nbsp;</p>

        const rataKelas =
          b.rata === 'tengah' ? 'text-center' : b.rata === 'kanan' ? 'text-right' : b.rata === 'rata' ? 'text-justify' : ''

        // Baris identitas ("Nilai Tahsin" ⇥ ": 91,5"): label berkolom tetap
        // supaya seluruh titik duanya lurus, persis seperti tab-stop Word.
        const barisIdentitas = b.segmen.some(s => s.startsWith(':'))
        if (barisIdentitas) {
          const label = b.segmen.find(Boolean) ?? ''
          const iNilai = b.segmen.findIndex(s => s.startsWith(':'))
          const { teks, terisi } = isiSlot(`p${i}.${iNilai}`, b.segmen[iNilai].replace(/^:\s*/, ''), ': ', pemetaan, nilai)
          return (
            <div key={i} className="flex gap-1">
              <span className="w-[42%] shrink-0">{label}</span>
              <span className={sorot(terisi)}>{teks}</span>
            </div>
          )
        }

        // Satu segmen: paragraf biasa (judul, salam, isi surat).
        if (berisi.length === 1) {
          const s = b.segmen.findIndex(Boolean)
          const { teks, terisi } = isiSlot(`p${i}.${s}`, b.segmen[s], slot.get(`p${i}.${s}`)?.prefiks ?? '', pemetaan, nilai)
          return (
            <p key={i} className={cn(rataKelas, b.tebal && 'font-bold')}>
              <span className={sorot(terisi)}>{teks}</span>
            </p>
          )
        }

        // Beberapa segmen tanpa titik dua: blok berkolom — tanda tangan.
        return (
          <div key={i} className={cn('flex justify-between gap-6', b.tebal && 'font-bold')}>
            {b.segmen.map((seg, s) => {
              if (!seg) return null
              const { teks, terisi } = isiSlot(`p${i}.${s}`, seg, slot.get(`p${i}.${s}`)?.prefiks ?? '', pemetaan, nilai)
              return <span key={s} className={sorot(terisi)}>{teks}</span>
            })}
          </div>
        )
      })}
    </div>
  )
}
