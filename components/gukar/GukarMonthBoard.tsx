'use client'

import { useState, useTransition, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { deleteGukarMonthlyAction, saveGukarMonthlyAction, toggleHadirAction } from '@/app/actions/gukar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { formatPeriod, shiftPeriod } from '@/lib/finance/period'
import {
  setoranTahsinBulanIni, setoranTahfidzBulanIni, suratTahsinTersedia,
  formatHafalanGukar, type TahapJilid,
} from '@/lib/rq/gukar-setoran'
import type { MetodeTahsin, SuratRingkas } from '@/lib/data/gukar'
import { predikatHafalan } from '@/lib/rq/quran'
import type { GukarMonthly, GukarParticipant } from '@/types'

interface Props {
  groupId: string
  period: string
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

const PEKAN = [1, 2, 3, 4, 5] as const

/**
 * Papan bulanan satu kelompok pembinaan.
 *
 * Lima kotak kehadiran bisa dicentang langsung dari baris tanpa membuka
 * formulir, karena itulah tindakan yang dilakukan pengampu tiap pekan.
 * Capaian tahsin/tahfidz — yang hanya diisi sekali di akhir bulan — baru
 * memerlukan formulir.
 */
export function GukarMonthBoard({
  groupId, period, participants, monthly, metode, tahapan, sebelumnya, surat,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<GukarParticipant | null>(null)

  function goPeriod(next: string) {
    router.push(`/guru/gukar/${groupId}?periode=${next}`)
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
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
        <p className="text-xs text-muted-foreground">Centang pekan saat pembinaan berlangsung</p>
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
        />
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 px-3 font-medium">Nama</th>
              {PEKAN.map(p => (
                <th key={p} className="py-2 px-1 text-center font-medium w-10">P{p}</th>
              ))}
              <th className="py-2 px-3 font-medium">Capaian Tahsin</th>
              <th className="py-2 px-3 font-medium">Capaian Tahfidz</th>
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
                onEdit={() => setEditing(participant)}
              />
            ))}
            {participants.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-muted-foreground">
                  Belum ada peserta di kelompok ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ParticipantRow({
  groupId, period, participant, record, onEdit,
}: {
  groupId: string
  period: string
  participant: GukarParticipant
  record?: GukarMonthly
  onEdit: () => void
}) {
  const [pending, startTransition] = useTransition()
  const confirm = useConfirm()

  function toggle(pekan: number, next: boolean) {
    startTransition(async () => {
      const result = await toggleHadirAction(groupId, participant.id, period, pekan, next)
      if (result?.error) toast.error(result.error)
    })
  }

  const hadir = (pekan: number) =>
    Boolean(record?.[`hadir_${pekan}` as 'hadir_1' | 'hadir_2' | 'hadir_3' | 'hadir_4' | 'hadir_5'])

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 px-3">
        <p className="font-medium">{participant.full_name}</p>
        <p className="text-xs text-muted-foreground">
          {[participant.kind, participant.unit, participant.level_awal].filter(Boolean).join(' · ') || '—'}
        </p>
      </td>
      {PEKAN.map(pekan => (
        <td key={pekan} className="py-2 px-1 text-center">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={hadir(pekan)}
            disabled={pending}
            onChange={e => toggle(pekan, e.target.checked)}
            aria-label={`Hadir pekan ${pekan} — ${participant.full_name}`}
          />
        </td>
      ))}
      <td className="py-2 px-3">
        <p>{record?.tahap_tahsin || record?.capaian_tahsin || '—'}</p>
        {record?.tahap_tahsin && record.capaian_tahsin && (
          <p className="text-xs text-muted-foreground">{record.capaian_tahsin}</p>
        )}
      </td>
      <td className="py-2 px-3">
        <p>{ringkasTahfidz(record) || '—'}</p>
        {record?.capaian_tahfidz && (
          <p className="text-xs text-muted-foreground">{record.capaian_tahfidz}</p>
        )}
      </td>
      <td className="py-2 px-2 text-right whitespace-nowrap">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} aria-label="Isi capaian">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {record && (
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

/** Ringkasan angka hafalan untuk kolom tabel — kosong bila belum diukur. */
function ringkasTahfidz(record?: GukarMonthly): string {
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
  groupId, period, participant, record, onDone, metode, tahapan, sebelumnya, surat,
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

      <fieldset className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <legend className="px-1 text-sm font-semibold">Tahsin</legend>

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

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Kehadiran</legend>
        <div className="flex gap-3">
          {PEKAN.map(pekan => (
            <label key={pekan} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox" name={`hadir_${pekan}`}
                defaultChecked={Boolean(record?.[`hadir_${pekan}` as 'hadir_1'])}
                className="h-4 w-4"
              />
              P{pekan}
            </label>
          ))}
        </div>
      </fieldset>

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
