'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, GraduationCap, TriangleAlert } from 'lucide-react'
import {
  naikkanKelasAction, pratinjauKenaikanAction,
  type KeputusanKelasAkhir, type RencanaKenaikan, type SiswaKelasAkhir,
} from '@/app/actions/kenaikan'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { UNIT_LABELS, UNIT_ORDER } from '@/lib/rq/programs'
import { kelasAwalUnit, ROMBEL_QULS_SD, ROMBEL_SD, rombelSmpBawaan, UNIT_LANJUTAN } from '@/lib/rq/kenaikan'
import { ROMBEL_SMP } from '@/lib/rq/kelas'
import type { AcademicTerm, Jenjang } from '@/types'

/**
 * Menaikkan seluruh angkatan satu tingkat, menuju tahun ajaran berjalan.
 *
 * Berdiri terpisah dari TermManager dan TIDAK menempel pada "Jadikan berjalan".
 * Berpindah semester adalah tindakan yang wajar diulang — koor menengok
 * semester lalu untuk memeriksa rekap, lalu kembali. Kalau kenaikan menempel di
 * sana, sekali menengok arsip akan menaikkan seluruh angkatan untuk kedua
 * kalinya.
 *
 * Pratinjaunya wajib dibuka lebih dulu. Di sana kumik memutuskan anak kelas
 * teratas tiap unit satu per satu: lanjut ke unit LHI mana, atau lulus. Untuk
 * SMA, yang dicentang menjadi alumni; sisanya tetap kelas 12.
 */

interface Pilihan {
  pilih: boolean
  ke: Jenjang
  /** Huruf rombel — SD LHI & SMP saja. */
  rombel: string
}

function pilihanAwal(s: SiswaKelasAkhir): Pilihan {
  const ke = UNIT_LANJUTAN[s.jenjang][0] ?? s.jenjang
  return { pilih: false, ke, rombel: ke === 'smp' ? rombelSmpBawaan(s.gender) : 'A' }
}

