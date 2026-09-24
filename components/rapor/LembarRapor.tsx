import { cariSlot, idIsian, ikutHuruf, tebakDariLabel, type KodeMedan, type Slot } from '@/lib/rapor/medan'
import type { Blok, Potongan } from '@/lib/rapor/docx'
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
  /** Url gambar tanda tangan; null = ruangnya dibiarkan kosong untuk ttd basah. */
  ttd?: { pengampu: string | null; koordinator: string | null }
  /** Tulisan guru per isian merah (id slot → teks), sudah termasuk isi awalnya. */
  isian?: Record<string, string>
  /**
   * Cetak halaman bertanda "hanya peserta Riyadhoh". Pratinjau koordinator
   * (tanpa `nilai`) selalu menampilkan semua halaman, berikut labelnya.
   */
  riyadhoh?: boolean
  className?: string
}

const KODE_TTD = ['ttd_pengampu', 'ttd_koordinator', 'ttd_keduanya'] as const
type KodeTtd = (typeof KODE_TTD)[number]

function adalahTtd(kode: KodeMedan | undefined): kode is KodeTtd {
  return (KODE_TTD as readonly string[]).includes(kode ?? '')
}

/**
 * Gambar tanda tangan untuk sebuah spot, berikut posisinya.
 *
 * Yang belum punya gambar tetap mengembalikan satu entri bersrc null: ruangnya
 * harus tetap terbuka supaya bisa ditandatangani basah. Menutupnya karena
 * gambarnya belum diunggah mengembalikan persis masalah yang diperbaiki —
 * nama menempel di bawah jabatan tanpa tempat membubuhkan tanda tangan.
 */
