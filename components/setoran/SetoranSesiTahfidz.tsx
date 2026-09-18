'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StarInput } from '@/components/setoran/StarInput'
import { cn } from '@/lib/utils'
import { TAHFIDZ_KIND_META } from '@/lib/tahsin'
import { bolehLintasSurat, periksaRentang } from '@/lib/rq/rentang-surat'
import { createTahfidzLogSesiAction, type InputSetoranTahfidz } from '@/app/actions/setoran'
import { PerbandinganSetoranDialog } from '@/components/setoran/PerbandinganSetoranDialog'
import type { SetoranGanda } from '@/lib/data/setoran-ganda'
import type { SiswaSesiTahfidz } from '@/lib/data/setoran-sesi'

type Jenis = 'ziyadah' | 'murojaah_baru' | 'murojaah_lama'
const JENIS: Jenis[] = ['ziyadah', 'murojaah_baru', 'murojaah_lama']

export interface SuratPilihan {
  id: number
  name_latin: string
  total_ayat: number
  juz_start: number
}

interface Isian {
  dipilih: boolean
  kind: Jenis
  surat_id: string
  ayat_dari: string
  /** Surat akhir muroja'ah lintas surat; kosong = surat yang sama. */
  surat_ke_id: string
  ayat_ke: string
  nilai_tahfidz: number | null
  nilai_sikap: number | null
  catatan: string
  versi: number
  galat?: string
}

/**
 * Isian awal melanjutkan ziyadah terakhir: surat yang sama, mulai ayat
 * sesudah ayat terakhir. Surat yang sudah habis dibiarkan kosong — urutan
 * hafalan RQ tidak selalu surat berikutnya menurut nomor, jadi tidak ditebak.
 */
function isianAwal(s: SiswaSesiTahfidz, surat: SuratPilihan[], versi = 0): Isian {
  const t = s.terakhir
  const info = t ? surat.find(x => x.id === t.surat_id) : undefined
  const lanjut = t && info && t.ayat_ke < info.total_ayat
  return {
    dipilih: false,
    kind: 'ziyadah',
    surat_id: lanjut ? String(t.surat_id) : '',
    ayat_dari: lanjut ? String(t.ayat_ke + 1) : '',
    surat_ke_id: '',
    ayat_ke: '',
    nilai_tahfidz: null,
    nilai_sikap: null,
    catatan: '',
    versi,
  }
}

const SELECT_CLASS =
  'h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/** Setoran tahfidz satu sesi dalam satu layar — pola yang sama dengan tahsin. */
