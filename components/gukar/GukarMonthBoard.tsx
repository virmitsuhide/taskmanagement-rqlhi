'use client'

import { useState, useTransition, useActionState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, ListChecks, Lock, LockOpen, Pencil, Trash2, X } from 'lucide-react'
import {
  deleteGukarMonthlyAction, kunciSetoranBulanAction, saveGukarMonthlyAction, simpanKehadiranBulanAction,
} from '@/app/actions/gukar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { formatPeriod, shiftPeriod } from '@/lib/finance/period'
import {
  setoranTahsinBulanIni, setoranTahfidzBulanIni, suratTahsinTersedia,
  formatHafalanGukar, ringkasPosisiTahfidz, ringkasPosisiTahsin, type TahapJilid,
} from '@/lib/rq/gukar-setoran'
import {
  labelHariSetor, labelSiklus, siklusDalamBulan, type StatusSetoranBulan,
} from '@/lib/rq/gukar-siklus'
import type { MetodeTahsin, SuratRingkas } from '@/lib/data/gukar'
import { predikatHafalan } from '@/lib/rq/quran'
import type { GukarMonthly, GukarParticipant } from '@/types'

interface Props {
  groupId: string
  period: string
  /** 'YYYY-MM-DD' WIB dari server. */
  hariIni: string
  /** Status setoran bulan ini untuk seluruh kelompok. */
  status: StatusSetoranBulan
  participants: GukarParticipant[]
  /** Catatan bulan ini, dipetakan berdasarkan id peserta. */
  monthly: Record<string, GukarMonthly>
  /** Metode tahsin yang boleh dipilih — UMMI & Syajaroh. */
  metode: MetodeTahsin[]
  /** Tahapan tiap metode, dikunci id metode. */
  tahapan: Record<string, TahapJilid[]>
  /**
   * Catatan terakhir SEBELUM bulan ini, per peserta. Dipakai dua hal:
   * mengunci pilihan surat yang belum tamat, dan menghitung berapa halaman
   * yang ditempuh bulan ini.
   */
  sebelumnya: Record<string, GukarMonthly>
  surat: SuratRingkas[]
}

/**
 * Papan bulanan satu kelompok pembinaan.
 *
 * Setoran harian masuk lewat halaman Setor per Sesi; papan ini menampilkan
 * hasilnya per bulan — setoran awal dan sedang/akhir berdampingan supaya
 * kemajuan tiap peserta terbaca sekilas — serta tempat pengampu merekap
 * kehadiran di akhir bulan dan mengunci setoran akhir.
 */
