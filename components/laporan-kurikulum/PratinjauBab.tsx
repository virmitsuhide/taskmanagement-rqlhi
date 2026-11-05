import type { LaporanModel, TabelModel } from '@/lib/laporan-kurikulum/susun'

/**
 * Pratinjau Bab 02 — render HTML dari LaporanModel yang sama dengan berkas
 * .docx, jadi yang dibaca Kepala RQ di sini adalah yang akan sampai ke BPH.
 * Tetap Server Component: diagram berupa SVG inline, ikut tercetak.
 *
 * Memakai lembar yang sama dengan Laporan Keuangan bendahara (`.report-sheet`
 * di globals.css): Arial, pita bab navy bernomor emas, judul bergaris kiri
 * emas, tabel berkepala navy, kotak catatan biru/hijau/emas — sehingga Bab 01
 * dan Bab 02 tercetak seragam. Hanya kartu KPI & gambar yang punya kelas
 * `.bab02-*` sendiri.
 */
export function PratinjauBab({ m }: { m: LaporanModel }) {
  let nomorDiagram = 0
  // "02  LAPORAN KURIKULUM …" → nomor di kotak emas, judul di pita navy.
  const [, nomorBab = '02', judulBab = m.judulBab] = m.judulBab.match(/^(\d+)\s+(.*)$/) ?? []
  return (
    <article className="report-sheet mx-auto max-w-[900px] border shadow-sm print:max-w-none print:border-0 print:shadow-none">
      <div className="report-isi">
        <div className="report-band">
          <div className="num">{nomorBab}</div>
          <div className="title">
            <strong>{judulBab}</strong>
            <em>{m.subjudul}</em>
          </div>
        </div>
        <p className="bab02-acuan">{m.acuan}</p>

        <H besar>Ringkasan Eksekutif</H>
        <div className="bab02-kpi">
          {m.kpi.map(k => (
            <div key={k.label}>
              <b>{k.nilai}</b>
              <span>{k.label}</span>
              <em>{k.keterangan}</em>
            </div>
          ))}
        </div>
        <Kotak judul="Sorotan Capaian" isi={m.sorotan} varian="green" />
        <Kotak judul="Perhatian Utama" isi={m.perhatian} varian="gold" />

        {m.sub.map(s => (
          <section key={s.kunci} id={`sub-${s.kunci}`} className="scroll-mt-20">
            {s.induk && <H besar>{s.induk}</H>}
            {s.nomor.split('.').length > 2
              ? <H>{s.nomor}&nbsp;&nbsp;{s.judul}</H>
              : <H besar>{s.nomor}&nbsp;&nbsp;{s.judul}</H>}
            {s.pengantar && <p className="report-prosa">{s.pengantar}</p>}
            {s.tabel.length === 0 && !s.pengantar && <p className="report-prosa bab02-redup">Belum ada data.</p>}
            {s.tabel.map((t, i) => <Tabel key={i} t={t} />)}
            {s.grafik.map(g => (
              <figure key={g.judul} className="bab02-gambar">
                {/* SVG dibuat sendiri dari angka laporan; seluruh teks di dalamnya sudah di-escape. */}
                <div className="max-w-full overflow-x-auto [&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: g.svg }} />
                <figcaption>Diagram {++nomorDiagram}. {g.judul}</figcaption>
              </figure>
            ))}
            <KotakAnalisis a={s.analisis} />
          </section>
        ))}

        <H besar>{m.nomorMasalah}&nbsp;&nbsp;Identifikasi Masalah &amp; Rekomendasi Tindak Lanjut</H>
        {m.masalah.length === 0 ? (
          <p className="report-prosa bab02-redup">Tidak ada masalah yang dicatat bulan ini.</p>
        ) : (
          <Tabel t={{ header: ['No', 'Area Fokus', 'Masalah Utama', 'Rekomendasi Tindak Lanjut', 'Prioritas'], baris: m.masalah.map((r, i) => [String(i + 1), r.area, r.masalah, r.rekomendasi || '—', r.prioritas]) }} kiri />
        )}

        {/* Sama dengan .docx: bagian Kesimpulan hanya dicetak bila ditulis. */}
        {m.kesimpulan.length > 0 && (
          <>
            <H besar>Kesimpulan</H>
            {m.kesimpulan.map((k, i) => <p key={i} className="report-prosa">{k}</p>)}
          </>
        )}

        <div className="report-footer">
          © Yayasan Pionir Pendidikan Indonesia | Rumah Qur&apos;an LHI — {m.subjudul.replace(/^.*—\s*/, 'Laporan Kurikulum ')}
        </div>
      </div>
    </article>
  )
}

function H({ besar, children }: { besar?: boolean; children: React.ReactNode }) {
  return <p className={besar ? 'report-h1' : 'report-h2'}>{children}</p>
}

/** Kotak butir — sorotan (hijau) & perhatian (emas), seperti kotak sorotan bendahara. */
function Kotak({ judul, isi, varian }: { judul: string; isi: string[]; varian: 'green' | 'gold' }) {
  return (
    <div className={`report-callout ${varian} mt-2`}>
      <p className="caption">{judul}</p>
      {isi.length === 0
        ? <p className="bab02-redup">Belum diisi.</p>
        : <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc' }}>{isi.map((x, i) => <li key={i}>{x}</li>)}</ul>}
    </div>
  )
}

function Tabel({ t, kiri }: { t: TabelModel; kiri?: boolean }) {
  return (
    <div className="bab02-tabel-blok">
      {t.judul && <p className="bab02-tabel-judul">{t.judul}</p>}
      <div className="max-w-full overflow-x-auto">
        <table className="report-table">
          <thead>
            <tr>{t.header.map((h, i) => <th key={i} className={i === 0 || kiri ? undefined : 'tengah'}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {t.baris.map((b, r) => (
              <tr key={r} className={t.adaTotal && r === t.baris.length - 1 ? 'total' : undefined}>
                {b.map((c, i) => (
                  <td key={i} className={i === 0 ? 'tebal bab02-pertama' : kiri ? undefined : 'tengah bab02-angka'}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.catatan && <p className="bab02-catatan">{t.catatan}</p>}
    </div>
  )
}

function KotakAnalisis({ a }: { a: { analisis: string; masalah: string; rekomendasi: string } }) {
  const baris = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
  if (!a.analisis.trim() && !baris(a.masalah).length && !baris(a.rekomendasi).length) return null
  return (
    <div className="report-callout bab02-kotak">
      <p className="caption">Analisis &amp; Rekomendasi</p>
      {a.analisis.trim() && <p className="report-prosa"><b>Analisis:</b> {a.analisis}</p>}
      {baris(a.masalah).length > 0 && (
        <>
          <p className="merah">Identifikasi Masalah</p>
          <ul className="bab02-butir">{baris(a.masalah).map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
      {baris(a.rekomendasi).length > 0 && (
        <>
          <p className="hijau">Rekomendasi Tindak Lanjut</p>
          <ul className="bab02-butir">{baris(a.rekomendasi).map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
    </div>
  )
}