export function KenaikanKelas({ term, boleh }: { term: AcademicTerm; boleh: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const confirm = useConfirm()
  const [rencana, setRencana] = useState<RencanaKenaikan | null>(null)
  const [pilihan, setPilihan] = useState<Record<string, Pilihan>>({})

  const perUnit = useMemo(() => {
    const m = new Map<Jenjang, SiswaKelasAkhir[]>()
    for (const s of rencana?.kelasAkhir ?? []) m.set(s.jenjang, [...(m.get(s.jenjang) ?? []), s])
    return UNIT_ORDER.filter(u => m.has(u)).map(u => ({ unit: u, siswa: m.get(u)! }))
  }, [rencana])

  if (!boleh) return null

  const sudah = term.kenaikan_at

  function lihatRencana() {
    startTransition(async () => {
      const hasil = await pratinjauKenaikanAction()
      if ('error' in hasil) {
        toast.error(hasil.error)
        return
      }
      setRencana(hasil.rencana)
      setPilihan(Object.fromEntries(hasil.rencana.kelasAkhir.map(s => [s.id, pilihanAwal(s)])))
    })
  }

  function ubah(id: string, p: Partial<Pilihan>) {
    setPilihan(prev => ({ ...prev, [id]: { ...prev[id], ...p } }))
  }

  function centangSemua(siswa: SiswaKelasAkhir[], nilai: boolean) {
    setPilihan(prev => {
      const next = { ...prev }
      for (const s of siswa) next[s.id] = { ...next[s.id], pilih: nilai }
      return next
    })
  }

  function susunKeputusan(): KeputusanKelasAkhir | string {
    const lanjut: KeputusanKelasAkhir['lanjut'] = []
    const alumni: string[] = []
    for (const s of rencana?.kelasAkhir ?? []) {
      const p = pilihan[s.id]
      if (!p?.pilih) continue
      if (s.jenjang === 'sma') { alumni.push(s.id); continue }
      const kelas = kelasAwalUnit(p.ke, p.rombel)
      if (!kelas) return `Kelas tujuan ${s.nama} belum dipilih.`
      lanjut.push({ id: s.id, ke: p.ke, kelas })
    }
    return { lanjut, alumni }
  }

  async function jalankan() {
    if (!rencana) return
    const k = susunKeputusan()
    if (typeof k === 'string') { toast.error(k); return }
    const akhirNonSma = rencana.kelasAkhir.filter(s => s.jenjang !== 'sma').length
    const sma = rencana.kelasAkhir.filter(s => s.jenjang === 'sma').length
    const ok = await confirm({
      title: `Naikkan seluruh siswa menuju ${term.year_label}?`,
      description:
        `• ${rencana.naik} siswa naik satu tingkat (1A → 2A, rombel tetap)\n` +
        `• ${k.lanjut.length} siswa kelas teratas LANJUT ke unit LHI berikutnya\n` +
        `• ${akhirNonSma - k.lanjut.length} siswa kelas teratas lulus & nonaktif\n` +
        (sma > 0 ? `• ${k.alumni.length} lulusan SMA menjadi alumni, ${sma - k.alumni.length} tetap kelas 12\n` : '') +
        (rencana.dilewati.length > 0
          ? `• ${rencana.dilewati.reduce((n, d) => n + d.jumlah, 0)} siswa DILEWATI karena kelasnya tidak berpola\n`
          : '') +
        '\nHanya bisa dijalankan sekali untuk tahun ajaran ini.',
      confirmText: 'Naikkan kelas',
    })
    if (!ok) return

    startTransition(async () => {
      const hasil = await naikkanKelasAction(term.id, k)
      if ('error' in hasil) {
        toast.error(hasil.error)
        return
      }
      toast.success(
        `${hasil.naik} naik, ${hasil.lanjut} lanjut unit, ${hasil.lulus} lulus, ${hasil.alumni} alumni` +
        (hasil.gagal > 0 ? ` — ${hasil.gagal} gagal diperbarui` : '') + '.',
      )
      setRencana(null)
      router.refresh()
    })
  }

  const jumlahLanjut = Object.entries(pilihan)
    .filter(([id, p]) => p.pilih && rencana?.kelasAkhir.find(s => s.id === id)?.jenjang !== 'sma').length

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-medium">Kenaikan Kelas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Menaikkan seluruh siswa aktif satu tingkat menuju{' '}
            <b className="text-foreground">{term.year_label}</b> — angkanya naik, rombelnya
            tetap. Anak kelas teratas tiap unit dipilih dulu: yang lanjut ke unit LHI
            berikutnya pindah beserta riwayat setorannya, sisanya lulus. Lulusan SMA LHI
            yang dicentang menjadi alumni.
          </p>
        </div>
      </div>

      {sudah ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Sudah dijalankan pada {new Date(sudah).toLocaleString('id-ID')}. Tidak bisa
          diulang — mengulangnya akan menaikkan seluruh angkatan dua tingkat.
        </p>
      ) : rencana ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-muted px-2 py-1">
              <b className="tabular-nums">{rencana.naik}</b> naik satu tingkat
            </span>
            <span className="rounded-md bg-muted px-2 py-1">
              <b className="tabular-nums">{rencana.kelasAkhir.length}</b> di kelas teratas unitnya
            </span>
          </div>

          {rencana.dilewati.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-wash px-3 py-2 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-medium">
                  {rencana.dilewati.reduce((n, d) => n + d.jumlah, 0)} siswa akan dilewati
                </p>
                {/* Ditolak, bukan ditebak: '4.0' tidak punya rombel yang bisa
                    dipertahankan, dan menebaknya memindahkan anak ke kelas yang
                    tak pernah diputuskan siapa pun. */}
                <p className="mt-0.5 opacity-90">
                  Kelasnya tidak berpola angka+rombel:{' '}
                  {rencana.dilewati.map(d => `${d.kelas} (${d.jumlah})`).join(', ')}.
                  Betulkan dulu lewat menu Siswa kalau mereka harus ikut naik.
                </p>
              </div>
            </div>
          )}

          {perUnit.map(({ unit, siswa }) => (
            <UnitKelasAkhir
              key={unit}
              unit={unit}
              siswa={siswa}
              pilihan={pilihan}
              onUbah={ubah}
              onCentangSemua={v => centangSemua(siswa, v)}
              disabled={pending}
            />
          ))}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setRencana(null)}>
              Batal
            </Button>
            <Button size="sm" disabled={pending} onClick={jalankan}>
              {pending ? 'Menjalankan…' : `Naikkan ${rencana.naik} siswa · ${jumlahLanjut} lanjut unit`}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={lihatRencana}>
          {pending ? 'Menghitung…' : 'Lihat rencana kenaikan'}
        </Button>
      )}
    </div>
  )
}