export function GukarMonthBoard({
  groupId, period, hariIni, status, participants, monthly, metode, tahapan, sebelumnya, surat,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<GukarParticipant | null>(null)
  const [pendingKunci, startKunci] = useTransition()

  const bulanBerjalan = period === hariIni.slice(0, 7)
  const semuaTahap = Object.values(tahapan).flat()
  const namaSurat = (id: number) => surat.find(s => s.id === id)?.nama ?? `Surat ${id}`

  function goPeriod(next: string) {
    router.push(`/guru/gukar/${groupId}?periode=${next}`)
  }

  async function ubahKunci(kunci: boolean) {
    if (kunci) {
      const ok = await confirm({
        title: `Kunci setoran akhir ${formatPeriod(period)}?`,
        description: 'Posisi setoran terakhir tiap peserta menjadi setoran akhir bulan ini dan tidak bisa ditambah lagi. Kehadiran, nilai, dan catatan tetap bisa diisi.',
        confirmText: 'Kunci setoran',
      })
      if (!ok) return
    }
    startKunci(async () => {
      const result = await kunciSetoranBulanAction(groupId, period, kunci)
      if (result.error) toast.error(result.error)
      else toast.success(kunci ? 'Setoran akhir dikunci' : 'Kunci setoran dibuka')
    })
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
            onClick={() => goPeriod(shiftPeriod(period, -1))} aria-label="Bulan sebelumnya">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">{formatPeriod(period)}</span>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
            onClick={() => goPeriod(shiftPeriod(period, 1))} aria-label="Bulan berikutnya">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {status === 'berjalan' && bulanBerjalan && (
            <Button size="sm" asChild>
              <Link href={`/guru/gukar/${groupId}/sesi`}>
                <ListChecks className="mr-1 h-4 w-4" />Setor per sesi
              </Link>
            </Button>
          )}
          {status === 'berjalan' && period <= hariIni.slice(0, 7) && (
            <Button size="sm" variant="outline" disabled={pendingKunci} onClick={() => ubahKunci(true)}>
              <Lock className="mr-1 h-4 w-4" />Kunci setoran akhir
            </Button>
          )}
          {status === 'dikunci' && (
            <Button size="sm" variant="ghost" disabled={pendingKunci} onClick={() => ubahKunci(false)}>
              <LockOpen className="mr-1 h-4 w-4" />Buka kunci
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <CapaianForm
          key={editing.id}
          groupId={groupId}
          period={period}
          participant={editing}
          record={monthly[editing.id]}
          onDone={() => setEditing(null)}
          metode={metode}
          tahapan={tahapan}
          sebelumnya={sebelumnya[editing.id]}
          surat={surat}
          posisiBeku={status !== 'berjalan'}
        />
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 px-3 font-medium">Nama</th>
              <th className="py-2 px-3 font-medium">Tahsin — awal → {status === 'berjalan' ? 'sedang' : 'akhir'}</th>
              <th className="py-2 px-3 font-medium">Tahfidz — awal → {status === 'berjalan' ? 'sedang' : 'akhir'}</th>
              <th className="py-2 px-3 font-medium">Setor</th>
              <th className="py-2 px-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {participants.map(participant => (
              <ParticipantRow
                key={participant.id}
                groupId={groupId}
                period={period}
                participant={participant}
                record={monthly[participant.id]}
                bisaHapus={status === 'berjalan'}
                ringkasTahsin={(r, awal) => ringkasPosisiTahsin(
                  semuaTahap.find(t => t.id === (awal ? r.awal_jilid_id : r.jilid_id)),
                  awal
                    ? { jilidId: r.awal_jilid_id, halaman: r.awal_halaman, surat: r.awal_tahsin_surat, ayat: r.awal_tahsin_ayat }
                    : { jilidId: r.jilid_id, halaman: r.halaman, surat: r.tahsin_surat, ayat: r.tahsin_ayat },
                  namaSurat,
                )}
                ringkasTahfidz={(r, awal) => ringkasPosisiTahfidz(
                  awal
                    ? { surat: r.awal_tahfidz_surat, ayat: r.awal_tahfidz_ayat }
                    : { surat: r.tahfidz_surat, ayat: r.tahfidz_ayat },
                  namaSurat,
                )}
                onEdit={() => setEditing(participant)}
              />
            ))}
            {participants.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  Belum ada peserta di kelompok ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {participants.length > 0 && period <= hariIni.slice(0, 7) && (
        <RekapKehadiran
          key={period}
          groupId={groupId}
          period={period}
          participants={participants}
          monthly={monthly}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: StatusSetoranBulan }) {
  const [label, cls] = status === 'berjalan'
    ? ['Setoran berjalan', 'bg-primary-wash text-primary']
    : status === 'dikunci'
      ? ['Setoran akhir dikunci', 'bg-warning-wash text-warning']
      : ['Bulan selesai · terkunci', 'bg-muted text-muted-foreground']
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

/**
 * Rekap kehadiran akhir bulan — dipindahkan pengampu dari catatan manualnya.
 *
 * Satu penyebut untuk seluruh kelompok (siklus Senin–Jumat yang terlaksana),
 * satu angka hadir per peserta, satu kali simpan. Kotak yang dikosongkan
 * berarti belum direkap, dan tidak ikut dihitung di rekap SDM.
 */
function RekapKehadiran({
  groupId, period, participants, monthly,
}: {
  groupId: string
  period: string
  participants: GukarParticipant[]
  monthly: Record<string, GukarMonthly>
}) {
  const [pending, startTransition] = useTransition()
  const siklusKalender = siklusDalamBulan(period)
  const tersimpan = Object.values(monthly).find(r => r.jumlah_siklus)?.jumlah_siklus ?? null

  const [siklus, setSiklus] = useState(
    String(tersimpan ?? (siklusKalender.length || '')),
  )
  const [hadir, setHadir] = useState<Record<string, string>>(() => Object.fromEntries(
    participants.map(p => [p.id, monthly[p.id]?.jumlah_hadir === null || monthly[p.id]?.jumlah_hadir === undefined
      ? '' : String(monthly[p.id].jumlah_hadir)]),
  ))

  const nSiklus = Number(siklus)

  function simpan() {
    if (!Number.isInteger(nSiklus) || nSiklus < 1 || nSiklus > 6) {
      toast.error('Isi jumlah siklus 1–6.')
      return
    }
    startTransition(async () => {
      const result = await simpanKehadiranBulanAction(
        groupId, period, nSiklus,
        participants.map(p => ({
          participant_id: p.id,
          hadir: hadir[p.id].trim() === '' ? null : Number(hadir[p.id]),
        })),
      )
      if (result.error) toast.error(result.error)
      else toast.success('Kehadiran tersimpan')
    })
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium">Rekap Kehadiran {formatPeriod(period)}</h2>
          <p className="text-xs text-muted-foreground">
            Diisi di akhir bulan dari catatan kehadiran pengampu. Kosongkan bila belum direkap.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="jumlah_siklus" className="text-xs">Siklus Senin–Jumat terlaksana</Label>
          <Input
            id="jumlah_siklus" type="number" inputMode="numeric" min={1} max={6}
            value={siklus} onChange={e => setSiklus(e.target.value)}
            className="h-9 w-24"
          />
        </div>
      </div>
      {siklusKalender.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Siklus bulan ini menurut kalender: {siklusKalender.map(labelSiklus).join(' · ')}
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {participants.map(p => {
          const n = Number(hadir[p.id])
          const persen = hadir[p.id].trim() !== '' && nSiklus > 0 ? Math.round((n / nSiklus) * 100) : null
          return (
            <li key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm">{p.full_name}</span>
              <Input
                aria-label={`Hadir — ${p.full_name}`}
                type="number" inputMode="numeric" min={0} max={nSiklus || 6}
                value={hadir[p.id]}
                onChange={e => setHadir(prev => ({ ...prev, [p.id]: e.target.value }))}
                className="h-8 w-16 text-center"
              />
              <span className="w-20 text-xs text-muted-foreground tabular-nums">
                / {nSiklus || '—'}{persen !== null ? ` · ${persen}%` : ''}
              </span>
            </li>
          )
        })}
      </ul>

      <Button size="sm" onClick={simpan} disabled={pending}>
        {pending ? 'Menyimpan…' : 'Simpan kehadiran'}
      </Button>
    </section>
  )
}

function ParticipantRow({
  groupId, period, participant, record, bisaHapus, ringkasTahsin, ringkasTahfidz, onEdit,
}: {
  groupId: string
  period: string
  participant: GukarParticipant
  record?: GukarMonthly
  bisaHapus: boolean
  ringkasTahsin: (r: GukarMonthly, awal: boolean) => string
  ringkasTahfidz: (r: GukarMonthly, awal: boolean) => string
  onEdit: () => void
}) {
  const [pending, startTransition] = useTransition()
  const confirm = useConfirm()
  const sudahSetor = Boolean(record?.awal_tanggal)

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="py-2 px-3">
        <p className="font-medium">{participant.full_name}</p>
        <p className="text-xs text-muted-foreground">
          {[participant.kind, participant.unit, participant.level_awal].filter(Boolean).join(' · ') || '—'}
        </p>
      </td>
      <td className="py-2 px-3">
        {sudahSetor ? (
          <AwalSedang awal={ringkasTahsin(record!, true)} sedang={ringkasTahsin(record!, false)} />
        ) : (
          // Catatan sebelum 0069 tidak punya setoran awal — tampilkan apa adanya.
          <p>{record?.tahap_tahsin || record?.capaian_tahsin || '—'}</p>
        )}
        {record?.setoran_tahsin_halaman ? (
          <p className="text-xs text-success">+{record.setoran_tahsin_halaman} halaman</p>
        ) : null}
      </td>
      <td className="py-2 px-3">
        {sudahSetor ? (
          <AwalSedang awal={ringkasTahfidz(record!, true)} sedang={ringkasTahfidz(record!, false)} />
        ) : (
          <p>{ringkasTahfidzLama(record) || '—'}</p>
        )}
        {record?.setoran_tahfidz_halaman ? (
          <p className="text-xs text-success">+{record.setoran_tahfidz_halaman} halaman</p>
        ) : null}
      </td>
      <td className="py-2 px-3 whitespace-nowrap text-xs text-muted-foreground">
        {sudahSetor ? (
          <>
            <p className="text-sm text-foreground">{record!.jumlah_setoran}×</p>
            <p>terakhir {labelHariSetor(record!.setoran_terakhir!)}</p>
          </>
        ) : '—'}
        {record?.jumlah_hadir !== null && record?.jumlah_hadir !== undefined && (
          <p>hadir {record.jumlah_hadir}/{record.jumlah_siklus}</p>
        )}
      </td>
      <td className="py-2 px-2 text-right whitespace-nowrap">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} aria-label="Isi capaian">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {record && bisaHapus && (
          <Button
            size="sm" variant="ghost" disabled={pending}
            className="h-7 w-7 p-0 text-destructive"
            aria-label={`Hapus catatan ${participant.full_name}`}
            onClick={async () => {
              const ok = await confirm({
                title: `Hapus catatan ${participant.full_name} untuk bulan ini?`,
                description: 'Kehadiran dan capaian bulan ini dikosongkan kembali.',
                confirmText: 'Hapus catatan',
              })
              if (!ok) return
              startTransition(async () => {
                const result = await deleteGukarMonthlyAction(groupId, participant.id, period)
                if (result?.error) toast.error(result.error)
                else toast.success('Catatan dihapus')
              })
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </td>
    </tr>
  )
}

/** Dua posisi berdampingan; satu saja bila bulan ini baru sekali setor. */
function AwalSedang({ awal, sedang }: { awal: string; sedang: string }) {
  if (!awal && !sedang) return <p>—</p>
  if (awal === sedang) return <p>{sedang}</p>
  return (
    <>
      <p className="text-xs text-muted-foreground">{awal || '—'} →</p>
      <p>{sedang || '—'}</p>
    </>
  )
}

/** Ringkasan angka hafalan catatan lama (pra-0069) — kosong bila belum diukur. */
function ringkasTahfidzLama(record?: GukarMonthly): string {
  if (!record || record.juz_tuntas === null || record.juz_tuntas === undefined) return ''
  const predikat = predikatHafalan(record.nilai_tahfidz)
  return [
    `${record.juz_tuntas} juz`,
    record.juz_berjalan ? `sedang juz ${record.juz_berjalan}` : '',
    predikat ? `${predikat} (${record.nilai_tahfidz})` : '',
  ].filter(Boolean).join(' · ')
}
/**
 * Formulir capaian satu peserta untuk satu bulan.
 *
 * YANG DICATAT ADALAH POSISI, YANG DILAPORKAN ADALAH JARAK
 *
 * Pembina mengisi di mana peserta berada akhir bulan ini — jilid & halaman,
 * atau surat & ayat. Berapa halaman yang ditempuh bulan itu TIDAK diketik:
 * ia selisih terhadap posisi bulan lalu, dihitung sendiri oleh sistem. Angka
 * yang diketik manusia dua kali (posisinya, lalu jaraknya) pasti suatu saat
 * tidak cocok satu sama lain, dan tidak akan ketahuan yang mana yang keliru.
 */
function CapaianForm({
  groupId, period, participant, record, onDone, metode, tahapan, sebelumnya, surat, posisiBeku,
}: {
  groupId: string
  period: string
  participant: GukarParticipant
  record?: GukarMonthly
  onDone: () => void
  metode: MetodeTahsin[]
  tahapan: Record<string, TahapJilid[]>
  sebelumnya?: GukarMonthly
  surat: SuratRingkas[]
  /**
   * Setoran bulan ini sudah terkunci: posisi adalah setoran akhir dan tidak
   * dikirim lagi. Nilai & catatan tetap bisa disimpan.
   */
  posisiBeku: boolean
}) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveGukarMonthlyAction(prev, formData)
      if (result.success) {
        toast.success(`Catatan ${participant.full_name} tersimpan`)
        onDone()
      }
      return result
    },
    null,
  )

  // Metode terkunci begitu pernah dipilih — lihat gukar_participants.metode_id.
  const terkunciMetode = Boolean(participant.metode_id)
  const [metodeId, setMetodeId] = useState(participant.metode_id ?? '')
  const daftarTahap = tahapan[metodeId] ?? []

  const [jilidId, setJilidId] = useState(record?.jilid_id ?? '')
  const tahap = daftarTahap.find(t => t.id === jilidId) ?? null
  const berbuku = Boolean(tahap && !tahap.is_quran && !tahap.is_terminal && tahap.total_pages)

  const panjangSurat = (s: number) => surat.find(x => x.id === s)?.ayat ?? null
  const kunciSurat = suratTahsinTersedia(
    { surat: sebelumnya?.tahsin_surat ?? null, ayat: sebelumnya?.tahsin_ayat ?? null },
    panjangSurat,
  )

  const [halaman, setHalaman] = useState(String(record?.halaman ?? ''))
  const [tahsinSurat, setTahsinSurat] = useState(
    String(record?.tahsin_surat ?? kunciSurat.suratWajib ?? ''),
  )
  const [tahsinAyat, setTahsinAyat] = useState(String(record?.tahsin_ayat ?? ''))
  const [tfSurat, setTfSurat] = useState(String(record?.tahfidz_surat ?? ''))
  const [tfAyat, setTfAyat] = useState(String(record?.tahfidz_ayat ?? ''))

  /*
    Pratinjau jarak — dihitung ulang di server saat menyimpan.

    Sengaja dihitung dua kali. Yang di sini supaya pembina melihat angkanya
    bergerak sambil mengisi dan bisa menangkap salah pilih sebelum tersimpan;
    yang di server karena itulah satu-satunya yang mengikat. Keduanya memanggil
    fungsi yang sama persis, jadi tidak mungkin berbeda rumus.
  */
  const posisiKini = {
    jilidId: jilidId || null,
    halaman: Number(halaman) || null,
    surat: Number(tahsinSurat) || null,
    ayat: Number(tahsinAyat) || null,
  }
  const posisiLalu = sebelumnya
    ? {
        jilidId: sebelumnya.jilid_id,
        halaman: sebelumnya.halaman,
        surat: sebelumnya.tahsin_surat,
        ayat: sebelumnya.tahsin_ayat,
      }
    : null
  const setoranTahsin = setoranTahsinBulanIni(daftarTahap, posisiKini, posisiLalu)

  const posisiTf = { surat: Number(tfSurat) || null, ayat: Number(tfAyat) || null }
  const setoranTahfidz = setoranTahfidzBulanIni(
    posisiTf,
    sebelumnya ? { surat: sebelumnya.tahfidz_surat, ayat: sebelumnya.tahfidz_ayat } : null,
  )
  const totalHafalan = formatHafalanGukar(posisiTf)

  const maksAyat = (s: string) => panjangSurat(Number(s)) ?? 300

  return (
    <form action={action} className="space-y-4 rounded-lg border p-4">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="participant_id" value={participant.id} />
      <input type="hidden" name="period" value={period} />

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{participant.full_name}</p>
          <p className="text-xs text-muted-foreground">{formatPeriod(period)}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDone}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        {posisiBeku
          ? 'Setoran bulan ini sudah terkunci — posisi di bawah adalah setoran akhir. Nilai & catatan masih bisa disimpan.'
          : record?.awal_tanggal
            ? `Setoran awal ${labelHariSetor(record.awal_tanggal)}. Posisi yang disimpan di sini meralat setoran sedang (terakhir ${labelHariSetor(record.setoran_terakhir ?? record.awal_tanggal)}).`
            : 'Belum ada setoran bulan ini. Posisi yang disimpan di sini sekaligus menjadi setoran awal.'}
      </p>

      <fieldset className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <legend className="px-1 text-sm font-semibold">Tahsin</legend>

        {/* fieldset disabled tidak mengirim isinya — server pun mengabaikan
            posisi pada bulan yang terkunci, jadi keduanya sejalan. */}
        <fieldset disabled={posisiBeku} className="contents">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="metode_id">Metode</Label>
            <select
              id="metode_id"
              name={terkunciMetode ? undefined : 'metode_id'}
              value={metodeId}
              disabled={terkunciMetode}
              onChange={e => { setMetodeId(e.target.value); setJilidId(''); setHalaman('') }}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm disabled:opacity-70"
            >
              <option value="">— pilih metode —</option>
              {metode.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {/* Select yang disabled tidak ikut terkirim. Nilainya dititipkan
                lewat hidden input supaya server tetap menerimanya — dan server
                pun menolak nilai yang berbeda dari yang sudah terkunci. */}
            {terkunciMetode && <input type="hidden" name="metode_id" value={metodeId} />}
            {terkunciMetode && (
              <p className="text-[11px] text-muted-foreground">
                Terkunci — metode ditetapkan sekali di awal pembinaan.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="jilid_id">Jilid / tahap</Label>
            <select
              id="jilid_id" name="jilid_id"
              value={jilidId}
              disabled={!metodeId}
              onChange={e => { setJilidId(e.target.value); setHalaman('') }}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm disabled:opacity-50"
            >
              <option value="">{metodeId ? '— pilih tahap —' : 'pilih metode dulu'}</option>
              {daftarTahap.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label}{t.total_pages ? ` (${t.total_pages} hlm)` : ''}
                </option>
              ))}
            </select>
          </div>

          {berbuku ? (
            <div className="space-y-1.5">
              <Label htmlFor="halaman">Halaman</Label>
              <select
                id="halaman" name="halaman"
                value={halaman}
                onChange={e => setHalaman(e.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">—</option>
                {Array.from({ length: tahap?.total_pages ?? 0 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Halaman</Label>
              <p className="flex h-9 items-center text-xs text-muted-foreground">
                {tahap ? 'Tahap ini tidak berhalaman buku' : '—'}
              </p>
            </div>
          )}
        </div>

        {/* Tahap Al-Qur'an: yang dicatat surat & ayat, bukan halaman buku. */}
        {tahap?.is_quran && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tahsin_surat">Surat</Label>
              <select
                id="tahsin_surat" name="tahsin_surat"
                value={tahsinSurat}
                onChange={e => { setTahsinSurat(e.target.value); setTahsinAyat('') }}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">— pilih surat —</option>
                {surat
                  .filter(s => (kunciSurat.terkunci
                    ? s.id === kunciSurat.suratWajib
                    : s.id >= kunciSurat.mulaiDari))
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.id}. {s.nama} ({s.ayat} ayat)
                    </option>
                  ))}
              </select>
              {kunciSurat.terkunci && (
                <p className="text-[11px] text-warning">
                  Terkunci sampai suratnya tamat — terakhir ayat {sebelumnya?.tahsin_ayat} dari{' '}
                  {panjangSurat(kunciSurat.suratWajib ?? 0)}.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tahsin_ayat">Ayat terakhir dibaca</Label>
              <Input
                id="tahsin_ayat" name="tahsin_ayat" inputMode="numeric"
                value={tahsinAyat}
                onChange={e => setTahsinAyat(e.target.value)}
                placeholder={tahsinSurat ? `1–${maksAyat(tahsinSurat)}` : '—'}
              />
            </div>
          </div>
        )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="capaian_tahsin">Catatan tahsin</Label>
          <Input
            id="capaian_tahsin" name="capaian_tahsin"
            defaultValue={record?.capaian_tahsin ?? ''}
          />
          <p className="text-[11px] text-muted-foreground">
            Apa yang perlu dikuatkan — bukan posisi bacaannya, itu sudah terekam di atas.
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <legend className="px-1 text-sm font-semibold">Tahfidz</legend>

        <fieldset disabled={posisiBeku} className="contents">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="tahfidz_surat">Surat terakhir disetor</Label>
            <select
              id="tahfidz_surat" name="tahfidz_surat"
              value={tfSurat}
              onChange={e => { setTfSurat(e.target.value); setTfAyat('') }}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">— belum ada —</option>
              {surat.map(s => (
                <option key={s.id} value={s.id}>
                  {s.id}. {s.nama} ({s.ayat} ayat)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tahfidz_ayat">Ayat terakhir</Label>
            <Input
              id="tahfidz_ayat" name="tahfidz_ayat" inputMode="numeric"
              value={tfAyat}
              onChange={e => setTfAyat(e.target.value)}
              placeholder={tfSurat ? `1–${maksAyat(tfSurat)}` : '—'}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Total hafalan</Label>
            {/* Diturunkan dari posisi di kiri memakai urutan hafalan RQ
                (30, 29, 28, …) — rumus yang sama dengan hafalan santri.
                Menamatkan juz 30 berarti 1 juz. */}
            <p className="flex h-9 items-center text-sm font-semibold tabular-nums">
              {totalHafalan}
            </p>
          </div>
        </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="nilai_tahfidz">Nilai hafalan</Label>
            <Input
              id="nilai_tahfidz" name="nilai_tahfidz" inputMode="numeric"
              defaultValue={record?.nilai_tahfidz ?? ''} placeholder="0–100"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="surat_pilihan">Surat pilihan</Label>
            <Input
              id="surat_pilihan" name="surat_pilihan" inputMode="numeric"
              defaultValue={record?.surat_pilihan || ''} placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capaian_tahfidz">Catatan tahfidz</Label>
            <Input
              id="capaian_tahfidz" name="capaian_tahfidz"
              defaultValue={record?.capaian_tahfidz ?? ''}
            />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Terhitung
          label="Setoran tahsin bulan ini"
          nilai={setoranTahsin}
          adaPembanding={Boolean(posisiLalu)}
        />
        <Terhitung
          label="Setoran tahfidz bulan ini"
          nilai={setoranTahfidz}
          adaPembanding={Boolean(sebelumnya)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="catatan">Catatan</Label>
        <Textarea id="catatan" name="catatan" rows={2} defaultValue={record?.catatan ?? ''} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Batal</Button>
      </div>
    </form>
  )
}

/**
 * Angka yang dihitung sistem — ditampilkan, tidak bisa diketik.
 *
 * Sengaja tidak dibuat sebagai isian yang "boleh ditimpa". Begitu sebuah
 * angka turunan bisa disunting, ia berhenti menjadi turunan: dua bulan
 * kemudian tidak ada yang tahu apakah 12 halaman itu hasil hitungan atau
 * ketikan seseorang.
 */
function Terhitung({
  label, nilai, adaPembanding,
}: {
  label: string
  nilai: number
  adaPembanding: boolean
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold leading-none tabular-nums">
        {nilai} <span className="text-sm font-normal text-muted-foreground">halaman</span>
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {adaPembanding
          ? 'selisih dari catatan bulan sebelumnya'
          : 'belum ada catatan sebelumnya — dihitung dari nol'}
      </p>
    </div>
  )
}
