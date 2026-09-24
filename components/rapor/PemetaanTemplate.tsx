'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Database, Eye, ImageUp, Stamp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PilihBerkas, SELECT_NATIF } from '@/components/rapor/kontrol'
import { LembarRapor } from '@/components/rapor/LembarRapor'
import { hapusTtdKoordinatorAction, simpanPemetaanAction, unggahTtdKoordinatorAction } from '@/app/actions/rapor-template'
import { awalIsianBawaan, cariSlot, MEDAN, MEDAN_PER_KODE, pemetaanAwal, type AwalIsian, type KodeMedan } from '@/lib/rapor/medan'
import type { Blok } from '@/lib/rapor/docx'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  blok: Blok[]
  pemetaan: Record<string, KodeMedan>
  /** Isi awal tiap isian merah (0086); kosong = aturan bawaan. */
  awalIsian: Record<string, AwalIsian>
  pengesahan: { tempat_terbit: string; nama_koordinator: string; nip_koordinator: string }
  /** Url bertanda tangan gambar ttd koordinator; null = belum diunggah. */
  ttdKoordinator: string | null
  /** Url kop surat (path → url) untuk pratinjau. */
  latar?: Record<string, string | null>
}

const GRUP = [...new Set(MEDAN.map(m => m.grup))]

/**
 * Layar pemetaan — menghubungkan tiap tempat isian di template dengan sumber
 * datanya.
 *
 * Baris yang sudah ditebak sistem tampil lebih dulu; sisanya (teks biasa yang
 * boleh saja berisi data, mis. nama koordinator di blok tanda tangan)
 * disembunyikan di balik satu tombol supaya daftar ini tetap terbaca.
 * Pratinjau di sebelahnya menandai kuning setiap bagian yang akan diganti
 * data, jadi salah petakan kelihatan sebelum satu rapor pun dicetak.
 */
/** Medan data yang masuk akal sebagai isi awal isian merah. */
const AWAL_DATA: KodeMedan[] = ['capaian_tahfidz', 'juz_tuntas', 'juz_berjalan', 'total_hafalan', 'level_tahsin', 'jilid']

