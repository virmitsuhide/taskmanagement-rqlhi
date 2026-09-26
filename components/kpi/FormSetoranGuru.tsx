'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BookMarked, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StarInput } from '@/components/setoran/StarInput'
import { cn } from '@/lib/utils'
import { simpanSetoranGuruAction, type InputSetoranGuru } from '@/app/actions/setoran-guru'
import { labelPosisi, posisiHafalan, type JenisSetoranGuru } from '@/lib/rq/setoran-guru'

export interface SuratSetoran { id: number; name_latin: string; total_ayat: number }

export interface GuruFormSetoran {
  id: string
  nama: string
  /** Setoran tahfidz terakhir (sepanjang waktu) — untuk melanjutkan isian. */
  tahfidz: { surat_id: number; ayat_ke: number; juz_selesai: number } | null
  /** Bait terakhir Tuhfatul Athfal. */
  tuhfatul: { bait_ke: number } | null
}

interface Isian {
  dipilih: boolean
  surat_id: string
  ayat_dari: string
  ayat_ke: string
  juz_selesai: string
  bait_dari: string
  bait_ke: string
  nilai: number | null
  catatan: string
}

/** Lanjut dari setoran terakhir: surat & ayat sesudahnya, bait sesudahnya, juz selesai yang sama. */
function isianAwal(g: GuruFormSetoran, surat: SuratSetoran[]): Isian {
  const t = g.tahfidz
  const info = t ? surat.find(s => s.id === t.surat_id) : undefined
  const lanjut = t && info && t.ayat_ke < info.total_ayat
  const juzSelesai = t ? posisiHafalan(t).juz : 0
  const baitLanjut = g.tuhfatul && g.tuhfatul.bait_ke < 61 ? g.tuhfatul.bait_ke + 1 : null
  return {
    dipilih: false,
    surat_id: lanjut ? String(t.surat_id) : '',
    ayat_dari: lanjut ? String(t.ayat_ke + 1) : '',
    ayat_ke: '',
    juz_selesai: String(juzSelesai),
    bait_dari: baitLanjut ? String(baitLanjut) : g.tuhfatul ? '' : '1',
    bait_ke: '',
    nilai: null,
    catatan: '',
  }
}

const KELAS_INPUT = 'h-9 min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

/**
 * Setoran guru satu sesi simak: pilih jenis (tahfidz / Tuhfatul Athfal),
 * centang guru yang setor, isi rentangnya, beri bintang kualitas. Pola yang
 * sama dengan setoran per sesi siswa, tanpa penilaian adab.
 */