function gambarTtd(kode: KodeTtd, ttd: Props['ttd']): { src: string | null; posisi: 'kiri' | 'kanan' | 'tengah' }[] {
  if (kode === 'ttd_keduanya') {
    return [
      { src: ttd?.koordinator ?? null, posisi: 'kiri' },
      { src: ttd?.pengampu ?? null, posisi: 'kanan' },
    ]
  }
  return [{ src: (kode === 'ttd_pengampu' ? ttd?.pengampu : ttd?.koordinator) ?? null, posisi: 'tengah' }]
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

/**
 * Isi satu potongan merah. Hitam dicetak apa adanya; merah diganti menurut
 * pemetaannya — data sistem, tulisan guru, atau contoh template (pratinjau).
 * Warna merahnya sendiri tidak pernah ikut tercetak: di Word ia penanda
 * "boleh diganti", bukan bagian rapor.
 */
function isiPotongan(
  s: Slot | undefined,
  pemetaan: Record<string, KodeMedan>,
  nilai: Record<KodeMedan, string> | undefined,
  isian: Record<string, string> | undefined,
): string {
  if (!s) return ''
  const kode = pemetaan[s.id] ?? (s.pasti ? s.tebakan : null)
  if (!kode || kode === 'tetap') return s.contoh
  if (kode === 'kosongkan') return ''
  if (kode === 'isian_guru') return isian?.[s.id] ?? (nilai ? '' : s.contoh)
  if (!nilai) return s.contoh
  const v = nilai[kode] ?? ''
  return kode === 'sapaan_pengampu' || kode === 'sapaan_siswa' ? ikutHuruf(s.contoh, v) : v
}

export function LembarRapor({ blok, pemetaan, nilai, tandai, ttd, isian, riyadhoh, className }: Props) {
  // Slot dihitung ulang dari blok yang sama dengan yang dipakai saat memetakan,
  // jadi id-nya pasti cocok — tidak ada daftar slot kedua yang bisa basi.
  const slot = new Map(cariSlot(blok).map(s => [s.id, s]))
  const sorot = (terisi: boolean) => (tandai && terisi ? 'rounded bg-[color:var(--chart-4)]/20 px-0.5' : undefined)

  // Halaman "hanya peserta Riyadhoh" dilewati seluruhnya — sampai penanda
  // halaman berikutnya — bila anak ini tidak ikut. Pratinjau menampilkannya.
  const pratinjau = !nilai
  const disembunyikan = new Set<number>()
  let sembunyi = false
  blok.forEach((b, i) => {
    if (b.jenis === 'halaman') sembunyi = !pratinjau && !riyadhoh && pemetaan[`h${i}`] === 'halaman_riyadhoh'
    if (sembunyi) disembunyikan.add(i)
  })

  const kalimat = (potongan: Potongan[], id: (m: number) => string) => {
    let m = 0
    return potongan.map((p, j) => {
      if (!p.merah) return <span key={j}>{p.teks}</span>
      const teks = isiPotongan(slot.get(id(m++)), pemetaan, nilai, isian)
      return <span key={j} className={sorot(true)}>{teks}</span>
    })
  }

  return (
    <div className={cn('rapor-sheet space-y-2 bg-white p-8 text-[11pt] leading-relaxed text-black', className)}>
      {blok.map((b, i) => {
        if (disembunyikan.has(i)) return null

        if (b.jenis === 'halaman') {
          const khusus = pemetaan[`h${i}`] === 'halaman_riyadhoh'
          return (
            <div key={i} className="rapor-halaman relative my-6 border-t-2 border-dashed border-neutral-300 print:my-0 print:border-0">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-[9pt] text-neutral-500 print:hidden">
                halaman baru{khusus && pratinjau ? ' · hanya dicetak untuk peserta Riyadhoh' : ''}
              </span>
            </div>
          )
        }
        // Jeda: ruang kosong yang memang ditulis di template. Tingginya
        // dipertahankan supaya jarak antarbagian sama dengan berkas Word —
        // dan bila ia dipetakan sebagai ruang tanda tangan, gambarnya
        // diletakkan di dalam ruang itu tanpa mengubah tingginya.
        if (b.jenis === 'jeda') {
          const kode = pemetaan[`j${i}`]
          const tinggi = `${(b.baris * 1.6).toFixed(1)}em`
          if (!adalahTtd(kode)) return <div key={i} aria-hidden style={{ height: tinggi }} />
          return (
            <div key={i} className="flex items-end justify-between gap-6" style={{ minHeight: tinggi }}>
              {gambarTtd(kode, ttd).map((g, j) => (
                <span key={j} className={cn('flex-1', g.posisi === 'kanan' && 'text-right', g.posisi === 'tengah' && 'text-center')}>
                  {g.src
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={g.src} alt="" className="inline-block max-h-[3.4em] max-w-[160px] object-contain" />
                    : <span className={sorot(true)} />}
                </span>
              ))}
            </div>
          )
        }

        if (b.jenis === 'kotak' && b.potongan?.some(Boolean)) {
          return (
            <div key={i} className="my-3 border border-black p-4">
              {b.paragraf.map((teks, pk) => {
                const pot = b.potongan?.[pk]
                // Paragraf pertama tanpa isian yang berbunyi seperti judul
                // ("DESKRIPSI PERKEMBANGAN AL-QUR'AN") dicetak sebagai judul kotak.
                if (!pot && pk === 0 && teks.length <= 60 && teks === teks.toUpperCase()) {
                  return <p key={pk} className="mb-2 text-center font-bold">{teks}</p>
                }
                return (
                  <p key={pk} className="text-justify">
                    {pot ? kalimat(pot, m => idIsian(i, pk, m)) : teks}
                  </p>
                )
              })}
            </div>
          )
        }

        if (b.jenis === 'kotak') {
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
                      const kode = pemetaan[id]
                      // Tanda tangan di dalam sel diletakkan DI ATAS teksnya,
                      // bukan menggantikannya: yang tertulis di sel itu nama
                      // dan NIY penanda tangannya.
                      if (!kepala && adalahTtd(kode)) {
                        return (
                          <td key={c} className="border border-black px-2 py-1 text-center">
                            <span className="flex h-[3.6em] items-end justify-center">
                              {gambarTtd(kode, ttd)[0].src
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={gambarTtd(kode, ttd)[0].src!} alt="" className="max-h-[3.4em] max-w-[160px] object-contain" />
                                : null}
                            </span>
                            <span className={sorot(true)}>{sel || ' '}</span>
                          </td>
                        )
                      }
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

        // Kalimat berisian merah — dipetakan per potongan oleh cariSlot.
        if (b.potongan && slot.has(idIsian(i, null, 0))) {
          return (
            <p key={i} className={cn(rataKelas, b.tebal && 'font-bold')}>
              {kalimat(b.potongan, m => idIsian(i, null, m))}
            </p>
          )
        }

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
          // Slot berawalan ("Dikeluarkan di : Bantul") menyimpan nilainya saja
          // sebagai contoh. Memakai segmen utuh di sini mencetak labelnya dua
          // kali di pratinjau: "Dikeluarkan di : Dikeluarkan di : Bantul".
          const sl = slot.get(`p${i}.${s}`)
          const { teks, terisi } = isiSlot(`p${i}.${s}`, sl?.prefiks ? sl.contoh : b.segmen[s], sl?.prefiks ?? '', pemetaan, nilai)
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
              const sl = slot.get(`p${i}.${s}`)
              const { teks, terisi } = isiSlot(`p${i}.${s}`, sl?.prefiks ? sl.contoh : seg, sl?.prefiks ?? '', pemetaan, nilai)
              return <span key={s} className={sorot(terisi)}>{teks}</span>
            })}
          </div>
        )
      })}
    </div>
  )
}