export function PemetaanTemplate({ id, blok, pemetaan, awalIsian, pengesahan, ttdKoordinator, latar }: Props) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  // Slot yang belum pernah dipetakan (isian merah pada template lama yang
  // baru dibaca ulang) diberi tebakannya — sama dengan yang dipakai lembar
  // cetak, supaya layar ini tidak menampilkan "biarkan" untuk slot yang
  // kenyataannya sudah terisi.
  const [peta, setPeta] = useState<Record<string, KodeMedan>>(() => ({ ...pemetaanAwal(cariSlot(blok)), ...pemetaan }))
  const [awal, setAwal] = useState<Record<string, AwalIsian>>(awalIsian)
  const [sah, setSah] = useState(pengesahan)
  const [lihatSemua, setLihatSemua] = useState(false)

  const slot = useMemo(() => cariSlot(blok), [blok])
  // Yang tampil sendiri: slot yang punya tebakan — dipakai langsung (pasti)
  // maupun sekadar disarankan (blok tanda tangan). Sisanya teks biasa.
  const terdeteksi = slot.filter(s => s.tebakan !== null)
  const lainnya = slot.filter(s => s.tebakan === null)
  const tampil = lihatSemua ? slot : terdeteksi

  const dipakai = new Set<KodeMedan>(Object.values(peta).filter(k => k !== 'tetap' && k !== 'kosongkan'))
  // Tulisan guru cukup punya SATU tempat: kotak deskripsi bebas, atau
  // isian merah. Template ATS SMP sengaja tidak punya kotak bebas.
  const belumDipetakan = dipakai.has('deskripsi') || dipakai.has('isian_guru')
    ? []
    : MEDAN.filter(m => m.kode === 'deskripsi')

  function kirimTtd(file: File) {
    mulai(async () => {
      const data = new FormData()
      data.set('ttd', file)
      const hasil = await unggahTtdKoordinatorAction(id, data)
      if (hasil.error) toast.error(hasil.error)
      else {
        toast.success('Tanda tangan koordinator tersimpan.')
        router.refresh()
      }
    })
  }

  function lepasTtd() {
    mulai(async () => {
      const hasil = await hapusTtdKoordinatorAction(id)
      if (hasil.error) toast.error(hasil.error)
      else router.refresh()
    })
  }

  function simpan() {
    mulai(async () => {
      const hasil = await simpanPemetaanAction(id, peta, sah, awal)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success('Pemetaan tersimpan.')
      router.refresh()
    })
  }

  return (
    // grid-cols-1 wajib: tanpa kolom eksplisit, kolom implisit selebar isinya,
    // dan pratinjau rapor yang lebar mendorong seluruh kartu keluar layar HP.
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-xl border bg-card">
          <KepalaKartu ikon={<Stamp className="size-4" aria-hidden />} judul="Pengesahan">
            Sama untuk seluruh rapor unit ini — tidak perlu diketik ulang tiap anak.
          </KepalaKartu>
          <div className="space-y-3 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="sah-tempat">Tempat terbit</Label>
              <Input id="sah-tempat" value={sah.tempat_terbit} disabled={pending} placeholder="Banguntapan" className="h-10 md:h-9"
                onChange={e => setSah({ ...sah, tempat_terbit: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sah-nama">Nama koordinator</Label>
              <Input id="sah-nama" value={sah.nama_koordinator} disabled={pending} placeholder="Erna, S.Pd" className="h-10 md:h-9"
                onChange={e => setSah({ ...sah, nama_koordinator: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sah-nip">NIY koordinator</Label>
              <Input id="sah-nip" value={sah.nip_koordinator} disabled={pending} placeholder="NIY.20001011.308" className="h-10 tabular-nums md:h-9"
                onChange={e => setSah({ ...sah, nip_koordinator: e.target.value })} />
            </div>

            {/* Gambar ttd koordinator dipakai semua rapor unit ini. Ttd pengampu
                tidak diunggah di sini — ia diambil dari profil tiap guru. */}
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">Tanda tangan koordinator</p>
              {ttdKoordinator ? (
                <div className="flex items-center gap-3 rounded-lg border p-2">
                  {/* Latar putih tetap: gambar ttd biasanya tinta gelap di atas
                      transparan, yang hilang di atas kartu mode gelap. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ttdKoordinator} alt="Tanda tangan koordinator" className="h-14 max-w-[160px] rounded-md bg-white object-contain p-1" />
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={lepasTtd} className="ml-auto">Lepas</Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Belum ada. Tanpa gambar, ruang tanda tangan tetap tersedia di lembar rapor untuk ditandatangani basah.
                </p>
              )}
              <PilihBerkas
                accept="image/png,image/webp,image/jpeg"
                disabled={pending}
                onPilih={(f, input) => { if (f) kirimTtd(f); input.value = '' }}
                ikon={<ImageUp className="size-4" aria-hidden />}
                judul={ttdKoordinator ? 'Ganti gambar tanda tangan' : 'Unggah gambar tanda tangan'}
                keterangan="PNG berlatar transparan paling rapi"
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <KepalaKartu ikon={<Database className="size-4" aria-hidden />} judul="Isi dari data">
            {terdeteksi.length} baris terdeteksi{lainnya.length > 0 && `, ${lainnya.length} baris lain`}.
          </KepalaKartu>
          <div className="space-y-3 p-4">
            {lainnya.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setLihatSemua(v => !v)} className="w-full">
                {lihatSemua ? 'Yang terdeteksi saja' : 'Tampilkan semua baris'}
              </Button>
            )}

            {belumDipetakan.length > 0 && (
              <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning-wash p-2.5 text-xs text-foreground">
                <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
                <span>
                  Belum ada tempat untuk <b>{belumDipetakan.map(m => m.label).join(', ')}</b>. Tanpa itu, tulisan guru
                  tidak punya tempat di lembar ini.
                </span>
              </p>
            )}

            <ul className="space-y-2">
              {tampil.map(s => {
                const kode = peta[s.id] ?? 'tetap'
                const aktif = kode !== 'tetap' && kode !== 'kosongkan'
                return (
                  <li key={s.id} className={cn('rounded-lg border p-3', aktif && 'border-primary/40 bg-primary/5 dark:bg-primary/10')}>
                    {s.konteks ? (
                      // Isian merah: tampilkan kalimat yang mengapitnya, dengan
                      // potongan merahnya di tengah — itulah yang dikenali guru.
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        {s.konteks.sebelum}{' '}
                        <span className="rounded bg-destructive-wash px-1 font-medium text-destructive">{s.contoh}</span>{' '}
                        {s.konteks.sesudah}
                      </p>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium">{s.petunjuk}</p>
                          {s.eksplisit && <span className="shrink-0 text-[10px] uppercase text-muted-foreground">placeholder</span>}
                        </div>
                        {s.contoh && (
                          <p className="truncate text-[11px] text-muted-foreground">di template: &ldquo;{s.contoh.slice(0, 70)}&rdquo;</p>
                        )}
                      </>
                    )}
                    {/* Tebakan yang tidak pasti hanya ditawarkan — teks seperti
                        "Koordinator Al-Qur'an SDIT LHI" bisa jadi judul kolom
                        yang memang harus tetap tercetak. */}
                    {!s.pasti && s.tebakan && kode === 'tetap' && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setPeta({ ...peta, [s.id]: s.tebakan! })}
                        className="mt-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
                      >
                        saran: isi dengan {MEDAN_PER_KODE.get(s.tebakan)?.label}
                      </button>
                    )}
                    <select
                      value={kode}
                      disabled={pending}
                      onChange={e => setPeta({ ...peta, [s.id]: e.target.value as KodeMedan })}
                      aria-label={`Sumber isi untuk ${s.petunjuk}`}
                      className={cn(SELECT_NATIF, 'mt-2 bg-card')}
                    >
                      {GRUP.map(g => (
                        <optgroup key={g} label={g}>
                          {MEDAN.filter(m => m.grup === g).map(m => (
                            <option key={m.kode} value={m.kode}>{m.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {kode === 'isian_guru' && (
                      <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">Isi awal untuk guru:</span>
                        <select
                          value={awal[s.id] ?? awalIsianBawaan(s)}
                          disabled={pending}
                          onChange={e => setAwal({ ...awal, [s.id]: e.target.value as AwalIsian })}
                          className={cn(SELECT_NATIF, 'h-8 min-w-0 flex-1 bg-card text-xs md:h-8')}
                        >
                          <option value="contoh">Contoh template — &ldquo;{s.contoh.slice(0, 30)}{s.contoh.length > 30 ? '…' : ''}&rdquo;</option>
                          <option value="kosong">Kosong — guru menulis sendiri</option>
                          {AWAL_DATA.map(k => <option key={k} value={k}>Data: {MEDAN_PER_KODE.get(k)?.label}</option>)}
                        </select>
                      </label>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
          <Button type="button" size="lg" className="w-full" onClick={simpan} disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan pemetaan'}
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Eye className="size-4 shrink-0" aria-hidden />
          <span>Pratinjau — bagian yang ditandai akan diganti data tiap anak.</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {[...dipakai].map(k => MEDAN_PER_KODE.get(k)?.label).filter(Boolean).length} medan terpakai
          </span>
        </p>
        <div className="overflow-x-auto rounded-xl border bg-muted/40 p-2 sm:p-4">
          <LembarRapor blok={blok} pemetaan={peta} tandai ttd={{ koordinator: ttdKoordinator, pengampu: null }} latar={latar} muat />
        </div>
      </div>
    </div>
  )
}

function KepalaKartu({ ikon, judul, children }: { ikon: React.ReactNode; judul: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-start gap-3 border-b bg-muted/30 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
        {ikon}
      </span>
      <div className="min-w-0 pt-1">
        <h2 className="text-sm font-semibold leading-tight">{judul}</h2>
        {children && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</p>}
      </div>
    </header>
  )
}
