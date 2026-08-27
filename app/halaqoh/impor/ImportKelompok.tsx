'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import {
  importKelompokAction,
  type BarisKelompokMentah, type HasilImporKelompok,
} from '@/app/actions/pindah-halaqoh'
import { Button } from '@/components/ui/button'
import {
  KOLOM_KELOMPOK, periksaBarisKelompok, sesiDariNamaSheet, tandaiSantriKembar,
  type HasilKelompok, type RujukanKelompok,
} from '@/lib/rq/kelompok-impor'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { programLabel } from '@/lib/rq/programs'
import { sesiLabel } from '@/lib/rq/sesi'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Upload, X,
} from 'lucide-react'

type Props = RujukanKelompok

/** Baris pertama tiap lembar adalah judul, jadi data pertama ada di baris 2. */
const BARIS_DATA_PERTAMA = 2

/** Lembar yang dibuatkan berkas contoh — satu per sesi, sesuai cara membaginya. */
const SESI_LEMBAR = [1, 2, 3] as const

type Tab = 'pindah' | 'tetap' | 'galat'

/**
 * Pembagian ulang kelompok lewat satu berkas Excel.
 *
 * Dipakai saat perubahan kelompok terlalu banyak untuk dikerjakan satu per
 * satu — pengacakan awal semester memindahkan hampir seluruh 493 anak, dan
 * memindahkannya lewat layar halaqoh berarti membuka 26 kelompok bergantian.
 *
 * Alurnya sama dengan Impor Siswa dan sengaja begitu: unduh contoh → unggah →
 * PERIKSA → simpan. Langkah periksa itu yang membedakannya dari sekadar
 * menimpa basis data, dan di sini ia lebih penting lagi: yang salah tempel
 * bukan siswa baru yang bisa dihapus, melainkan anak nyata yang lalu tidak
 * pernah datang ke halaqohnya.
 */
