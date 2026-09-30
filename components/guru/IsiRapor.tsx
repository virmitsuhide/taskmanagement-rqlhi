'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Gauge, LayoutTemplate, MessageSquare, Plus, Printer, RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { simpanRaporIsianAction } from '@/app/actions/rapor-isian'
import { MEDAN_PER_KODE, type KodeMedan } from '@/lib/rapor/medan'
import { cn } from '@/lib/utils'
import { useLaporDraftRapor } from '@/components/guru/PratinjauRaporLangsung'

export interface TetanggaRapor {
  id: string
  nama: string
}

export interface IsianSlot {
  id: string
  sebelum: string
  sesudah: string
  contoh: string
}

interface Props {
  studentId: string
  termId: string
  templateId: string | null
  nama: string
  deskripsiAwal: string
  timpaanAwal: Record<string, string>
  /** Angka hitungan sistem per medan — pembanding saat guru menimpa. */
  asli: Record<KodeMedan, string>
  /** Medan yang dipakai template ini dan boleh ditimpa guru. */
  bisaDitimpa: KodeMedan[]
  sebelum: TetanggaRapor | null
  sesudah: TetanggaRapor | null
  urutan: { ke: number; dari: number }
  /** 'ats' | 'semester' — tulisan ATS dan rapor semester disimpan terpisah. */
  jenis: string
  /** Template memakai kotak deskripsi bebas (bukan isian merah). */
  pakaiDeskripsi: boolean
  /** Isian merah template ini, berurutan seperti di lembar. */
  isianSlot: IsianSlot[]
  /** Isi tiap isian saat layar dibuka: tulisan tersimpan, atau isi awalnya. */
  isianAwal: Record<string, string>
  /** Data anak yang bisa disisipkan ke isian dengan satu ketukan. */
  sisip: { label: string; nilai: string }[]
}

/**
 * Layar isi rapor seorang anak.
 *
 * Guru berjalan menyusuri satu sesi dengan panah ◀ ▶, bukan kembali ke
 * daftar tiap selesai satu anak: mengisi rapor adalah satu duduk untuk
 * seluruh halaqoh, dan tiap kembali ke daftar berarti mencari lagi sampai
 * mana tadi. Perpindahan menawarkan simpan dulu bila masih ada yang belum
 * tersimpan — kehilangan satu paragraf deskripsi berarti menulisnya ulang.
 */
