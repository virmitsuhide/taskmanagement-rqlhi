import type { LaporanModel, TabelModel } from '@/lib/laporan-kurikulum/susun'

/**
 * Pratinjau Bab 02 — render HTML dari LaporanModel yang sama dengan berkas
 * .docx, jadi yang dibaca Kepala RQ di sini adalah yang akan sampai ke BPH.
 * Tetap Server Component: diagram berupa SVG inline, ikut tercetak.
 *
 * Tampilannya meniru Bab 02 laporan BPH Agustus 2026 (kelas `.bab02-*` di
 * globals.css): Calibri, judul navy bergaris emas, tabel berkepala navy,
 * kotak analisis biru muda — lembar dokumen, bukan bagian UI bertema.
 */
export function PratinjauBab({ m }: { m: LaporanModel }) {
  let nomorDiagram = 0
  return (
    <article className="bab02 mx-auto max-w-[900px] border shadow-sm print:max-w-none print:border-0 print:shadow-none">
      <header>
        <h2 className="bab02-h1">{m.judulBab}</h2>
        <p className="bab02-subjudul">{m.subjudul}</p>
        <p className="bab02-acuan">{m.acuan}</p>
      </header>

      <h3 className="bab02-h2">Ringkasan Eksekutif</h3>
      <div className="bab02-kpi">
        {m.kpi.map(k => (
          <div key={k.label}>
            <span>{k.label}</span>
            <b>{k.nilai}</b>
            <em>{k.keterangan}</em>
          </div>
        ))}
      </div>
      <Daftar judul="Sorotan Capaian" isi={m.sorotan} kosong="Belum diisi." />
      <Daftar judul="Perhatian Utama" isi={m.perhatian} kosong="Belum diisi." />

      {m.sub.map(s => (
        <section key={s.kunci} id={`sub-${s.kunci}`} className="scroll-mt-20">
          {s.induk && <h3 className="bab02-h2">{s.induk}</h3>}
          {s.nomor.split('.').length > 2
            ? <h4 className="bab02-h3">{s.nomor}&nbsp;&nbsp;{s.judul}</h4>
            : <h3 className="bab02-h2">{s.nomor}&nbsp;&nbsp;{s.judul}</h3>}
          {s.pengantar && <p className="bab02-p">{s.pengantar}</p>}
          {s.tabel.length === 0 && !s.pengantar && <p className="bab02-p bab02-redup">Belum ada data.</p>}
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

      <h3 className="bab02-h2">{m.nomorMasalah}&nbsp;&nbsp;Identifikasi Masalah &amp; Rekomendasi Tindak Lanjut</h3>
      {m.masalah.length === 0 ? (
        <p className="bab02-p bab02-redup">Tidak ada masalah yang dicatat bulan ini.</p>
      ) : (
        <Tabel t={{ header: ['No', 'Area Fokus', 'Masalah Utama', 'Rekomendasi Tindak Lanjut', 'Prioritas'], baris: m.masalah.map((r, i) => [String(i + 1), r.area, r.masalah, r.rekomendasi || '—', r.prioritas]) }} kiri />
      )}

      <h3 className="bab02-h2">Kesimpulan</h3>
      {m.kesimpulan.length === 0
        ? <p className="bab02-p bab02-redup">Belum diisi.</p>
        : m.kesimpulan.map((k, i) => <p key={i} className="bab02-p">{k}</p>)}
    </article>
  )
}

function Daftar({ judul, isi, kosong }: { judul: string; isi: string[]; kosong: string }) {
  return (
    <>
      <h4 className="bab02-h3">{judul}</h4>
      {isi.length === 0
        ? <p className="bab02-p bab02-redup">{kosong}</p>
        : <ul className="bab02-butir">{isi.map((x, i) => <li key={i}>{x}</li>)}</ul>}
    </>
  )
}

function Tabel({ t, kiri }: { t: TabelModel; kiri?: boolean }) {
  return (
    <div className="bab02-tabel-blok">
      {t.judul && <p className="bab02-tabel-judul">{t.judul}</p>}
      <div className="max-w-full overflow-x-auto">
        <table className="bab02-tabel">
          <thead>
            <tr>{t.header.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {t.baris.map((b, r) => (
              <tr key={r} className={t.adaTotal && r === t.baris.length - 1 ? 'total' : undefined}>
                {b.map((c, i) => (
                  <td key={i} className={i === 0 ? 'pertama' : kiri ? 'kiri' : undefined}>{c}</td>
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
    <div className="bab02-kotak">
      <p className="label">ANALISIS &amp; REKOMENDASI</p>
      {a.analisis.trim() && <p><b className="navy">Analisis:</b> {a.analisis}</p>}
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
