import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cariSlot, idIsian, ikutHuruf, tebakDariLabel, type KodeMedan, type Slot } from '@/lib/rapor/medan'
import { kertasDari, type Blok, type BlokKertas, type Hias, type Potongan } from '@/lib/rapor/docx'
import { TUNGGAL, type Garis, type Tata } from '@/lib/rapor/tata'
import { cn } from '@/lib/utils'
import { SkalaMuat } from '@/components/rapor/SkalaMuat'

/**
 * Lembar rapor — hasil terjemahan template Word koordinator.
 *
 * Dua bentuk, menurut kapan templatenya dibaca:
 *
 * - Template yang dibaca dengan tata letak (ada blok `kertas`) dicetak
 *   menyerupai berkas Word-nya: ukuran kertas, margin, kop surat di belakang
 *   teks, jarak & inden tiap paragraf, lebar kolom tabel dan warna selnya.
 *   Tiap halaman Word menjadi satu lembar sendiri.
 * - Template lama tanpa tata letak memakai lembar A4 sistem: yang dijaga
 *   hanya tiap bagian ada, berurutan, dan terisi data yang benar.
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
  /** Url kop surat per path penyimpanan (lihat urlLatar). Kosong = tanpa kop. */
  latar?: Record<string, string | null>
  /**
   * Perkecil tiap halaman supaya muat utuh di layar (pratinjau koordinator).
   * Hanya berlaku di layar dan hanya untuk lembar ber-tata-letak Word.
   */
  muat?: boolean
  className?: string
}

const KODE_TTD = ['ttd_pengampu', 'ttd_koordinator', 'ttd_keduanya'] as const
type KodeTtd = (typeof KODE_TTD)[number]

function adalahTtd(kode: KodeMedan | undefined): kode is KodeTtd {
  return (KODE_TTD as readonly string[]).includes(kode ?? '')
}

const pt = (n: number | undefined) => (n ? `${+n.toFixed(2)}pt` : undefined)

/**
 * Tata paragraf Word → CSS.
 *
 * Jarak tegak memakai padding, bukan margin: margin CSS bersebelahan saling
 * melebur (yang terbesar menang), sedangkan Word menjumlahkan "sesudah"
 * paragraf atas dengan "sebelum" paragraf bawah. Inden memakai margin supaya
 * boleh negatif. `baris: false` untuk baris berkolom (flex), yang tidak
 * mengenal text-indent — inden baris pertamanya dijadikan geser kiri.
 */
function gayaTata(t: Tata | undefined, opsi: { flex?: boolean } = {}): CSSProperties | undefined {
  if (!t) return undefined
  const kiri = (t.kiri ?? 0) + (opsi.flex ? (t.awal ?? 0) : 0)
  return {
    paddingTop: pt(t.sebelum),
    paddingBottom: pt(t.sesudah),
    marginLeft: pt(kiri),
    marginRight: pt(t.kanan),
    textIndent: opsi.flex ? undefined : pt(t.awal),
    fontSize: pt(t.ukuran),
    lineHeight: t.barisPt
      ? pt(t.barisPt)
      : t.barisMin
        ? `max(${TUNGGAL}em, ${t.barisMin}pt)`
        : String(+(TUNGGAL * (t.baris ?? 1)).toFixed(3)),
  }
}

/** Tebal / miring / garis bawah dari template Word → kelas CSS. */
function kelasHias(h: Hias | null | undefined): string | undefined {
  return h ? cn(h.b && 'font-bold', h.i && 'italic', h.u && 'underline decoration-1 underline-offset-2') || undefined : undefined
}

/**
 * Garis gambar Word (Insert → Shapes → Line) di atas paragraf jangkarnya.
 * Pembungkusnya harus `relative` dan selebar bidang tulis: `kiri` diukur
 * dari margin kiri, `atas` dari atas paragraf.
 */
function gambarGaris(garis: Garis[] | undefined): ReactNode {
  return garis?.map((g, k) => {
    const tegak = g.tinggi > g.lebar
    return (
      <span
        key={k}
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: `${g.kiri}pt`,
          top: `${g.atas}pt`,
          width: tegak ? 0 : `${g.lebar}pt`,
          height: tegak ? `${g.tinggi}pt` : 0,
          [tegak ? 'borderLeft' : 'borderTop']: `${g.tebal}pt solid ${g.warna}`,
        }}
      />
    )
  })
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

