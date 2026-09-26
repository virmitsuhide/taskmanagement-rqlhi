import { cn } from '@/lib/utils'
import type { LaporanModel, TabelModel } from '@/lib/laporan-kurikulum/susun'

/**
 * Pratinjau Bab 02 — render HTML dari LaporanModel yang sama dengan berkas
 * .docx, jadi yang dibaca Kepala RQ di sini adalah yang akan sampai ke BPH.
 * Tetap Server Component: diagram berupa SVG inline, ikut tercetak.
 */
export function PratinjauBab({ m }: { m: LaporanModel }) {
  let nomorDiagram = 0
  return (
    <article className="laporan-bab space-y-6 rounded-2xl border bg-card p-5 text-[13px] leading-relaxed md:p-8 print:border-0 print:p-0">
      <header className="border-b pb-4">
        <h2 className="font-heading text-2xl font-semibold text-primary md:text-3xl">{m.judulBab}</h2>
        <p className="mt-1 italic text-muted-foreground">{m.subjudul}</p>
        <p className="mt-2 text-xs text-muted-foreground">{m.acuan}</p>
      </header>

      <section className="space-y-3">
        <h3 className="font-heading text-xl font-semibold text-primary">Ringkasan Eksekutif</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {m.kpi.map(k => (
            <div key={k.label} className="rounded-xl border bg-background p-3">
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-xl font-bold leading-none tabular-nums">{k.nilai}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{k.keterangan}</p>
            </div>
          ))}
        </div>
        <Daftar judul="Sorotan Capaian" isi={m.sorotan} kosong="Belum diisi." />
        <Daftar judul="Perhatian Utama" isi={m.perhatian} kosong="Belum diisi." />
      </section>

      {m.sub.map(s => (
        <section key={s.kunci} id={`sub-${s.kunci}`} className="scroll-mt-20 space-y-3 break-inside-avoid-page">
          {s.induk && <h3 className="pt-2 font-heading text-xl font-semibold text-primary">{s.induk}</h3>}
          <h4 className={cn('font-semibold', s.nomor.split('.').length > 2 ? 'text-[15px]' : 'font-heading text-xl text-primary')}>
            {s.nomor}&nbsp;&nbsp;{s.judul}
          </h4>
          {s.pengantar && <p className="text-muted-foreground">{s.pengantar}</p>}
          {s.tabel.length === 0 && !s.pengantar && <p className="italic text-muted-foreground">Belum ada data.</p>}
          {s.tabel.map((t, i) => <Tabel key={i} t={t} />)}
          {s.grafik.map(g => (
            <figure key={g.judul} className="space-y-1">
              {/* SVG dibuat sendiri dari angka laporan; seluruh teks di dalamnya sudah di-escape. */}
              <div className="max-w-full overflow-x-auto [&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: g.svg }} />
              <figcaption className="text-center text-xs italic text-muted-foreground">Diagram {++nomorDiagram}. {g.judul}</figcaption>
            </figure>
          ))}
          <KotakAnalisis a={s.analisis} />
        </section>
      ))}

      <section className="space-y-3">
        <h3 className="font-heading text-xl font-semibold text-primary">2.9&nbsp;&nbsp;Identifikasi Masalah &amp; Rekomendasi Tindak Lanjut</h3>
        {m.masalah.length === 0 ? (
          <p className="italic text-muted-foreground">Tidak ada masalah yang dicatat bulan ini.</p>
        ) : (
          <Tabel t={{ header: ['No', 'Area Fokus', 'Masalah Utama', 'Rekomendasi Tindak Lanjut', 'Prioritas'], baris: m.masalah.map((r, i) => [String(i + 1), r.area, r.masalah, r.rekomendasi || '—', r.prioritas]) }} kiri />
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-heading text-xl font-semibold text-primary">Kesimpulan</h3>
        {m.kesimpulan.length === 0
          ? <p className="italic text-muted-foreground">Belum diisi.</p>
          : m.kesimpulan.map((k, i) => <p key={i}>{k}</p>)}
      </section>
    </article>
  )
}

function Daftar({ judul, isi, kosong }: { judul: string; isi: string[]; kosong: string }) {
  return (
    <div>
      <p className="font-semibold">{judul}</p>
      {isi.length === 0
        ? <p className="italic text-muted-foreground">{kosong}</p>
        : <ul className="mt-1 list-disc space-y-1 pl-5">{isi.map((x, i) => <li key={i}>{x}</li>)}</ul>}
    </div>
  )
}

function Tabel({ t, kiri }: { t: TabelModel; kiri?: boolean }) {
  return (
    <div className="space-y-1">
      {t.judul && <p className="text-xs font-semibold">{t.judul}</p>}
      <div className="max-w-full overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-[11px] sm:text-xs">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              {t.header.map((h, i) => (
                <th key={i} className={cn('px-2 py-1.5 font-semibold', i === 0 || kiri ? 'text-left' : 'text-center')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.baris.map((b, r) => (
              <tr key={r} className={cn('border-t', t.adaTotal && r === t.baris.length - 1 && 'bg-primary-wash font-semibold')}>
                {b.map((c, i) => (
                  <td key={i} className={cn('px-2 py-1 tabular-nums', i === 0 || kiri ? 'text-left' : 'text-center', c === '0' && 'text-muted-foreground/60')}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.catatan && <p className="text-[11px] italic text-muted-foreground">{t.catatan}</p>}
    </div>
  )
}

function KotakAnalisis({ a }: { a: { analisis: string; masalah: string; rekomendasi: string } }) {
  const baris = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
  if (!a.analisis.trim() && !baris(a.masalah).length && !baris(a.rekomendasi).length) return null
  return (
    <div className="space-y-2 rounded-xl border-l-4 border-l-primary bg-primary-wash p-4">
      <p className="text-xs font-bold tracking-wide text-primary">ANALISIS &amp; REKOMENDASI</p>
      {a.analisis.trim() && <p><b>Analisis:</b> {a.analisis}</p>}
      {baris(a.masalah).length > 0 && (
        <div><p className="font-semibold">Identifikasi Masalah</p><ul className="list-disc pl-5">{baris(a.masalah).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      )}
      {baris(a.rekomendasi).length > 0 && (
        <div><p className="font-semibold">Rekomendasi Tindak Lanjut</p><ul className="list-disc pl-5">{baris(a.rekomendasi).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      )}
    </div>
  )
}
