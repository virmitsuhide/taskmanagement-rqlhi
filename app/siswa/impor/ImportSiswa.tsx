'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { importStudentsAction, type BarisMentah, type HasilImpor } from '@/app/actions/students'
import { Button } from '@/components/ui/button'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { getProgramsForJenjang } from '@/lib/rq/programs'
import { methodsForJenjang } from '@/lib/tahsin'
import { KOLOM_IMPOR, periksaBaris, tandaiNisKembar, type HasilBaris, type RujukanImpor } from '@/lib/rq/siswa-impor'
import { cn } from '@/lib/utils'
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react'

type Props = RujukanImpor

/** Baris pertama berkas adalah judul, jadi data pertama ada di baris 2. */
const BARIS_DATA_PERTAMA = 2

export function ImportSiswa(props: Props) {
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const [namaBerkas, setNamaBerkas] = useState<string | null>(null)
  const [baris, setBaris] = useState<HasilBaris[] | null>(null)
  const [mentah, setMentah] = useState<BarisMentah[]>([])
  const [galatBerkas, setGalatBerkas] = useState<string | null>(null)
  const [tab, setTab] = useState<'siap' | 'bermasalah'>('siap')
  const [hasil, setHasil] = useState<HasilImpor | null>(null)

  const siap = useMemo(() => baris?.filter(b => b.data) ?? [], [baris])
  const bermasalah = useMemo(() => baris?.filter(b => !b.data) ?? [], [baris])

  function reset() {
    setNamaBerkas(null)
    setBaris(null)
    setMentah([])
    setGalatBerkas(null)
    setHasil(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function onPilihBerkas(file: File) {
    reset()
    setNamaBerkas(file.name)
    try {
      // cellDates: sel bertipe tanggal keluar sebagai Date, bukan angka seri
      // Excel yang harus ditebak sendiri artinya.
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) {
        setGalatBerkas('Berkas tidak punya sheet yang bisa dibaca.')
        return
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
      // Baris yang seluruh selnya kosong dibuang tanpa dilaporkan: Excel sering
      // menyimpan ratusan baris kosong di bawah data, dan melaporkannya sebagai
      // galat akan menenggelamkan masalah yang sebenarnya.
      const berisi = rows
        .map((r, i) => ({ r, baris: i + BARIS_DATA_PERTAMA }))
        .filter(({ r }) => Object.values(r).some(v => v !== null && String(v).trim() !== ''))

      if (berisi.length === 0) {
        setGalatBerkas('Tidak ada baris data di sheet pertama — apakah judul kolomnya sudah ada di baris 1?')
        return
      }

      // Nilai diratakan ke tipe yang bisa menyeberang ke server action; Date
      // ditulis ISO supaya server membacanya lewat jalur yang sama dengan
      // tanggal yang diketik tangan.
      const rata: BarisMentah[] = berisi.map(({ r, baris }) => {
        const out: BarisMentah = { __baris: baris }
        for (const [k, v] of Object.entries(r)) {
          if (v === null || v === undefined) continue
          out[k] = v instanceof Date ? isoDari(v) : (v as string | number | boolean)
        }
        return out
      })

      setMentah(rata)
      setBaris(tandaiNisKembar(rata.map((r, i) => periksaBaris(r, berisi[i].baris, props))))
      setTab('siap')
    } catch {
      setGalatBerkas('Berkas gagal dibaca. Pastikan formatnya .xlsx atau .xls.')
    }
  }

  function onImpor() {
    if (siap.length === 0) return
    const kirim = mentah.filter(m => siap.some(s => s.baris === Number(m.__baris)))
    startTransition(async () => {
      setHasil(await importStudentsAction(kirim))
    })
  }

  // ── Sesudah impor: yang penting tinggal ringkasannya ──
  if (hasil && !hasil.error) {
    return <Ringkasan hasil={hasil} onUlang={reset} />
  }

  return (
    <div className="space-y-6">
      <LangkahTemplate {...props} />

      {/* ── 2. Unggah ── */}
      <section className="rounded-xl border bg-card p-4">
        <Judul n={2} teks="Unggah berkas yang sudah diisi" />
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void onPilihBerkas(f)
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isPending}>
            <Upload className="h-4 w-4 mr-1.5" />Pilih Berkas
          </Button>
          {namaBerkas && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span className="truncate">{namaBerkas}</span>
              <button type="button" onClick={reset} className="shrink-0 hover:text-foreground" aria-label="Hapus berkas">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
        {galatBerkas && (
          <p className="mt-3 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{galatBerkas}</p>
        )}
        {hasil?.error && (
          <p className="mt-3 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{hasil.error}</p>
        )}
      </section>

      {/* ── 3. Periksa ── */}
      {baris && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="p-4 pb-0">
            <Judul n={3} teks="Periksa sebelum disimpan" />
          </div>

          <div className="flex gap-1 px-4 border-b">
            <TabPeriksa active={tab === 'siap'} onClick={() => setTab('siap')}>
              Siap disimpan <Angka n={siap.length} nada="ok" />
            </TabPeriksa>
            <TabPeriksa active={tab === 'bermasalah'} onClick={() => setTab('bermasalah')}>
              Bermasalah <Angka n={bermasalah.length} nada={bermasalah.length ? 'galat' : 'netral'} />
            </TabPeriksa>
          </div>

          {tab === 'siap'
            ? <TabelSiap rows={siap} />
            : <TabelBermasalah rows={bermasalah} />}

          <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-4 py-3">
            <Button type="button" onClick={onImpor} disabled={isPending || siap.length === 0}>
              {isPending ? 'Menyimpan…' : `Impor ${siap.length} Siswa`}
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={isPending}>Batal</Button>
            {bermasalah.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {bermasalah.length} baris bermasalah tidak ikut disimpan. Perbaiki di Excel lalu unggah lagi.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

/** ── 1. Berkas contoh ─────────────────────────────────────────────── */
function LangkahTemplate({ allowedJenjang, halaqohList, methods, jilidLevels }: Props) {
  function unduh() {
    const wb = XLSX.utils.book_new()

    // Sheet data sengaja hanya berisi judul kolom. Baris contoh di sheet ini
    // cepat atau lambat akan ikut terimpor sebagai siswa bernama 'Ahmad Fauzan
    // Hakim'; contohnya ditaruh di sheet Petunjuk saja.
    const wsData = XLSX.utils.aoa_to_sheet([KOLOM_IMPOR.map(k => k.header)])
    wsData['!cols'] = KOLOM_IMPOR.map(k => ({ wch: k.lebar }))
    wsData['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, wsData, 'Data Siswa')

    const wsPetunjuk = XLSX.utils.aoa_to_sheet([
      ['PETUNJUK PENGISIAN'],
      ['Isi sheet "Data Siswa". Jangan mengubah judul kolom di baris 1.'],
      [],
      ['Kolom', 'Wajib', 'Contoh', 'Keterangan'],
      ...KOLOM_IMPOR.map(k => [k.header, k.wajib ? 'Ya' : '', k.contoh, k.petunjuk]),
    ])
    wsPetunjuk['!cols'] = [{ wch: 18 }, { wch: 7 }, { wch: 22 }, { wch: 68 }]
    XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk')

    // Daftar pilihan dibangun dari data hidup, bukan ditulis tangan: kalau
    // halaqoh baru dibuat pagi ini, berkas contoh sore ini sudah memuatnya.
    const pilihan: string[][] = [['DAFTAR PILIHAN YANG SAH'], []]
    pilihan.push(['Jenjang', ...allowedJenjang.map(j => JENJANG_LABELS[j])])
    pilihan.push([])
    for (const j of allowedJenjang) {
      const label = JENJANG_LABELS[j]
      const program = getProgramsForJenjang(j).map(p => p.label)
      pilihan.push([`Program — ${label}`, ...(program.length ? program : ['(tidak ada program)'])])
    }
    pilihan.push([])
    for (const j of allowedJenjang) {
      const berlaku = methodsForJenjang(j, methods)
      pilihan.push([`Metode — ${JENJANG_LABELS[j]}`, ...berlaku.map(m => m.name)])
    }
    pilihan.push([])
    for (const m of methods) {
      const jilid = jilidLevels
        .filter(j => j.method_id === m.id)
        .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
        .map(j => j.label)
      if (jilid.length) pilihan.push([`Jilid — ${m.name}`, ...jilid])
    }
    pilihan.push([])
    pilihan.push(['Halaqoh (tulis persis)', 'Jenjang'])
    for (const j of allowedJenjang) {
      for (const h of halaqohList.filter(h => h.jenjang === j)) {
        pilihan.push([h.name, JENJANG_LABELS[j]])
      }
    }
    const wsPilihan = XLSX.utils.aoa_to_sheet(pilihan)
    wsPilihan['!cols'] = [{ wch: 34 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, wsPilihan, 'Daftar Pilihan')

    XLSX.writeFile(wb, 'template-impor-siswa.xlsx')
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <Judul n={1} teks="Unduh berkas contoh" />
      <p className="text-sm text-muted-foreground mb-3">
        Berisi judul kolom yang benar, petunjuk tiap kolom, dan daftar nama halaqoh,
        program, serta jilid yang sah — diambil dari data saat ini.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={unduh}>
        <Download className="h-4 w-4 mr-1.5" />Unduh Template Excel
      </Button>
    </section>
  )
}

function TabelSiap({ rows }: { rows: HasilBaris[] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada baris yang siap disimpan.</p>
  }
  return (
    <div className="max-h-[26rem] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/60 backdrop-blur">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <th className="px-4 py-2 w-14">Baris</th>
            <th className="px-2 py-2">Nama</th>
            <th className="px-2 py-2 w-24">Jenjang</th>
            <th className="px-2 py-2 w-20">Kelas</th>
            <th className="px-4 py-2">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.baris} className="border-t">
              <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">{r.baris}</td>
              <td className="px-2 py-2 font-medium">{r.nama}</td>
              <td className="px-2 py-2 text-muted-foreground">{r.jenjang}</td>
              <td className="px-2 py-2 text-muted-foreground">{r.kelas || '—'}</td>
              <td className="px-4 py-2 text-xs text-warning">{r.catatan.join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabelBermasalah({ rows }: { rows: HasilBaris[] }) {
  if (rows.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-success" />Semua baris lolos pemeriksaan.
      </p>
    )
  }
  return (
    <div className="max-h-[26rem] overflow-auto divide-y">
      {rows.map(r => (
        <div key={r.baris} className="flex gap-3 px-4 py-2.5">
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums pt-0.5 w-10">{r.baris}</span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{r.nama || <em className="text-muted-foreground">tanpa nama</em>}</span>
            <ul className="mt-0.5 space-y-0.5">
              {r.galat.map((g, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{g}
                </li>
              ))}
            </ul>
          </span>
        </div>
      ))}
    </div>
  )
}

function Ringkasan({ hasil, onUlang }: { hasil: HasilImpor; onUlang: () => void }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-success-wash px-4 py-4">
        <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
        <div>
          <p className="font-semibold">{hasil.masuk} siswa berhasil ditambahkan</p>
          {hasil.gagal.length > 0 && (
            <p className="text-sm text-muted-foreground">{hasil.gagal.length} baris ditolak — rinciannya di bawah.</p>
          )}
        </div>
      </div>

      {hasil.gagal.length > 0 && (
        <div className="max-h-72 overflow-auto divide-y">
          {hasil.gagal.map(g => (
            <div key={g.baris} className="flex gap-3 px-4 py-2.5">
              <span className="shrink-0 w-10 text-xs text-muted-foreground tabular-nums pt-0.5">{g.baris}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{g.nama || <em className="text-muted-foreground">tanpa nama</em>}</span>
                <span className="text-xs text-destructive">{g.alasan}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t bg-muted/30 px-4 py-3">
        <Button asChild size="sm"><Link href="/siswa">Lihat Daftar Siswa</Link></Button>
        <Button type="button" variant="outline" size="sm" onClick={onUlang}>Impor Berkas Lain</Button>
      </div>
    </div>
  )
}

function Judul({ n, teks }: { n: number; teks: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold mb-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-wash text-[11px] font-bold text-primary">
        {n}
      </span>
      {teks}
    </h2>
  )
}

function TabPeriksa({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
        active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Angka({ n, nada }: { n: number; nada: 'ok' | 'galat' | 'netral' }) {
  return (
    <span
      className={cn(
        'ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        nada === 'ok' && 'bg-success-wash text-success',
        nada === 'galat' && 'bg-destructive/10 text-destructive',
        nada === 'netral' && 'bg-muted text-muted-foreground',
      )}
    >
      {n}
    </span>
  )
}

function isoDari(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
