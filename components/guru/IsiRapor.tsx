'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, Printer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { simpanRaporIsianAction } from '@/app/actions/rapor-isian'
import { MEDAN_PER_KODE, type KodeMedan } from '@/lib/rapor/medan'
import { cn } from '@/lib/utils'

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

  return (
    <div className="space-y-4">
      {/* ── Penjelajah sesi ── */}
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2">
        <Button type="button" variant="outline" size="sm" disabled={!sebelum || pending} onClick={() => pindah(sebelum)}>
          <ChevronLeft />
          <span className="max-w-[9rem] truncate">{sebelum?.nama ?? 'Awal'}</span>
        </Button>
        <span className="shrink-0 text-xs text-muted-foreground">{urutan.ke} dari {urutan.dari}</span>
        <Button type="button" variant="outline" size="sm" disabled={!sesudah || pending} onClick={() => pindah(sesudah)}>
          <span className="max-w-[9rem] truncate">{sesudah?.nama ?? 'Akhir'}</span>
          <ChevronRight />
        </Button>
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
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <label className="font-semibold" htmlFor="deskripsi">Deskripsi perkembangan</label>
            <span className="text-xs text-muted-foreground">{deskripsi.trim().length} huruf</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Yang tidak bisa dibaca dari angka: sikapnya selama halaqoh, apa yang sudah lancar, apa yang masih perlu
            dibimbing. Angka-angka di lembar rapor sudah terisi sendiri.
          </p>
          <textarea
            id="deskripsi"
            value={deskripsi}
            disabled={pending}
            rows={9}
            onChange={e => { setDeskripsi(e.target.value); setKotor(true) }}
            placeholder={`Alhamdulillah, selama pembelajaran Al-Qur'an Ananda ${nama.split(' ')[0]}…`}
            className="w-full rounded-md border bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      )}

      {/* ── Timpaan angka ── */}
      {bisaDitimpa.length > 0 && (
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer font-semibold">Timpa angka</summary>
          <p className="mt-1 text-sm text-muted-foreground">
            Kosongkan untuk memakai hitungan sistem. Diisi hanya bila ada pertimbangan lain — anak yang lama sakit,
            misalnya, yang rata-ratanya turun bukan karena kemampuannya.
          </p>
          <ul className="mt-3 space-y-2">
            {bisaDitimpa.map(kode => (
              <li key={kode} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[13rem] flex-1 text-sm">{MEDAN_PER_KODE.get(kode)?.label ?? kode}</span>
                <span className={cn('text-sm tabular-nums', timpaan[kode] ? 'text-muted-foreground line-through' : 'font-medium')}>
                  {asli[kode] || '—'}
                </span>
                <Input
                  value={timpaan[kode] ?? ''}
                  disabled={pending}
                  placeholder="timpa"
                  onChange={e => { setTimpaan({ ...timpaan, [kode]: e.target.value }); setKotor(true) }}
                  className="h-9 w-24"
                />
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <Button type="button" variant="outline" onClick={() => window.print()} disabled={pending}>
          <Printer /> Cetak
        </Button>
        <Button type="button" className="flex-1" onClick={() => simpan()} disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </Button>
        {sesudah && (
          <Button type="button" variant="secondary" disabled={pending}
            onClick={() => simpan(() => router.push(ke(sesudah.id)))}>
            Simpan & lanjut <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Isian merah — bagian template yang boleh diganti guru, satu kolom per
 * potongan, lengkap dengan kalimat hitam di sekitarnya. Kalimat hitamnya
 * sendiri tidak bisa disentuh dari sini: itu keputusan koordinator.
 */
function IsianMerah({ slot, isian, sisip, pending, ubah }: {
  slot: IsianSlot[]
  isian: Record<string, string>
  sisip: { label: string; nilai: string }[]
  pending: boolean
  ubah: (id: string, teks: string) => void
}) {
  const kosong = slot.filter(s => !isian[s.id]?.trim()).length
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">Isian rapor</h2>
          <span className={cn('text-xs', kosong > 0 ? 'text-warning' : 'text-muted-foreground')}>
            {kosong > 0 ? `${kosong} dari ${slot.length} masih kosong` : `${slot.length} isian terisi`}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Hanya bagian yang merah di template yang bisa diubah. Kalimat di sekitarnya ditampilkan supaya isiannya
          nyambung.
        </p>
      </div>

      <ol className="space-y-3">
        {slot.map((s, n) => {
          const nilai = isian[s.id] ?? ''
          return (
            <li key={s.id} className="rounded-lg border bg-muted/20 p-3">
              <p className="mb-1.5 text-xs leading-relaxed text-muted-foreground">
                <span className="mr-1 font-semibold tabular-nums text-foreground">{n + 1}.</span>
                {s.sebelum || '(awal kalimat)'}{' '}
                <span className="rounded bg-destructive-wash px-1 font-medium text-destructive">▢</span>{' '}
                {s.sesudah}
              </p>
              <textarea
                value={nilai}
                disabled={pending}
                rows={nilai.length > 60 || s.contoh.length > 60 ? 3 : 1}
                onChange={e => ubah(s.id, e.target.value)}
                placeholder={`Contoh: ${s.contoh}`}
                aria-label={`Isian ${n + 1}: setelah "${s.sebelum}"`}
                className={cn(
                  'w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                  !nilai.trim() && 'border-warning/60',
                )}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {sisip.filter(x => x.nilai).map(x => (
                  <button
                    key={x.label}
                    type="button"
                    disabled={pending}
                    onClick={() => ubah(s.id, nilai.trim() ? `${nilai.trim()} ${x.nilai}` : x.nilai)}
                    title={`Sisipkan ${x.label.toLowerCase()}: ${x.nilai}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <span className="truncate">{x.label}: <b className="font-medium">{x.nilai}</b></span>
                  </button>
                ))}
                {nilai !== s.contoh && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => ubah(s.id, s.contoh)}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" /> pakai contoh template
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