export function FormSetoranGuru({ guru, surat, tanggalAwal, tanggalMaks }: {
  guru: GuruFormSetoran[]
  surat: SuratSetoran[]
  tanggalAwal: string
  tanggalMaks: string
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [jenis, setJenis] = useState<JenisSetoranGuru>('tahfidz')
  const [tanggal, setTanggal] = useState(tanggalAwal)
  const [isian, setIsian] = useState<Record<string, Isian>>(() => Object.fromEntries(guru.map(g => [g.id, isianAwal(g, surat)])))
  // Kunci ulang StarInput sesudah simpan supaya bintangnya kosong kembali.
  const [versi, setVersi] = useState(0)

  const ubah = (id: string, p: Partial<Isian>) => setIsian(prev => ({ ...prev, [id]: { ...prev[id], ...p } }))
  const dipilih = guru.filter(g => isian[g.id]?.dipilih)

  function simpan() {
    if (dipilih.length === 0) { toast.error('Centang minimal satu guru yang setor.'); return }
    const baris: InputSetoranGuru[] = []
    for (const g of dipilih) {
      const v = isian[g.id]
      if (jenis === 'tahfidz') {
        if (!v.surat_id || !v.ayat_dari) { toast.error(`${g.nama}: pilih surat dan ayat awal.`); return }
        baris.push({
          teacher_id: g.id, tanggal, jenis, surat_id: Number(v.surat_id), ayat_dari: Number(v.ayat_dari),
          ayat_ke: Number(v.ayat_ke || v.ayat_dari), juz_selesai: Number(v.juz_selesai || 0), nilai: v.nilai, catatan: v.catatan,
        })
      } else {
        if (!v.bait_dari) { toast.error(`${g.nama}: isi nomor bait.`); return }
        baris.push({ teacher_id: g.id, tanggal, jenis, bait_dari: Number(v.bait_dari), bait_ke: Number(v.bait_ke || v.bait_dari), nilai: v.nilai, catatan: v.catatan })
      }
    }
    mulai(async () => {
      const r = await simpanSetoranGuruAction(baris)
      if (r.error) { toast.error(r.error); return }
      const kpi = [
        r.kpiDiperbarui ? `${r.kpiDiperbarui} KPI ikut diperbarui` : '',
        r.kpiTerkunci ? `${r.kpiTerkunci} KPI sudah terkunci, tidak diubah` : '',
      ].filter(Boolean).join(' · ')
      toast.success(`${baris.length} setoran tersimpan.${kpi ? ` ${kpi}.` : ''}`)
      // Isian berikutnya melanjutkan dari yang barusan disetor.
      setIsian(prev => {
        const next = { ...prev }
        for (const b of baris) {
          const g = guru.find(x => x.id === b.teacher_id)!
          const baru: GuruFormSetoran = jenis === 'tahfidz'
            ? { ...g, tahfidz: { surat_id: b.surat_id!, ayat_ke: b.ayat_ke!, juz_selesai: b.juz_selesai! } }
            : { ...g, tuhfatul: { bait_ke: b.bait_ke! } }
          next[b.teacher_id] = isianAwal(baru, surat)
        }
        return next
      })
      setVersi(n => n + 1)
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div role="tablist" aria-label="Jenis setoran" className="flex gap-0.5 rounded-[10px] bg-muted p-[3px]">
          {([['tahfidz', 'Tahfidz', BookMarked], ['tuhfatul', 'Tuhfatul Athfal', ScrollText]] as const).map(([k, label, Ikon]) => (
            <button key={k} type="button" role="tab" aria-selected={jenis === k} onClick={() => setJenis(k)}
              className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
                jenis === k ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Ikon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Tanggal</span>
          <input type="date" value={tanggal} max={tanggalMaks} onChange={e => setTanggal(e.target.value)} className={KELAS_INPUT} />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <span>{dipilih.length} dari {guru.length} guru dipilih · bintang = kualitas bacaan/hafalan (catatan, tidak mengubah nilai KPI)</span>
        <span className="flex gap-3">
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setIsian(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, dipilih: true }])))}>Pilih semua</button>
          <button type="button" className="font-semibold hover:underline" onClick={() => setIsian(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, dipilih: false }])))}>Kosongkan</button>
        </span>
      </div>

      <ul className="divide-y">
        {guru.map(g => {
          const v = isian[g.id]
          const info = surat.find(s => String(s.id) === v.surat_id)
          const pratinjau = jenis === 'tahfidz' && v.surat_id && (v.ayat_ke || v.ayat_dari)
            ? labelPosisi(posisiHafalan({ surat_id: Number(v.surat_id), ayat_ke: Number(v.ayat_ke || v.ayat_dari), juz_selesai: Number(v.juz_selesai || 0) }))
            : null
          const terakhir = jenis === 'tahfidz'
            ? g.tahfidz ? `terakhir ${surat.find(s => s.id === g.tahfidz!.surat_id)?.name_latin ?? ''} ayat ${g.tahfidz.ayat_ke} · ${labelPosisi(posisiHafalan(g.tahfidz))}` : 'belum pernah setor'
            : g.tuhfatul ? `terakhir s.d. bait ${g.tuhfatul.bait_ke}` : 'belum pernah setor'
          return (
            <li key={g.id} className={cn('px-4 py-3', v.dipilih && 'bg-primary-wash/40')}>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={v.dipilih} onChange={e => ubah(g.id, { dipilih: e.target.checked })} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{g.nama}</span>
                  <span className="block text-xs text-muted-foreground">{terakhir}</span>
                </span>
              </label>
              {v.dipilih && (
                <div className="mt-2.5 space-y-2.5 pl-6">
                  {jenis === 'tahfidz' ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex min-w-0 flex-1 basis-40 flex-col gap-1 text-xs text-muted-foreground">Surat
                        <select value={v.surat_id} onChange={e => ubah(g.id, { surat_id: e.target.value, ayat_dari: '1', ayat_ke: '' })} className={KELAS_INPUT}>
                          <option value="">— Pilih surat —</option>
                          {surat.map(s => <option key={s.id} value={s.id}>{s.id}. {s.name_latin}</option>)}
                        </select>
                      </label>
                      <label className="flex w-20 flex-col gap-1 text-xs text-muted-foreground">Ayat dari
                        <input type="number" min={1} max={info?.total_ayat} value={v.ayat_dari} onChange={e => ubah(g.id, { ayat_dari: e.target.value })} className={KELAS_INPUT} />
                      </label>
                      <label className="flex w-20 flex-col gap-1 text-xs text-muted-foreground">s.d. ayat
                        <input type="number" min={1} max={info?.total_ayat} value={v.ayat_ke} placeholder={v.ayat_dari} onChange={e => ubah(g.id, { ayat_ke: e.target.value })} className={KELAS_INPUT} />
                      </label>
                      <label className="flex w-24 flex-col gap-1 text-xs text-muted-foreground" title="Jumlah juz yang sudah selesai sebelum juz yang sedang dihafal">Juz selesai
                        <input type="number" min={0} max={30} value={v.juz_selesai} onChange={e => ubah(g.id, { juz_selesai: e.target.value })} className={KELAS_INPUT} />
                      </label>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex w-24 flex-col gap-1 text-xs text-muted-foreground">Bait dari
                        <input type="number" min={1} max={61} value={v.bait_dari} onChange={e => ubah(g.id, { bait_dari: e.target.value })} className={KELAS_INPUT} />
                      </label>
                      <label className="flex w-24 flex-col gap-1 text-xs text-muted-foreground">s.d. bait
                        <input type="number" min={1} max={61} value={v.bait_ke} placeholder={v.bait_dari} onChange={e => ubah(g.id, { bait_ke: e.target.value })} className={KELAS_INPUT} />
                      </label>
                      <span className="pb-2 text-xs text-muted-foreground">dari 61 bait</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">Kualitas
                      <StarInput key={`${g.id}-${jenis}-${versi}`} name={`nilai-${g.id}`} onChange={(_, nilai) => ubah(g.id, { nilai: nilai || null })} />
                    </span>
                    {pratinjau && <span className="text-xs font-medium text-primary">Posisi hafalan → {pratinjau}</span>}
                    {jenis === 'tuhfatul' && (v.bait_ke || v.bait_dari) && <span className="text-xs font-medium text-primary">Posisi → bait {v.bait_ke || v.bait_dari}</span>}
                  </div>
                  <input value={v.catatan} onChange={e => ubah(g.id, { catatan: e.target.value })} placeholder="Catatan (opsional)" className={cn(KELAS_INPUT, 'w-full')} />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="sticky bottom-0 flex justify-end border-t bg-card/95 px-4 py-3 backdrop-blur">
        <Button onClick={simpan} disabled={pending || dipilih.length === 0}>
          {pending ? 'Menyimpan…' : `Simpan ${dipilih.length || ''} setoran ${jenis === 'tahfidz' ? 'tahfidz' : 'Tuhfatul Athfal'}`}
        </Button>
      </div>
    </section>
  )
}