export function ImportKelompok(props: Props) {
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const [namaBerkas, setNamaBerkas] = useState<string | null>(null)
  const [baris, setBaris] = useState<HasilKelompok[] | null>(null)
  const [mentah, setMentah] = useState<BarisKelompokMentah[]>([])
  const [galatBerkas, setGalatBerkas] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pindah')
  const [hasil, setHasil] = useState<HasilImporKelompok | null>(null)

  const pindah = useMemo(() => baris?.filter(b => b.status === 'pindah') ?? [], [baris])
  const tetap = useMemo(() => baris?.filter(b => b.status === 'tetap') ?? [], [baris])
  const galat = useMemo(() => baris?.filter(b => b.status === 'galat') ?? [], [baris])

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
      const wb = XLSX.read(await file.arrayBuffer())
      if (wb.SheetNames.length === 0) {
        setGalatBerkas('Berkas tidak punya lembar yang bisa dibaca.')
        return
      }

      // SELURUH lembar dibaca, bukan yang pertama saja: berkas ini memang
      // dirancang berisi tiga lembar sesi sekaligus.
      const rata: BarisKelompokMentah[] = []
      for (const nama of wb.SheetNames) {
        const ws = wb.Sheets[nama]
        if (!ws) continue
        const sesi = sesiDariNamaSheet(nama)
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
        rows.forEach((r, i) => {
          // Baris yang seluruh selnya kosong dibuang tanpa dilaporkan: Excel
          // sering menyimpan ratusan baris kosong di bawah data.
          if (!Object.values(r).some(v => v !== null && String(v).trim() !== '')) return
          const out: BarisKelompokMentah = {
            __sheet: nama,
            __baris: i + BARIS_DATA_PERTAMA,
            __sesi: sesi,
          }
          for (const [k, v] of Object.entries(r)) {
            if (v === null || v === undefined) continue
            out[k] = v instanceof Date ? v.toISOString() : (v as string | number | boolean)
          }
          rata.push(out)
        })
      }

      if (rata.length === 0) {
        setGalatBerkas('Tidak ada baris data — apakah judul kolomnya sudah ada di baris 1 tiap lembar?')
        return
      }

      setMentah(rata)
      setBaris(tandaiSantriKembar(rata.map(r => periksaBarisKelompok(
        r,
        Number(r.__baris),
        String(r.__sheet),
        (r.__sesi as number | null) ?? null,
        props,
      ))))
      setTab('pindah')
    } catch {
      setGalatBerkas('Berkas gagal dibaca. Pastikan formatnya .xlsx atau .xls.')
    }
  }

  function onImpor() {
    if (pindah.length === 0) return
    // Hanya baris yang berstatus pindah yang dikirim. Yang 'tetap' tidak
    // mengubah apa pun, dan mengirimkannya berarti menulis ratusan UPDATE
    // yang hasilnya sama dengan keadaan sekarang.
    const kunci = new Set(pindah.map(p => `${p.sheet}#${p.baris}`))
    const kirim = mentah.filter(m => kunci.has(`${m.__sheet}#${m.__baris}`))
    startTransition(async () => {
      setHasil(await importKelompokAction(kirim))
    })
  }

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
            <Upload className="mr-1.5 h-4 w-4" />Pilih Berkas
          </Button>
          {namaBerkas && (
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span className="truncate">{namaBerkas}</span>
              <button type="button" onClick={reset} className="shrink-0 hover:text-foreground" aria-label="Hapus berkas">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
        {galatBerkas && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{galatBerkas}</p>
        )}
        {hasil?.error && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{hasil.error}</p>
        )}
      </section>

      {/* ── 3. Periksa ── */}
      {baris && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="p-4 pb-0">
            <Judul n={3} teks="Periksa sebelum disimpan" />
          </div>

          <div className="flex gap-1 border-b px-4">
            <TabPeriksa active={tab === 'pindah'} onClick={() => setTab('pindah')}>
              Pindah <Angka n={pindah.length} nada="ok" />
            </TabPeriksa>
            <TabPeriksa active={tab === 'tetap'} onClick={() => setTab('tetap')}>
              Tidak berubah <Angka n={tetap.length} nada="netral" />
            </TabPeriksa>
            <TabPeriksa active={tab === 'galat'} onClick={() => setTab('galat')}>
              Bermasalah <Angka n={galat.length} nada={galat.length ? 'galat' : 'netral'} />
            </TabPeriksa>
          </div>

          {tab === 'galat'
            ? <TabelBermasalah rows={galat} />
            : <TabelPerpindahan rows={tab === 'pindah' ? pindah : tetap} tab={tab} />}

          <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-4 py-3">
            <Button type="button" onClick={onImpor} disabled={isPending || pindah.length === 0}>
              {isPending ? 'Memindahkan…' : `Pindahkan ${pindah.length} Santri`}
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={isPending}>Batal</Button>
            {galat.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {galat.length} baris bermasalah tidak ikut dipindah. Perbaiki di Excel lalu unggah lagi.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

/** ── 1. Berkas contoh ─────────────────────────────────────────────── */
function LangkahTemplate({ halaqohList, santri }: Props) {
  function unduh() {
    const wb = XLSX.utils.book_new()

    // Satu lembar per sesi. Santri yang sekarang ada di sesi itu ikut ditulis
    // beserta halaqohnya sekarang, jadi berkas ini bisa dipakai dua cara:
    // ditimpa seluruhnya, atau diubah beberapa barisnya saja.
    for (const sesi of SESI_LEMBAR) {
      const halaqohSesi = halaqohList.filter(h => h.sesi === sesi)
      const idSesi = new Set(halaqohSesi.map(h => h.id))
      const isi = santri
        .filter(s => s.halaqoh_id && idSesi.has(s.halaqoh_id))
        .map(s => [s.nis ?? '', s.full_name, s.kelas ?? '', s.halaqoh_name ?? '', sesi])

      const ws = XLSX.utils.aoa_to_sheet([KOLOM_KELOMPOK.map(k => k.header), ...isi])
      ws['!cols'] = KOLOM_KELOMPOK.map(k => ({ wch: k.lebar }))
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }
      XLSX.utils.book_append_sheet(wb, ws, `Sesi ${sesi}`)
    }

    // Santri yang belum punya halaqoh tidak masuk lembar sesi mana pun —
    // padahal merekalah yang paling perlu dibagikan. Lembarnya sendiri agar
    // tidak hilang, tanpa sesi karena memang belum punya.
    const belum = santri.filter(s => !s.halaqoh_id)
    if (belum.length > 0) {
      const ws = XLSX.utils.aoa_to_sheet([
        KOLOM_KELOMPOK.map(k => k.header),
        ...belum.map(s => [s.nis ?? '', s.full_name, s.kelas ?? '', '', '']),
      ])
      ws['!cols'] = KOLOM_KELOMPOK.map(k => ({ wch: k.lebar }))
      XLSX.utils.book_append_sheet(wb, ws, 'Belum Berhalaqoh')
    }

    const wsPetunjuk = XLSX.utils.aoa_to_sheet([
      ['PETUNJUK PEMBAGIAN ULANG KELOMPOK'],
      ['Tiap lembar Sesi sudah berisi pembagian yang berlaku sekarang.'],
      ['Ubah kolom "Halaqoh Baru" pada baris yang pindah. Baris yang tidak diubah dilewati.'],
      ['Boleh juga memindahkan barisnya antar lembar — sesi diambil dari NAMA LEMBAR.'],
      ['Jangan mengubah judul kolom di baris 1, dan jangan mengubah nama lembar.'],
      [],
      ['Kolom', 'Contoh', 'Keterangan'],
      ...KOLOM_KELOMPOK.map(k => [k.header, k.contoh, k.petunjuk]),
      [],
      ['Yang TIDAK diubah berkas ini:'],
      ['— identitas santri (nama, NIS, kelas). NIS & nama hanya dipakai mencari barisnya.'],
      ['— daftar halaqoh. Kelompok baru harus dibuat dulu lewat menu Buat Halaqoh.'],
    ])
    wsPetunjuk['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 74 }]
    XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk')

    // Daftar halaqoh dibangun dari data hidup: kelompok yang dibuat pagi ini
    // sudah muncul di berkas contoh sore ini.
    const wsDaftar = XLSX.utils.aoa_to_sheet([
      ['Nama Halaqoh (tulis persis)', 'Sesi', 'Wali', 'Unit', 'Program'],
      ...halaqohList.map(h => [
        h.name,
        sesiLabel(h.sesi),
        h.wali ?? '—',
        JENJANG_LABELS[h.jenjang],
        programLabel(h.jenjang, h.program),
      ]),
    ])
    wsDaftar['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 26 }, { wch: 12 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsDaftar, 'Daftar Halaqoh')

    XLSX.writeFile(wb, 'pembagian-kelompok.xlsx')
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <Judul n={1} teks="Unduh pembagian yang berlaku sekarang" />
      <p className="mb-3 text-sm text-muted-foreground">
        Tiga lembar — Sesi 1, 2, dan 3 — sudah terisi {santri.length} santri beserta
        halaqohnya sekarang. Ubah kolom <b>Halaqoh Baru</b> pada yang pindah saja.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={unduh} disabled={halaqohList.length === 0}>
        <Download className="mr-1.5 h-4 w-4" />Unduh Excel Pembagian
      </Button>
      {halaqohList.length === 0 && (
        <p className="mt-2 text-xs text-warning">
          Belum ada halaqoh dalam wewenang Anda — buat kelompoknya dulu.
        </p>
      )}
    </section>
  )
}

function TabelPerpindahan({ rows, tab }: { rows: HasilKelompok[]; tab: Tab }) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        {tab === 'pindah'
          ? 'Tidak ada santri yang berpindah — semua baris sudah sesuai kelompoknya.'
          : 'Semua baris memindahkan santri.'}
      </p>
    )
  }
  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/60 backdrop-blur">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <th className="w-28 px-4 py-2">Lembar</th>
            <th className="px-2 py-2">Santri</th>
            <th className="px-2 py-2">Dari</th>
            <th className="px-2 py-2">Ke</th>
            <th className="px-4 py-2">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={`${r.sheet}#${r.baris}`} className="border-t">
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {r.sheet} <span className="tabular-nums">·{r.baris}</span>
              </td>
              <td className="px-2 py-2 font-medium">{r.nama}</td>
              <td className="px-2 py-2 text-muted-foreground">{r.dari ?? <em>belum ada</em>}</td>
              <td className="px-2 py-2">
                <span className="inline-flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  {r.ke}
                </span>
              </td>
              <td className="px-4 py-2 text-xs text-warning">{r.catatan.join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabelBermasalah({ rows }: { rows: HasilKelompok[] }) {
  if (rows.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-success" />Semua baris lolos pemeriksaan.
      </p>
    )
  }
  return (
    <div className="max-h-[28rem] divide-y overflow-auto">
      {rows.map(r => (
        <div key={`${r.sheet}#${r.baris}`} className="flex gap-3 px-4 py-2.5">
          <span className="w-24 shrink-0 pt-0.5 text-xs text-muted-foreground">
            {r.sheet} <span className="tabular-nums">·{r.baris}</span>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {r.nama || <em className="text-muted-foreground">tanpa nama</em>}
            </span>
            <ul className="mt-0.5 space-y-0.5">
              {r.galat.map((g, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{g}
                </li>
              ))}
            </ul>
          </span>
        </div>
      ))}
    </div>
  )
}

function Ringkasan({ hasil, onUlang }: { hasil: HasilImporKelompok; onUlang: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b bg-success-wash px-4 py-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
        <div>
          <p className="font-semibold">{hasil.dipindah} santri berhasil dipindahkan</p>
          <p className="text-sm text-muted-foreground">
            {hasil.tetap > 0 && `${hasil.tetap} sudah sesuai dan dilewati. `}
            {hasil.gagal.length > 0 && `${hasil.gagal.length} baris ditolak — rinciannya di bawah.`}
          </p>
        </div>
      </div>

      {hasil.gagal.length > 0 && (
        <div className="max-h-72 divide-y overflow-auto">
          {hasil.gagal.map(g => (
            <div key={`${g.sheet}#${g.baris}`} className="flex gap-3 px-4 py-2.5">
              <span className="w-24 shrink-0 pt-0.5 text-xs text-muted-foreground">
                {g.sheet} <span className="tabular-nums">·{g.baris}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {g.nama || <em className="text-muted-foreground">tanpa nama</em>}
                </span>
                <span className="text-xs text-destructive">{g.alasan}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t bg-muted/30 px-4 py-3">
        <Button asChild size="sm"><Link href="/halaqoh">Lihat Daftar Halaqoh</Link></Button>
        <Button type="button" variant="outline" size="sm" onClick={onUlang}>Impor Berkas Lain</Button>
      </div>
    </div>
  )
}

function Judul({ n, teks }: { n: number; teks: string }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
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