function UnitKelasAkhir({ unit, siswa, pilihan, onUbah, onCentangSemua, disabled }: {
  unit: Jenjang
  siswa: SiswaKelasAkhir[]
  pilihan: Record<string, Pilihan>
  onUbah: (id: string, p: Partial<Pilihan>) => void
  onCentangSemua: (v: boolean) => void
  disabled: boolean
}) {
  const [buka, setBuka] = useState(true)
  const sma = unit === 'sma'
  const tujuan = UNIT_LANJUTAN[unit]
  const dicentang = siswa.filter(s => pilihan[s.id]?.pilih).length

  return (
    <section className="rounded-xl border">
      <button
        type="button"
        onClick={() => setBuka(b => !b)}
        aria-expanded={buka}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            {UNIT_LABELS[unit]} · kelas {[...new Set(siswa.map(s => s.kelas))].sort().join(', ')}
          </span>
          <span className="block text-xs text-muted-foreground">
            {sma
              ? `${dicentang} dari ${siswa.length} dicentang lulus → alumni · sisanya tetap kelas 12`
              : `${dicentang} dari ${siswa.length} lanjut ke ${tujuan.map(t => UNIT_LABELS[t]).join(' / ')} · sisanya lulus & nonaktif`}
          </span>
        </span>
        {buka ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {buka && (
        <div className="border-t px-3 py-2">
          <div className="mb-2 flex flex-wrap gap-3 text-xs">
            <button type="button" className="font-medium text-primary hover:underline" disabled={disabled} onClick={() => onCentangSemua(true)}>
              Centang semua
            </button>
            <button type="button" className="text-muted-foreground hover:underline" disabled={disabled} onClick={() => onCentangSemua(false)}>
              Kosongkan
            </button>
          </div>
          <ul className="divide-y">
            {siswa.map(s => {
              const p = pilihan[s.id]
              if (!p) return null
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                  <label className="flex min-w-0 flex-1 basis-56 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={p.pilih}
                      disabled={disabled}
                      onChange={e => onUbah(s.id, { pilih: e.target.checked })}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 break-words">
                      {s.nama}
                      <span className="text-xs text-muted-foreground"> · {s.kelas}{s.gender ? ` · ${s.gender === 'L' ? 'putra' : 'putri'}` : ''}</span>
                    </span>
                  </label>
                  {p.pilih && !sma && (
                    <span className="flex flex-wrap items-center gap-1.5 text-xs">
                      {tujuan.length > 1 ? (
                        <select
                          value={p.ke}
                          disabled={disabled}
                          onChange={e => onUbah(s.id, { ke: e.target.value as Jenjang, rombel: 'A' })}
                          className="h-8 rounded-md border bg-background px-2"
                          aria-label={`Unit tujuan ${s.nama}`}
                        >
                          {tujuan.map(t => <option key={t} value={t}>{UNIT_LABELS[t]}</option>)}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">→ {UNIT_LABELS[p.ke]}</span>
                      )}
                      {(p.ke === 'sd' || p.ke === 'smp') ? (
                        <select
                          value={p.rombel}
                          disabled={disabled}
                          onChange={e => onUbah(s.id, { rombel: e.target.value })}
                          className="h-8 rounded-md border bg-background px-2"
                          aria-label={`Kelas tujuan ${s.nama}`}
                        >
                          {(p.ke === 'smp' ? Object.keys(ROMBEL_SMP) : [...ROMBEL_SD]).map(r => (
                            <option key={r} value={r}>
                              {kelasAwalUnit(p.ke, r)}
                              {p.ke === 'smp'
                                ? ` · ${ROMBEL_SMP[r].boarding ? 'boarding' : 'fullday'} ${ROMBEL_SMP[r].gender === 'L' ? 'putra' : 'putri'}`
                                : r === ROMBEL_QULS_SD ? ' · QULS' : ' · CLIL'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium">kelas {kelasAwalUnit(p.ke, null)}</span>
                      )}
                    </span>
                  )}
                  {p.pilih && sma && <span className="text-xs font-medium text-success">Lulus → alumni</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