export function IsiRapor({
  studentId, termId, templateId, nama, deskripsiAwal, timpaanAwal, asli, bisaDitimpa, sebelum, sesudah, urutan,
  jenis, pakaiDeskripsi, isianSlot, isianAwal, sisip,
}: Props) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [deskripsi, setDeskripsi] = useState(deskripsiAwal)
  const [timpaan, setTimpaan] = useState<Record<string, string>>(timpaanAwal)
  const [isian, setIsian] = useState<Record<string, string>>(isianAwal)
  const [kotor, setKotor] = useState(false)
  const [tanyaCetak, setTanyaCetak] = useState(false)

  // Pratinjau di sebelah ikut berubah selagi mengetik (bila halaman
  // memasang RaporLangsung). Hanya tampilan — yang tersimpan tetap lewat Simpan.
  const laporDraft = useLaporDraftRapor()
  useEffect(() => {
    if (kotor) laporDraft?.({ deskripsi, timpaan, isian })
  }, [kotor, deskripsi, timpaan, isian, laporDraft])

  const ke = (id: string) => `/guru/rapor-quran/${id}?jenis=${jenis}`

  function simpan(lalu?: () => void) {
    mulai(async () => {
      const hasil = await simpanRaporIsianAction(studentId, termId, templateId, deskripsi, timpaan, jenis, isian)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      setKotor(false)
      toast.success(`Rapor ${nama} tersimpan.`)
      if (lalu) lalu()
      else router.refresh()
    })
  }

  function pindah(tujuan: TetanggaRapor | null) {
    if (!tujuan) return
    const tuju = () => router.push(ke(tujuan.id))
    if (!kotor) {
      tuju()
      return
    }
    if (confirm(`Rapor ${nama} belum tersimpan. Simpan dulu sebelum pindah?`)) simpan(tuju)
    else tuju()
  }

  // Yang tercetak selalu versi tersimpan (lembar khusus cetak di halaman),
  // bukan pratinjau langsung. Bila masih ada ketikan yang belum disimpan,
  // guru diberi tahu dulu supaya tidak mengira ketikannya ikut tercetak.
  function cetak() {
    if (kotor) setTanyaCetak(true)
    else window.print()
  }

  function cetakTersimpan() {
    setTanyaCetak(false)
    // Tunggu dialog selesai menutup supaya tidak ikut tercetak.
    setTimeout(() => window.print(), 250)
  }

  function simpanDulu() {
    setTanyaCetak(false)
    simpan()
  }

  const depan = (n: string) => n.split(' ')[0]

  return (
    <div className="space-y-4">
      {/* ── Penjelajah sesi ── */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border bg-card px-2 py-1.5">
        <button type="button" disabled={!sebelum || pending} onClick={() => pindah(sebelum)}
          className="inline-flex min-w-0 items-center gap-0.5 rounded-lg px-2 py-1.5 text-sm font-bold text-primary hover:bg-accent disabled:text-muted-foreground disabled:opacity-60">
          <ChevronLeft className="size-4 shrink-0" />
          <span className="max-w-[8rem] truncate">{sebelum ? singkat(sebelum.nama) : 'Awal'}</span>
        </button>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{urutan.ke} dari {urutan.dari}</span>
        <button type="button" disabled={!sesudah || pending} onClick={() => pindah(sesudah)}
          className="inline-flex min-w-0 items-center gap-0.5 rounded-lg px-2 py-1.5 text-sm font-bold text-primary hover:bg-accent disabled:text-muted-foreground disabled:opacity-60">
          <span className="max-w-[8rem] truncate">{sesudah ? singkat(sesudah.nama) : 'Akhir'}</span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
      </div>

      {/* ── Isian merah ── */}
      {isianSlot.length > 0 && (
        <IsianMerah
          slot={isianSlot}
          isian={isian}
          sisip={sisip}
          pending={pending}
          ubah={(id, teks) => { setIsian(x => ({ ...x, [id]: teks })); setKotor(true) }}
        />
      )}

      {/* ── Deskripsi bebas (template tanpa isian merah) ── */}
      {pakaiDeskripsi && (
        <Kartu ikon={<MessageSquare className="size-4" />} judul="Deskripsi perkembangan" htmlFor="deskripsi">
          <p className="text-sm text-muted-foreground">
            Yang tidak bisa dibaca dari angka: sikapnya selama halaqoh, apa yang sudah lancar, apa yang masih perlu
            dibimbing. Angka-angka di lembar rapor sudah terisi sendiri.
          </p>
          <textarea
            id="deskripsi"
            value={deskripsi}
            disabled={pending}
            rows={7}
            onChange={e => { setDeskripsi(e.target.value); setKotor(true) }}
            placeholder={`Alhamdulillah, selama pembelajaran Al-Qur'an Ananda ${nama.split(' ')[0]}…`}
            className="w-full rounded-xl border bg-card p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">{deskripsi.trim().length} huruf</p>
        </Kartu>
      )}

      {/* ── Timpaan angka ── */}
      {bisaDitimpa.length > 0 && (
        <Kartu ikon={<Gauge className="size-4" />} judul="Timpa angka">
          <p className="text-sm text-muted-foreground">
            Nilai dihitung sistem. Kosongkan untuk memakai hitungan sistem; timpa hanya bila ada pertimbangan lain —
            anak yang lama sakit, misalnya — angka asli tetap terlihat dicoret.
          </p>
          <ul className="space-y-2">
            {bisaDitimpa.map(kode => (
              <li key={kode} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-sm">{MEDAN_PER_KODE.get(kode)?.label ?? kode}</span>
                <span className={cn('text-sm tabular-nums', timpaan[kode] ? 'text-muted-foreground line-through' : 'font-medium')}>
                  {asli[kode] || '—'}
                </span>
                <Input
                  value={timpaan[kode] ?? ''}
                  disabled={pending}
                  placeholder="timpa"
                  aria-label={`Timpa ${MEDAN_PER_KODE.get(kode)?.label ?? kode}`}
                  onChange={e => { setTimpaan({ ...timpaan, [kode]: e.target.value }); setKotor(true) }}
                  className="h-11 w-20 rounded-xl text-center font-bold"
                />
              </li>
            ))}
          </ul>
        </Kartu>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border print:hidden">
        <button type="button" onClick={cetak} disabled={pending}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border bg-card px-4 text-sm font-bold hover:bg-accent disabled:opacity-60">
          <Printer className="size-4" /> Cetak
        </button>
        <button type="button" onClick={() => simpan()} disabled={pending}
          className={cn(
            'inline-flex h-11 items-center rounded-xl px-4 text-sm font-bold disabled:opacity-60',
            sesudah ? 'border bg-card hover:bg-accent' : 'flex-1 justify-center bg-primary text-primary-foreground hover:opacity-90 sm:flex-none',
          )}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </button>
        {sesudah && (
          <button type="button" disabled={pending}
            onClick={() => simpan(() => router.push(ke(sesudah.id)))}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:flex-none">
            <span className="truncate">Simpan &amp; lanjut ke {depan(sesudah.nama)}</span> <ChevronRight className="size-4 shrink-0" />
          </button>
        )}
      </div>

      <Dialog open={tanyaCetak} onOpenChange={setTanyaCetak}>
        <DialogContent className="sm:max-w-md print:hidden">
          <DialogHeader>
            <DialogTitle>Ada perubahan yang belum disimpan</DialogTitle>
            <DialogDescription>
              Yang dicetak adalah versi tersimpan, tanpa perubahan yang baru Anda ketik. Simpan dulu bila perubahan itu
              ingin ikut tercetak, lalu tekan Cetak lagi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cetakTersimpan}>
              <Printer /> Cetak versi tersimpan
            </Button>
            <Button type="button" autoFocus onClick={simpanDulu}>
              Simpan dulu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** "Aqila Rahma" → "Aqila R." untuk penjelajah sesi yang sempit. */
function singkat(nama: string) {
  const k = nama.split(/\s+/).filter(Boolean)
  return k.length > 1 ? `${k[0]} ${k[1][0]}.` : nama
}

function Kartu({ ikon, judul, sub, htmlFor, aside, children }: {
  ikon: React.ReactNode
  judul: string
  sub?: React.ReactNode
  htmlFor?: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-wash text-primary">{ikon}</span>
        <div className="min-w-0 flex-1">
          {htmlFor
            ? <label htmlFor={htmlFor} className="block font-heading text-xl leading-tight">{judul}</label>
            : <h2 className="font-heading text-xl font-normal leading-tight">{judul}</h2>}
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * Isian merah — bagian template yang boleh diganti guru, satu kolom per
 * potongan, diapit kalimat hitam di sekitarnya supaya isiannya nyambung.
 * Kalimat hitamnya sendiri tidak bisa disentuh dari sini: itu keputusan
 * koordinator. Tombol sisip bekerja pada isian yang terakhir disentuh.
 */
function IsianMerah({ slot, isian, sisip, pending, ubah }: {
  slot: IsianSlot[]
  isian: Record<string, string>
  sisip: { label: string; nilai: string }[]
  pending: boolean
  ubah: (id: string, teks: string) => void
}) {
  const kosong = slot.filter(s => !isian[s.id]?.trim()).length
  const [fokus, setFokus] = useState<string>(() => (slot.find(s => !isian[s.id]?.trim()) ?? slot[0]).id)
  const ke = Math.max(0, slot.findIndex(s => s.id === fokus))
  const terpilih = slot[ke]
  const nilaiTerpilih = isian[terpilih.id] ?? ''
  const bisaSisip = sisip.filter(x => x.nilai)

  return (
    <Kartu
      ikon={<LayoutTemplate className="size-4" />}
      judul="Isian rapor"
      sub="Kalimat dari template unit · hanya bagian merah yang diisi"
    >
      <ol className="space-y-3">
        {slot.map((s, n) => {
          const nilai = isian[s.id] ?? ''
          // Ditentukan dari template, bukan dari panjang ketikan: dulu kotak
          // berganti dari <input> ke <textarea> begitu ketikan lewat 50 huruf —
          // sebelum itu teks menggeser keluar kotak, dan saat berganti kursor
          // hilang di tengah kalimat.
          const sisipan = s.contoh.length <= 50
          const kelasKotak = cn(
            'min-w-0 max-w-full rounded-xl border px-3 py-2.5 text-sm leading-snug break-words outline-none field-sizing-content focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            nilai.trim() ? 'bg-card' : 'border-accent-warm/50 bg-accent-warm-wash',
            sisipan ? 'min-h-11 w-full resize-none sm:w-auto sm:min-w-[14rem] sm:flex-1' : 'min-h-24 w-full resize-y',
          )
          const label = `Isian ${n + 1}: setelah "${s.sebelum}"`
          return (
            <li key={s.id} className="text-sm leading-relaxed">
              {s.sebelum && <p className="mb-1.5">{s.sebelum}</p>}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {/* Selalu textarea supaya teks panjang turun ke baris berikutnya.
                    Isian yang menyambung kalimat tidak menerima Enter — baris
                    baru di tengah kalimat merusak lembar cetak. */}
                <textarea value={nilai} disabled={pending} rows={sisipan ? 1 : 3} aria-label={label}
                  onFocus={() => setFokus(s.id)}
                  onKeyDown={e => { if (sisipan && e.key === 'Enter') e.preventDefault() }}
                  onChange={e => ubah(s.id, sisipan ? e.target.value.replace(/\s*\n\s*/g, ' ') : e.target.value)}
                  placeholder={`Contoh: ${s.contoh}`} className={kelasKotak} />
                {s.sesudah && <span>{s.sesudah}</span>}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="space-y-2 border-t pt-3">
        <p className={cn('text-xs font-bold', kosong > 0 ? 'text-accent-warm' : 'text-muted-foreground')}>
          {kosong > 0 ? `${kosong} dari ${slot.length} masih kosong` : `${slot.length} isian terisi`}
          {slot.length > 1 && <span className="font-normal text-muted-foreground"> · sisipkan ke isian {ke + 1}</span>}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {bisaSisip.map(x => (
            <button
              key={x.label}
              type="button"
              disabled={pending}
              onClick={() => ubah(terpilih.id, nilaiTerpilih.trim() ? `${nilaiTerpilih.trim()} ${x.nilai}` : x.nilai)}
              title={`Sisipkan ${x.label.toLowerCase()}: ${x.nilai}`}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary-wash px-2 py-1 text-xs font-bold text-primary hover:opacity-80 disabled:opacity-50"
            >
              <Plus className="size-3 shrink-0" />
              <span className="truncate">{x.label}</span>
            </button>
          ))}
          {nilaiTerpilih !== terpilih.contoh && (
            <button
              type="button"
              disabled={pending}
              onClick={() => ubah(terpilih.id, terpilih.contoh)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" /> pakai contoh template
            </button>
          )}
        </div>
      </div>
    </Kartu>
  )
}
