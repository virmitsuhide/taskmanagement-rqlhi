'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { setorSesiGukarAction, type InputSetorGukar } from '@/app/actions/gukar'
import {
  formatHafalanGukar, ringkasPosisiTahfidz, ringkasPosisiTahsin, suratTahsinTersedia, type TahapJilid,
} from '@/lib/rq/gukar-setoran'
import { labelHariSetor, siklusDari, type StatusSetoranBulan } from '@/lib/rq/gukar-siklus'
import type { MetodeTahsin, SuratRingkas } from '@/lib/data/gukar'
import type { GukarMonthly, GukarParticipant } from '@/types'

interface Props {
  groupId: string
  /** 'YYYY-MM-DD' WIB dari server — batas atas tanggal setor. */
  hariIni: string
  status: StatusSetoranBulan
  participants: GukarParticipant[]
  /** Baris bulan berjalan per peserta — asal posisi awal & sedang. */
  bulanIni: Record<string, GukarMonthly>
  /** Baris terakhir sebelum bulan ini — asal posisi bila bulan ini belum setor. */
  sebelumnya: Record<string, GukarMonthly>
  metode: MetodeTahsin[]
  tahapan: Record<string, TahapJilid[]>
  surat: SuratRingkas[]
}

interface Isian {
  dipilih: boolean
  metode_id: string
  jilid_id: string
  halaman: string
  tahsin_surat: string
  tahsin_ayat: string
  tahfidz_surat: string
  tahfidz_ayat: string
  galat?: string
}

const teks = (n: number | string | null | undefined) => (n === null || n === undefined ? '' : String(n))

/**
 * Isian diisi di muka dengan posisi paling baru: setoran sedang bulan ini,
 * atau bila belum ada, setoran akhir bulan lalu. Pengampu cukup menggeser
 * angkanya maju — mengetik ulang jilid, surat, dan ayat untuk belasan orang
 * tiap sesi adalah cara tercepat membuat isian ini ditinggalkan.
 */
function isianAwal(p: GukarParticipant, kini?: GukarMonthly, lalu?: GukarMonthly): Isian {
  const asal = kini?.setoran_terakhir ? kini : lalu
  return {
    dipilih: false,
    metode_id: p.metode_id ?? '',
    jilid_id: teks(asal?.jilid_id),
    halaman: teks(asal?.halaman),
    tahsin_surat: teks(asal?.tahsin_surat),
    tahsin_ayat: teks(asal?.tahsin_ayat),
    tahfidz_surat: teks(asal?.tahfidz_surat),
    tahfidz_ayat: teks(asal?.tahfidz_ayat),
  }
}

const selectCls = 'h-9 w-full rounded-md border bg-card px-2 text-sm disabled:opacity-50'

/**
 * Setoran seluruh peserta satu kelompok dalam satu layar.
 *
 * Peserta yang tidak dicentang tidak disentuh sama sekali. Tiap peserta yang
 * dicentang menjadi satu setoran pada tanggal terpilih: yang pertama bulan
 * ini tercatat sebagai AWAL, sesudahnya menimpa posisi SEDANG.
 */