export function LembarRapor({ blok, pemetaan, nilai, tandai, ttd, isian, riyadhoh, latar, muat, className }: Props) {
  // Slot dihitung ulang dari blok yang sama dengan yang dipakai saat memetakan,
  // jadi id-nya pasti cocok — tidak ada daftar slot kedua yang bisa basi.
  const slot = new Map(cariSlot(blok).map(s => [s.id, s]))
  const sorot = (terisi: boolean) => (tandai && terisi ? 'rounded bg-[color:var(--chart-4)]/20 px-0.5' : undefined)
  const kertas = kertasDari(blok)

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
      if (!p.merah) {
        if (p.bagian) return <span key={j}>{p.bagian.map((g, k) => <span key={k} className={kelasHias(g)}>{g.teks}</span>)}</span>
        return <span key={j} className={kelasHias(p.hias)}>{p.teks}</span>
      }
      // Data pengganti tercetak dengan hiasan isian merah yang digantikannya.
      const teks = isiPotongan(slot.get(id(m++)), pemetaan, nilai, isian)
      return <span key={j} className={cn(sorot(true), kelasHias(p.hias))}>{teks}</span>
    })
  }

  const gambarBlok = (b: Blok, i: number): ReactNode => {
    if (b.jenis === 'kertas') return null

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
      const tinggi = b.tinggi !== undefined ? `${b.tinggi.toFixed(1)}pt` : `${(b.baris * 1.6).toFixed(1)}em`
      if (!adalahTtd(kode)) {
        return <div key={i} aria-hidden className={cn(b.garis && 'relative')} style={{ height: tinggi }}>{gambarGaris(b.garis)}</div>
      }
      return (
        <div key={i} className="relative flex items-end justify-between gap-6" style={{ minHeight: tinggi }}>
          {gambarGaris(b.garis)}
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

    if (b.jenis === 'kotak') {
      // Bingkai Word: lebar, geser, dan tinggi kotak persis. Tingginya
      // tinggi minimum — deskripsi yang lebih panjang memanjangkan kotak,
      // bukan terpotong seperti di Word.
      const bingkai = b.bingkai
      const gayaKotak: CSSProperties | undefined = bingkai && {
        width: pt(bingkai.lebar),
        maxWidth: '100%',
        minHeight: pt(bingkai.tinggi),
        marginLeft: pt(bingkai.kiri),
        marginTop: pt(bingkai.atas),
        border: bingkai.garis ? `${Math.max(bingkai.garis, 0.5)}pt solid black` : 'none',
        padding: bingkai.isi.map(n => `${n}pt`).join(' '),
      }
      const kelasKotak = bingkai ? undefined : 'my-3 border border-black p-4'
      const tataP = (pk: number) => gayaTata(b.tataParagraf?.[pk])

      if (b.potongan?.some(Boolean)) {
        return (
          <div key={i} className={kelasKotak} style={gayaKotak}>
            {b.paragraf.map((teks, pk) => {
              const pot = b.potongan?.[pk]
              // Paragraf pertama tanpa isian yang berbunyi seperti judul
              // ("DESKRIPSI PERKEMBANGAN AL-QUR'AN") dicetak sebagai judul kotak.
              if (!pot && pk === 0 && teks.length <= 60 && teks === teks.toUpperCase()) {
                return <p key={pk} className={cn('text-center font-bold', !bingkai && 'mb-2')} style={tataP(pk)}>{teks}</p>
              }
              return (
                <p key={pk} className="text-justify" style={tataP(pk)}>
                  {pot ? kalimat(pot, m => idIsian(i, pk, m)) : teks}
                </p>
              )
            })}
          </div>
        )
      }

      const adaJudul = tebakDariLabel(b.paragraf[0] ?? '') !== null && (b.paragraf[0]?.length ?? 0) <= 60
      const { teks, terisi } = isiSlot(`k${i}`, (adaJudul ? b.paragraf.slice(1) : b.paragraf).join('\n'), '', pemetaan, nilai)
      const isiMulai = adaJudul ? 1 : 0
      return (
        <div key={i} className={kelasKotak} style={gayaKotak}>
          {adaJudul && <p className={cn('text-center font-bold', !bingkai && 'mb-2')} style={tataP(0)}>{b.paragraf[0]}</p>}
          <div className={cn(!bingkai && 'space-y-2', 'text-justify', sorot(terisi))}>
            {(teks || ' ').split('\n').map((p, j) => <p key={j} style={tataP(isiMulai + j) ?? tataP(isiMulai)}>{p}</p>)}
          </div>
        </div>
      )
    }

    if (b.jenis === 'tabel') {
      const t = b.tata
      const lebar = t?.kolom?.reduce((a, c) => a + c, 0)
      const garis = t?.tanpaGaris ? 'border-0' : 'border border-black'
      return (
        <table
          key={i}
          className={cn(t ? 'rapor-table-word' : 'rapor-table my-3 w-full', 'border-collapse')}
          style={t && {
            tableLayout: t.kolom ? 'fixed' : undefined,
            width: pt(lebar),
            // Aturan cetak umum memaksa setiap tabel selebar halaman; lembar
            // Word memulihkan lebar aslinya dari variabel ini (globals.css).
            ['--lebar-tabel' as string]: pt(lebar) ?? 'auto',
            maxWidth: '100%',
            marginLeft: pt(t.geser),
            fontSize: pt(t.ukuran),
            lineHeight: TUNGGAL,
          }}
        >
          {t?.kolom && <colgroup>{t.kolom.map((w, c) => <col key={c} style={{ width: pt(w) }} />)}</colgroup>}
          <tbody>
            {b.baris.map((baris, r) => (
              <tr key={r} style={t?.tinggiBaris?.[r] ? { height: pt(t.tinggiBaris[r]) } : undefined}>
                {baris.map((sel, c) => {
                  const id = `t${i}.${r}.${c}`
                  const kepala = r === 0 && b.baris.length > 1
                  const kode = pemetaan[id]
                  const tebal = t?.tebal?.[r]?.[c] ?? kepala
                  const warna = t?.latar?.[r]?.[c]
                  // Warna sel lewat variabel juga: mode gelap mengosongkan
                  // semua latar saat mencetak, dan lembar Word memulihkannya.
                  const gayaSel: CSSProperties | undefined = warna
                    ? { backgroundColor: warna, ['--latar-sel' as string]: warna }
                    : undefined
                  const kelasSel = cn(garis, t ? 'px-[2pt] py-0 align-middle' : 'px-2 py-1', 'text-center', tebal && 'font-bold')
                  // Tanda tangan di dalam sel diletakkan DI ATAS teksnya,
                  // bukan menggantikannya: yang tertulis di sel itu nama
                  // dan NIY penanda tangannya.
                  if (!kepala && adalahTtd(kode)) {
                    const src = gambarTtd(kode, ttd)[0].src
                    return (
                      <td key={c} className={kelasSel} style={gayaSel}>
                        <span className="flex h-[3.6em] items-end justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {src ? <img src={src} alt="" className="max-h-[3.4em] max-w-[160px] object-contain" /> : null}
                        </span>
                        <span className={cn(sorot(true), kelasHias(t?.hiasSel?.[r]?.[c]?.find(Boolean)))}>{sel || ' '}</span>
                      </td>
                    )
                  }
                  const { teks, terisi } = kepala
                    ? { teks: sel, terisi: false }
                    : isiSlot(id, sel, '', pemetaan, nilai)
                  // Teks template yang tidak diganti dicetak per paragraf
                  // selnya: "nama" dan "NIY" dua baris, Enter kosong tetap ruang.
                  const paragraf = t?.paragrafSel?.[r]?.[c]
                  const jarak = pt(t?.jarakSel?.[r]?.[c])
                  const hiasP = t?.hiasSel?.[r]?.[c]
                  // Satu baris (atau diganti data): hiasan paragraf pertama yang berhias.
                  const hiasSatu = hiasP?.find(Boolean) ?? null
                  return (
                    <td key={c} className={kelasSel} style={gayaSel} data-latar={warna ? '' : undefined}>
                      {teks === sel && paragraf && paragraf.length > 1 ? (
                        <span className={cn('block', sorot(terisi))}>
                          {paragraf.map((p, k) => <span key={k} className={cn('block', kelasHias(hiasP?.[k]))} style={{ paddingTop: jarak }}>{p || ' '}</span>)}
                        </span>
                      ) : (
                        <span className={cn(sorot(terisi), jarak && 'block', kelasHias(hiasSatu))} style={jarak ? { paddingTop: jarak } : undefined}>{teks || ' '}</span>
                      )}
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

    // Paragraf berjangkar garis gambar dibungkus supaya garisnya bisa
    // diletakkan relatif terhadap paragraf itu.
    const bungkus = (el: ReactElement) => (b.garis ? <div key={i} className="relative">{el}{gambarGaris(b.garis)}</div> : el)
    const h = b.hias

    const rataKelas =
      b.rata === 'tengah' ? 'text-center' : b.rata === 'kanan' ? 'text-right' : b.rata === 'rata' ? 'text-justify' : ''
    const t = b.tata

    // Kalimat berisian merah — dipetakan per potongan oleh cariSlot.
    if (b.potongan && slot.has(idIsian(i, null, 0))) {
      return bungkus(
        <p key={i} className={cn(rataKelas, b.tebal && 'font-bold')} style={gayaTata(t)}>
          {kalimat(b.potongan, m => idIsian(i, null, m))}
        </p>,
      )
    }

    // Baris identitas ("Nilai Tahsin" ⇥ ": 91,5"): label berkolom tetap
    // supaya seluruh titik duanya lurus, persis seperti tab-stop Word. Bila
    // tab-stopnya terbaca, lebar label = jarak tab-stop dari inden kiri.
    const barisIdentitas = b.segmen.some(s => s.startsWith(':'))
    if (barisIdentitas) {
      const iLabel = b.segmen.findIndex(Boolean)
      const label = b.segmen[iLabel] ?? ''
      const iNilai = b.segmen.findIndex(s => s.startsWith(':'))
      const { teks, terisi } = isiSlot(`p${i}.${iNilai}`, b.segmen[iNilai].replace(/^:\s*/, ''), ': ', pemetaan, nilai)
      const lebarLabel = t?.tab !== undefined ? t.tab - (t.kiri ?? 0) - (t.awal ?? 0) : undefined
      return bungkus(
        <div key={i} className={cn('flex', !t && 'gap-1', b.tebal && 'font-bold')} style={gayaTata(t, { flex: true })}>
          <span className={cn('shrink-0', lebarLabel === undefined && 'w-[42%]', kelasHias(h?.[iLabel]))} 
            // Padding di DALAM min-width (border-box): label yang muat tetap
            // berhenti tepat di tab-stop; label yang kelebihan — Word lalu
            // melompat ke tab-stop berikutnya — tidak menempel ke titik dua.
            style={lebarLabel ? { minWidth: pt(lebarLabel), paddingRight: '0.5em' } : undefined}>
            {label}
          </span>
          <span className={cn(sorot(terisi), kelasHias(h?.[iNilai]))}>{teks}</span>
        </div>,
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
      return bungkus(
        <p key={i} className={cn(rataKelas, b.tebal && 'font-bold')} style={gayaTata(t)}>
          <span className={cn(sorot(terisi), kelasHias(h?.[s]))}>{teks}</span>
        </p>,
      )
    }

    // Beberapa segmen tanpa titik dua: blok berkolom — tanda tangan.
    return bungkus(
      <div key={i} className={cn('flex justify-between gap-6', b.tebal && 'font-bold')} style={gayaTata(t, { flex: true })}>
        {b.segmen.map((seg, s) => {
          if (!seg) return null
          const sl = slot.get(`p${i}.${s}`)
          const { teks, terisi } = isiSlot(`p${i}.${s}`, sl?.prefiks ? sl.contoh : seg, sl?.prefiks ?? '', pemetaan, nilai)
          return <span key={s} className={cn(sorot(terisi), kelasHias(h?.[s]))}>{teks}</span>
        })}
      </div>,
    )
  }

  if (kertas) {
    return (
      <LembarKertas
        blok={blok}
        kertas={kertas}
        latar={latar}
        disembunyikan={disembunyikan}
        label={i => (pratinjau && pemetaan[`h${i}`] === 'halaman_riyadhoh' ? 'Halaman berikut hanya dicetak untuk peserta Riyadhoh' : null)}
        gambarBlok={gambarBlok}
        pemetaan={pemetaan}
        muat={muat}
        className={className}
      />
    )
  }

  return (
    <div className={cn('rapor-sheet space-y-2 bg-white p-8 text-[11pt] leading-relaxed text-black', className)}>
      {blok.map((b, i) => (disembunyikan.has(i) ? null : gambarBlok(b, i)))}
    </div>
  )
}

/**
 * Lembar dengan tata letak Word: satu <section> per halaman template,
 * seukuran kertasnya, dengan kop surat di belakang teks.
 *
 * Tinggi halaman adalah tinggi MINIMUM. Isi yang lebih panjang dari
 * templatenya (deskripsi yang panjang) memanjangkan lembar dan tumpah ke
 * kertas berikutnya saat dicetak — terlihat, bukan diam-diam terpotong.
 */
function LembarKertas({
  blok, kertas, latar, disembunyikan, label, gambarBlok, pemetaan, muat, className,
}: {
  blok: Blok[]
  kertas: BlokKertas
  latar: Props['latar']
  disembunyikan: Set<number>
  label: (iHalaman: number) => string | null
  gambarBlok: (b: Blok, i: number) => ReactNode
  pemetaan: Record<string, KodeMedan>
  muat?: boolean
  className?: string
}) {
  const { lebar, tinggi, margin, huruf } = kertas.kertas

  // Pecah blok menjadi halaman di tiap penanda halaman.
  const halaman: { mulai: number; isi: number[] }[] = [{ mulai: -1, isi: [] }]
  blok.forEach((b, i) => {
    if (b.jenis === 'kertas') return
    if (b.jenis === 'halaman') halaman.push({ mulai: i, isi: [] })
    else halaman[halaman.length - 1].isi.push(i)
  })

  // Jeda di ujung halaman hanya sisa Enter; di Word ia tidak terlihat,
  // di sini ia bisa mendorong lembar melewati tinggi kertasnya.
  for (const h of halaman) {
    while (h.isi.length > 0) {
      const akhir = h.isi[h.isi.length - 1]
      if (blok[akhir].jenis !== 'jeda' || adalahTtd(pemetaan[`j${akhir}`])) break
      h.isi.pop()
    }
  }

  const ukuran = `${lebar}pt ${tinggi}pt`
  return (
    <div className={cn('rapor-sheet rapor-sheet-word space-y-6 print:space-y-0', className)}>
      {/* Ukuran kertas cetak mengikuti template (F4 di template ATS SMP),
          margin 0 karena margin Word sudah ada di padding lembarnya. */}
      <style>{`@media print { @page { size: ${ukuran}; margin: 0; } }`}</style>
      {halaman.map((h, k) => {
        if (h.mulai >= 0 && disembunyikan.has(h.mulai)) return null
        const l = kertas.latar[k]
        const src = l ? latar?.[l.src] : null
        const teksLabel = h.mulai >= 0 ? label(h.mulai) : null
        const lembar = (
            <section
              className="rapor-kertas relative mx-auto overflow-hidden bg-white text-black shadow-sm ring-1 ring-black/5 print:shadow-none print:ring-0"
              style={{
                width: `${lebar}pt`,
                minHeight: `${tinggi}pt`,
                padding: margin.map(n => `${n}pt`).join(' '),
                fontFamily: huruf ? `"${huruf}", serif` : undefined,
                fontSize: '11pt',
                lineHeight: TUNGGAL,
                ['--tinggi-kertas' as string]: `${tinggi}pt`,
              }}
            >
              {l && src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{ left: `${l.x}pt`, top: `${l.y}pt`, width: `${l.lebar}pt`, height: `${l.tinggi}pt` }}
                />
              )}
              <div className="relative">{h.isi.map(i => gambarBlok(blok[i], i))}</div>
            </section>
        )
        return (
          <div key={k} className={cn(!muat && 'overflow-x-auto', 'print:overflow-visible')}>
            {teksLabel && <p className="mb-1 text-center text-xs text-muted-foreground print:hidden">{teksLabel}</p>}
            {muat ? <SkalaMuat>{lembar}</SkalaMuat> : lembar}
          </div>
        )
      })}
    </div>
  )
}