export function SetoranSesiTahfidz({ siswa, surat }: { siswa: SiswaSesiTahfidz[]; surat: SuratPilihan[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Anak yang hari itu sudah punya setoran jenis yang sama: menunggu keputusan guru.
  const [ganda, setGanda] = useState<SetoranGanda[]>([])
  const [tertunda, setTertunda] = useState<InputSetoranTahfidz[]>([])
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [isian, setIsian] = useState<Record<string, Isian>>(
    () => Object.fromEntries(siswa.map(s => [s.id, isianAwal(s, surat)])),
  )

  const jumlahDipilih = siswa.filter(s => isian[s.id]?.dipilih).length

  function ubah(id: string, perubahan: Partial<Isian>) {
    setIsian(prev => ({ ...prev, [id]: { ...prev[id], ...perubahan, galat: undefined } }))
  }

  function pilihSemua(nilai: boolean) {
    setIsian(prev => Object.fromEntries(Object.entries(prev).map(([id, v]) => [id, { ...v, dipilih: nilai }])))
  }

  function simpan() {
    const dipilih = siswa.filter(s => isian[s.id].dipilih)
    if (dipilih.length === 0) {
      toast.error('Centang minimal satu anak yang setor.')
      return
    }
    const baris = dipilih.map(s => {
      const v = isian[s.id]
      return {
        student_id: s.id,
        kind: v.kind,
        surat_id: v.surat_id ? Number(v.surat_id) : null,
        ayat_dari: v.ayat_dari ? Number(v.ayat_dari) : null,
        surat_ke_id: bolehLintasSurat(v.kind) && v.surat_ke_id ? Number(v.surat_ke_id) : null,
        ayat_ke: v.ayat_ke ? Number(v.ayat_ke) : null,
        nilai_tahfidz: v.nilai_tahfidz,
        nilai_sikap: v.nilai_sikap,
        catatan: v.catatan || null,
        setoran_date: tanggal,
      }
    })

    kirim(baris)
  }

  function kirim(baris: InputSetoranTahfidz[]) {
    const dikirim = siswa.filter(s => baris.some(b => b.student_id === s.id))
    startTransition(async () => {
      const hasil = await createTahfidzLogSesiAction(baris)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      // Yang tertahan karena sudah ada setoran hari itu bukan galat: isiannya
      // dibiarkan utuh sampai guru memilih timpa atau batal di dialog.
      const tertahan = hasil.gagal.filter(g => g.ganda)
      setGanda(tertahan.map(g => g.ganda!))
      setTertunda(baris.filter(b => tertahan.some(g => g.student_id === b.student_id)))
      const ditahan = new Set(tertahan.map(g => g.student_id))
      const gagal = new Map(hasil.gagal.filter(g => !g.ganda).map(g => [g.student_id, g.pesan]))
      setIsian(prev => {
        const next = { ...prev }
        for (const s of dikirim) {
          if (ditahan.has(s.id)) continue
          const v = prev[s.id]
          if (gagal.has(s.id)) {
            next[s.id] = { ...v, galat: gagal.get(s.id) }
          } else {
            // Ziyadah yang baru tersimpan jadi titik lanjut isian berikutnya.
            const info = surat.find(x => String(x.id) === v.surat_id)
            const ke = Number(v.ayat_ke)
            const sisa = v.kind === 'ziyadah' && info && ke < info.total_ayat
            next[s.id] = {
              ...isianAwal(s, surat, v.versi + 1),
              ...(v.kind === 'ziyadah'
                ? { surat_id: sisa ? v.surat_id : '', ayat_dari: sisa ? String(ke + 1) : '' }
                : {}),
            }
          }
        }
        return next
      })
      if (hasil.tersimpan > 0) toast.success(`${hasil.tersimpan} setoran tersimpan.`)
      if (gagal.size > 0) toast.error(`${gagal.size} setoran belum tersimpan — lihat tanda merah.`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <PerbandinganSetoranDialog
        daftar={ganda}
        pending={pending}
        onTimpa={() => kirim(tertunda.map(b => ({ ...b, timpa: true })))}
        onBatal={() => { setGanda([]); setTertunda([]) }}
      />
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <div className="space-y-1">
          <label htmlFor="tanggal_sesi_tf" className="text-xs font-medium">Tanggal setor</label>
          <Input id="tanggal_sesi_tf" type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-9 w-44" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => pilihSemua(true)}>Centang semua</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => pilihSemua(false)}>Kosongkan</Button>
        </div>
      </div>

      <ul className="space-y-2">
        {siswa.map(s => {
          const v = isian[s.id]
          const info = surat.find(x => String(x.id) === v.surat_id)
          const lintas = bolehLintasSurat(v.kind)
          const suratKe = lintas && v.surat_ke_id && v.surat_ke_id !== v.surat_id ? Number(v.surat_ke_id) : null
          const infoAkhir = suratKe ? surat.find(x => x.id === suratKe) : info
          const galatRentang = info && v.ayat_dari && v.ayat_ke
            ? periksaRentang(
                { surat_id: info.id, ayat_dari: Number(v.ayat_dari), surat_ke_id: suratKe, ayat_ke: Number(v.ayat_ke) },
                id => surat.find(x => x.id === id),
              )
            : null
          return (
            <li
              key={s.id}
              className={cn(
                'rounded-xl border bg-card p-3 transition-colors',
                v.dipilih && 'border-primary/60',
                v.galat && 'border-destructive',
              )}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={v.dipilih}
                  onChange={e => ubah(s.id, { dipilih: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {s.full_name}
                    {s.drill.map(d => (
                      <span
                        key={d.juz}
                        className="rounded-full bg-warning-wash px-1.5 py-px text-[10px] font-semibold text-warning"
                        title={`Ziyadah Juz ${d.juz} tuntas ${d.sejak} — ajukan ujian 1 juz`}
                      >
                        JUZ {d.juz} DRILL
                      </span>
                    ))}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.terakhir ? `Ziyadah terakhir: ${s.terakhir.surat} ayat ${s.terakhir.ayat_ke}` : 'Belum ada ziyadah'}
                    {s.kelas ? ` · Kelas ${s.kelas}` : ''}
                  </span>
                </span>
              </label>

              {v.dipilih && (
                <div className="mt-3 space-y-3 border-t pt-3 pl-7">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jenis setoran">
                    {JENIS.map(k => {
                      const meta = TAHFIDZ_KIND_META[k]
                      const aktif = v.kind === k
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => ubah(s.id, { kind: k })}
                          aria-pressed={aktif}
                          className="h-8 rounded-md border px-2.5 text-xs"
                          style={aktif ? { borderColor: meta.fg, background: meta.bg, color: meta.fg } : undefined}
                        >
                          {meta.emoji} {meta.label}
                        </button>
                      )
                    })}
                  </div>

                  {lintas ? (
                    /* Muroja'ah: "dari surat … ayat … sampai surat … ayat …". */
                    <div className="space-y-2">
                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <label className="text-xs font-medium" htmlFor={`surat-${s.id}`}>Dari surat</label>
                          <select
                            id={`surat-${s.id}`}
                            value={v.surat_id}
                            onChange={e => ubah(s.id, { surat_id: e.target.value })}
                            className={cn(SELECT_CLASS, 'w-full')}
                          >
                            <option value="">Pilih surat…</option>
                            {surat.map(x => (
                              <option key={x.id} value={x.id}>{x.id}. {x.name_latin} ({x.total_ayat})</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium" htmlFor={`dari-${s.id}`}>Ayat</label>
                          <Input
                            id={`dari-${s.id}`} type="number" inputMode="numeric" min={1}
                            max={info?.total_ayat}
                            value={v.ayat_dari} onChange={e => ubah(s.id, { ayat_dari: e.target.value })}
                            className="h-9 w-20"
                          />
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <label className="text-xs font-medium" htmlFor={`suratke-${s.id}`}>Sampai surat</label>
                          <select
                            id={`suratke-${s.id}`}
                            value={v.surat_ke_id}
                            onChange={e => ubah(s.id, { surat_ke_id: e.target.value })}
                            className={cn(SELECT_CLASS, 'w-full')}
                          >
                            <option value="">{info ? `Surat yang sama (${info.name_latin})` : 'Surat yang sama'}</option>
                            {surat.map(x => (
                              <option key={x.id} value={x.id}>{x.id}. {x.name_latin} ({x.total_ayat})</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium" htmlFor={`ke-${s.id}`}>Ayat</label>
                          <Input
                            id={`ke-${s.id}`} type="number" inputMode="numeric" min={1}
                            max={infoAkhir?.total_ayat}
                            value={v.ayat_ke} onChange={e => ubah(s.id, { ayat_ke: e.target.value })}
                            className="h-9 w-20"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <label className="text-xs font-medium" htmlFor={`surat-${s.id}`}>Surat</label>
                        <select
                          id={`surat-${s.id}`}
                          value={v.surat_id}
                          onChange={e => ubah(s.id, { surat_id: e.target.value })}
                          className={cn(SELECT_CLASS, 'w-full')}
                        >
                          <option value="">Pilih surat…</option>
                          {surat.map(x => (
                            <option key={x.id} value={x.id}>{x.id}. {x.name_latin} ({x.total_ayat})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium" htmlFor={`dari-${s.id}`}>Ayat</label>
                        <div className="flex items-center gap-1">
                          <Input
                            id={`dari-${s.id}`} type="number" inputMode="numeric" min={1} placeholder="dari"
                            value={v.ayat_dari} onChange={e => ubah(s.id, { ayat_dari: e.target.value })}
                            className="h-9 w-20"
                          />
                          <span className="text-muted-foreground">–</span>
                          <Input
                            aria-label="Ayat ke" type="number" inputMode="numeric" min={1} placeholder="ke"
                            max={info?.total_ayat}
                            value={v.ayat_ke} onChange={e => ubah(s.id, { ayat_ke: e.target.value })}
                            className="h-9 w-20"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {galatRentang && <p className="text-xs text-destructive">{galatRentang}</p>}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div key={`t-${v.versi}`}>
                      <p className="mb-1 text-xs font-medium">Nilai tahfidz</p>
                      <StarInput name={`nilai_tahfidz_${s.id}`} onChange={(b, n) => ubah(s.id, { nilai_tahfidz: b > 0 ? n : null })} />
                    </div>
                    <div key={`s-${v.versi}`}>
                      <p className="mb-1 text-xs font-medium">Nilai sikap</p>
                      <StarInput name={`nilai_sikap_tf_${s.id}`} onChange={(b, n) => ubah(s.id, { nilai_sikap: b > 0 ? n : null })} />
                    </div>
                  </div>

                  <Input
                    placeholder="Catatan (opsional)"
                    value={v.catatan}
                    onChange={e => ubah(s.id, { catatan: e.target.value })}
                    className="h-9"
                  />
                  {v.galat && <p role="alert" className="text-xs font-medium text-destructive">{v.galat}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <Button type="button" size="lg" className="w-full" onClick={simpan} disabled={pending || jumlahDipilih === 0}>
          {pending ? 'Menyimpan…' : jumlahDipilih > 0 ? `Simpan ${jumlahDipilih} setoran` : 'Centang anak yang setor'}
        </Button>
      </div>
    </div>
  )
}