export function SetoranSesiGukar({
  groupId, hariIni, status, participants, bulanIni, sebelumnya, metode, tahapan, surat,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tanggal, setTanggal] = useState(hariIni)
  const [isian, setIsian] = useState<Record<string, Isian>>(
    () => Object.fromEntries(participants.map(p => [p.id, isianAwal(p, bulanIni[p.id], sebelumnya[p.id])])),
  )

  const terkunci = status !== 'berjalan'
  const jumlahDipilih = participants.filter(p => isian[p.id]?.dipilih).length
  const siklusIni = siklusDari(hariIni)
  const namaSurat = (id: number) => surat.find(s => s.id === id)?.nama ?? `Surat ${id}`
  const panjangSurat = (id: number) => surat.find(s => s.id === id)?.ayat ?? null
  const semuaTahap = Object.values(tahapan).flat()

  function ubah(id: string, perubahan: Partial<Isian>) {
    setIsian(prev => ({ ...prev, [id]: { ...prev[id], ...perubahan, galat: undefined } }))
  }

  function simpan() {
    const baris: InputSetorGukar[] = participants
      .filter(p => isian[p.id].dipilih)
      .map(p => {
        const v = isian[p.id]
        const num = (s: string) => (s.trim() ? Number(s) : null)
        return {
          participant_id: p.id,
          metode_id: v.metode_id || null,
          jilid_id: v.jilid_id || null,
          halaman: num(v.halaman),
          tahsin_surat: num(v.tahsin_surat),
          tahsin_ayat: num(v.tahsin_ayat),
          tahfidz_surat: num(v.tahfidz_surat),
          tahfidz_ayat: num(v.tahfidz_ayat),
        }
      })
    if (baris.length === 0) {
      toast.error('Centang minimal satu peserta yang setor.')
      return
    }

    startTransition(async () => {
      const hasil = await setorSesiGukarAction(groupId, tanggal, baris)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      const gagal = new Map(hasil.gagal.map(g => [g.participant_id, g.pesan]))
      setIsian(prev => {
        const next = { ...prev }
        for (const b of baris) {
          // Yang tersimpan cukup dilepas centangnya; angkanya sudah menjadi
          // posisi sedang yang baru, jadi dibiarkan sebagai titik isian berikutnya.
          next[b.participant_id] = gagal.has(b.participant_id)
            ? { ...prev[b.participant_id], galat: gagal.get(b.participant_id) }
            : { ...prev[b.participant_id], dipilih: false }
        }
        return next
      })
      if (hasil.tersimpan > 0) toast.success(`${hasil.tersimpan} setoran tersimpan.`)
      if (hasil.gagal.length > 0) toast.error(`${hasil.gagal.length} setoran belum tersimpan — lihat tanda merah.`)
      router.refresh()
    })
  }

  if (terkunci) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p>
          Setoran bulan ini sudah dikunci sebagai <strong>setoran akhir</strong>.
          {status === 'dikunci' && ' Buka kuncinya dari papan bulanan bila masih ada yang perlu disetor.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3">
        <div className="space-y-1">
          <label htmlFor="tanggal_setor" className="text-xs font-medium">Tanggal setor</label>
          <Input
            id="tanggal_setor" type="date" value={tanggal}
            min={`${hariIni.slice(0, 7)}-01`} max={hariIni}
            onChange={e => setTanggal(e.target.value)}
            className="h-9 w-44"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Setoran pertama bulan ini tercatat sebagai <strong>awal</strong>; berikutnya memperbarui posisi <strong>sedang</strong>.
        </p>
      </div>

      <ul className="space-y-2">
        {participants.map(p => {
          const v = isian[p.id]
          const kini = bulanIni[p.id]
          const lalu = sebelumnya[p.id]
          const daftarTahap = tahapan[v.metode_id] ?? []
          const tahap = daftarTahap.find(t => t.id === v.jilid_id) ?? null
          const berbuku = Boolean(tahap && !tahap.is_quran && !tahap.is_terminal && tahap.total_pages)
          const sudahSiklusIni = Boolean(kini?.setoran_terakhir && kini.setoran_terakhir >= siklusIni.senin)

          const kunciSurat = suratTahsinTersedia(
            { surat: lalu?.tahsin_surat ?? null, ayat: lalu?.tahsin_ayat ?? null },
            panjangSurat,
          )

          const ringkasTahsin = (r?: GukarMonthly, awal = false) => r && ringkasPosisiTahsin(
            semuaTahap.find(t => t.id === (awal ? r.awal_jilid_id : r.jilid_id)),
            awal
              ? { jilidId: r.awal_jilid_id, halaman: r.awal_halaman, surat: r.awal_tahsin_surat, ayat: r.awal_tahsin_ayat }
              : { jilidId: r.jilid_id, halaman: r.halaman, surat: r.tahsin_surat, ayat: r.tahsin_ayat },
            namaSurat,
          )

          return (
            <li
              key={p.id}
              className={cn(
                'rounded-2xl border bg-card p-3 transition-colors',
                v.dipilih && 'border-primary/60',
                v.galat && 'border-destructive',
              )}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={v.dipilih}
                  onChange={e => ubah(p.id, { dipilih: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {p.full_name}
                    {sudahSiklusIni && (
                      <span className="rounded-full bg-success-wash px-1.5 py-px text-[10px] font-semibold text-success">
                        ✓ setor {labelHariSetor(kini!.setoran_terakhir!)}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {kini?.awal_tanggal
                      ? <>Awal: {ringkasTahsin(kini, true) || '—'} · Sedang: {ringkasTahsin(kini) || '—'} · {kini.jumlah_setoran}× setor</>
                      : <>Belum setor bulan ini{lalu ? ` · akhir bulan lalu: ${ringkasTahsin(lalu) || '—'}` : ''}</>}
                  </span>
                </span>
              </label>

              {v.dipilih && (
                <div className="mt-3 space-y-3 border-t pt-3 pl-7">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold">Tahsin</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {!p.metode_id && (
                        <select
                          aria-label="Metode"
                          value={v.metode_id}
                          onChange={e => ubah(p.id, { metode_id: e.target.value, jilid_id: '', halaman: '' })}
                          className={selectCls}
                        >
                          <option value="">— metode —</option>
                          {metode.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      )}
                      <select
                        aria-label="Jilid / tahap"
                        value={v.jilid_id}
                        disabled={!v.metode_id}
                        onChange={e => ubah(p.id, { jilid_id: e.target.value, halaman: '' })}
                        className={selectCls}
                      >
                        <option value="">{v.metode_id ? '— tahap —' : 'pilih metode dulu'}</option>
                        {daftarTahap.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.label}{t.total_pages ? ` (${t.total_pages} hlm)` : ''}
                          </option>
                        ))}
                      </select>
                      {berbuku && (
                        <Input
                          aria-label="Halaman" type="number" inputMode="numeric"
                          min={1} max={tahap?.total_pages ?? undefined}
                          value={v.halaman}
                          placeholder={`Hal. 1–${tahap?.total_pages}`}
                          onChange={e => ubah(p.id, { halaman: e.target.value })}
                          className="h-9"
                        />
                      )}
                      {tahap?.is_quran && (
                        <>
                          <select
                            aria-label="Surat tahsin"
                            value={v.tahsin_surat}
                            onChange={e => ubah(p.id, { tahsin_surat: e.target.value, tahsin_ayat: '' })}
                            className={selectCls}
                          >
                            <option value="">— surat —</option>
                            {surat
                              .filter(s => (kunciSurat.terkunci ? s.id === kunciSurat.suratWajib : s.id >= kunciSurat.mulaiDari))
                              .map(s => <option key={s.id} value={s.id}>{s.id}. {s.nama}</option>)}
                          </select>
                          <Input
                            aria-label="Ayat tahsin" inputMode="numeric"
                            value={v.tahsin_ayat}
                            placeholder={v.tahsin_surat ? `Ayat 1–${panjangSurat(Number(v.tahsin_surat))}` : 'Ayat'}
                            onChange={e => ubah(p.id, { tahsin_ayat: e.target.value })}
                            className="h-9"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold">
                      Tahfidz
                      {kini?.awal_tanggal && ringkasPosisiTahfidz(
                        { surat: kini.awal_tahfidz_surat, ayat: kini.awal_tahfidz_ayat }, namaSurat,
                      ) && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          — awal bulan: {ringkasPosisiTahfidz({ surat: kini.awal_tahfidz_surat, ayat: kini.awal_tahfidz_ayat }, namaSurat)}
                        </span>
                      )}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <select
                        aria-label="Surat tahfidz"
                        value={v.tahfidz_surat}
                        onChange={e => ubah(p.id, { tahfidz_surat: e.target.value, tahfidz_ayat: '' })}
                        className={selectCls}
                      >
                        <option value="">— surat —</option>
                        {surat.map(s => <option key={s.id} value={s.id}>{s.id}. {s.nama}</option>)}
                      </select>
                      <Input
                        aria-label="Ayat tahfidz" inputMode="numeric"
                        value={v.tahfidz_ayat}
                        placeholder={v.tahfidz_surat ? `Ayat 1–${panjangSurat(Number(v.tahfidz_surat))}` : 'Ayat'}
                        onChange={e => ubah(p.id, { tahfidz_ayat: e.target.value })}
                        className="h-9"
                      />
                      <p className="flex h-9 items-center text-xs text-muted-foreground tabular-nums">
                        {formatHafalanGukar({ surat: Number(v.tahfidz_surat) || null, ayat: Number(v.tahfidz_ayat) || null })}
                      </p>
                    </div>
                  </div>

                  {v.galat && <p role="alert" className="text-xs font-medium text-destructive">{v.galat}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Tombol simpan menempel di bawah layar — satu kelompok bisa belasan
          kartu, dan menggulung kembali ke atas hanya untuk menyimpan melelahkan. */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <Button type="button" size="lg" className="w-full" onClick={simpan} disabled={pending || jumlahDipilih === 0}>
          {pending ? 'Menyimpan…' : jumlahDipilih > 0 ? `Simpan ${jumlahDipilih} setoran` : 'Centang peserta yang setor'}
        </Button>
      </div>
    </div>
  )
}
