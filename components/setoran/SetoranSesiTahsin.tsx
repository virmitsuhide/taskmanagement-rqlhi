'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StarInput, harusMengulang } from '@/components/setoran/StarInput'
import { Stepper } from '@/components/setoran/Stepper'
import { cn } from '@/lib/utils'
import { createTahsinLogSesiAction, type InputSetoranTahsin } from '@/app/actions/setoran'
import { PerbandinganSetoranDialog } from '@/components/setoran/PerbandinganSetoranDialog'
import type { SetoranGanda } from '@/lib/data/setoran-ganda'
import {
  BacaanQuranInput, BACAAN_KOSONG, keBacaanQuran, type IsianBacaan,
} from '@/components/setoran/BacaanQuranInput'
import { PilihMateri, type PilihanMateri } from '@/components/setoran/PilihMateri'
import type { SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import type { SiswaSesiTahsin } from '@/lib/data/setoran-sesi'
import type { KelompokKlasikal } from '@/lib/data/kelompok-klasikal'
import { anggotaDariPengaturan, usulanKelompok } from '@/lib/rq/klasikal'

type Status = 'lulus' | 'ulang'

interface Isian {
  dipilih: boolean
  /** Halaman BUKU; kosong = posisi anak sekarang. Tidak dipakai di tahap tak berbuku. */
  halaman: string
  /** Bacaan mushaf — hanya terisi di tahap yang baca_quran. */
  quran: IsianBacaan
  /** Materi yang disetor sesi ini — hanya di tahap Gharib/Tajwid. */
  materi: PilihanMateri
  nilai_tahsin: number | null
  nilai_sikap: number | null
  status: Status
  catatan: string
  /** Dinaikkan setelah tersimpan supaya bintangnya ter-reset. */
  versi: number
  galat?: string
}

/**
 * Setoran KLASIKAL: sekelompok anak membaca bersama halaman/ayat yang sama.
 * Satu isian bacaan untuk semua, tapi tiap anggota tetap punya kehadiran,
 * Lulus/Ulang, serta nilai tahsin & adab sendiri — membaca bersama tidak
 * berarti bacaan dan adab tiap anak sama.
 */
interface IsianKelompok {
  dipilih: boolean
  halaman: string
  quran: IsianBacaan
  status: Status
  /** Nilai per anggota; tidak ada di peta = belum dinilai. */
  nilaiAnak: Record<string, { tahsin: number | null; sikap: number | null }>
  catatan: string
  versi: number
  /** Tidak ada di peta = hadir. */
  absen: Record<string, boolean>
  /** Pengecualian status per anggota; tidak ada = ikut status kelompok. */
  statusAnak: Record<string, Status>
}

/** Nama surat untuk baris keterangan; id yang tak dikenal tampil apa adanya. */
function namaSurat(surat: SuratPilihan[], id: number): string {
  return surat.find(x => x.id === id)?.name_latin ?? `Surat ${id}`
}

function bacaanDari(s: SiswaSesiTahsin): IsianBacaan {
  return s.baca_quran
    ? {
        halaman: s.quran.halaman ? String(s.quran.halaman) : '',
        surat_id: s.quran.surat_id ? String(s.quran.surat_id) : '',
        ayat_dari: s.quran.ayat ? String(s.quran.ayat) : '',
        ayat_ke: '',
      }
    : BACAAN_KOSONG
}

/**
 * Halaman buku dibiarkan kosong = pakai posisi anak saat ini, dan Stepper
 * menampilkannya sebagai angka awal. Bacaan mushaf DIISI DI MUKA dengan posisi
 * terakhir anak: halaman, surat, dan ayat sekaligus.
 */
function isianAwal(s: SiswaSesiTahsin, versi = 0): Isian {
  return {
    dipilih: false, halaman: '', quran: bacaanDari(s), materi: {},
    nilai_tahsin: null, nilai_sikap: null, status: 'lulus', catatan: '', versi,
  }
}

function kelompokAwal(anggota: SiswaSesiTahsin[], versi = 0): IsianKelompok {
  return {
    dipilih: false, halaman: '', quran: anggota[0] ? bacaanDari(anggota[0]) : BACAAN_KOSONG,
    status: 'lulus', nilaiAnak: {}, catatan: '', versi,
    absen: {}, statusAnak: {},
  }
}

/**
 * Cadangan bila tabel pengaturan (0080) belum ada: kelompok dari posisi yang
 * sama persis. Begitu migrasinya jalan, yang berlaku pengaturan pengampu.
 */
function kelompokOtomatis(siswa: SiswaSesiTahsin[]): Record<string, string | null> {
  const hasil: Record<string, string | null> = Object.fromEntries(siswa.map(s => [s.id, null]))
  usulanKelompok(siswa).forEach((ids, i) => { for (const id of ids) hasil[id] = `otomatis-${i}` })
  return hasil
}

/** Nilai yang paling sering — posisi dasar kelompok yang anggotanya sedikit bergeser. */
function modus(xs: number[]): number | null {
  const n = new Map<number, number>()
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1)
  let terbaik: number | null = null
  let jumlah = 0
  for (const [x, c] of n) if (c > jumlah) { terbaik = x; jumlah = c }
  return terbaik
}

/**
 * Setoran tahsin untuk seluruh anak satu sesi dalam satu layar — individual,
 * klasikal, atau campuran keduanya.
 *
 * Anak yang tidak dicentang tidak disimpan. Isian kelompok diurai menjadi satu
 * baris per anggota yang hadir sebelum dikirim, jadi aturan server (jilid,
 * halaman terakhir, drill, setoran ganda) tetap berlaku per anak.
 */
export function SetoranSesiTahsin({ siswa, surat, halaqohId, pengaturan }: {
  siswa: SiswaSesiTahsin[]
  surat: SuratPilihan[]
  halaqohId: string
  /** Kelompok yang diatur pengampu; null = tabel 0080 belum ada (pakai usulan otomatis). */
  pengaturan: KelompokKlasikal[] | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Anak yang hari itu sudah punya setoran: menunggu keputusan guru.
  const [ganda, setGanda] = useState<SetoranGanda[]>([])
  const [tertunda, setTertunda] = useState<InputSetoranTahsin[]>([])
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [isian, setIsian] = useState<Record<string, Isian>>(
    () => Object.fromEntries(siswa.map(s => [s.id, isianAwal(s)])),
  )

  const bisaDisetor = siswa.filter(s => s.jilid_id)
  const tanpaJilid = siswa.filter(s => !s.jilid_id)
  const perId = useMemo(() => new Map(siswa.map(s => [s.id, s])), [siswa])

  // Keanggotaan kelompok: id anak → kunci kelompok, null = individual.
  // Sumbernya pengaturan pengampu; ✕ dan "Gabung" di layar ini hanya
  // mengubah setoran HARI INI, bukan pengaturannya.
  const awal = useMemo(
    () => pengaturan
      ? anggotaDariPengaturan(pengaturan, bisaDisetor)
      : { anggota: kelompokOtomatis(bisaDisetor), bedaJilid: [] as string[] },
    // Dihitung sekali per pemasangan komponen; halaman dimuat ulang setelah simpan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const namaKelompok = useMemo(
    () => new Map((pengaturan ?? []).map(k => [k.id, k.nama])),
    [pengaturan],
  )
  const [anggota, setAnggota] = useState<Record<string, string | null>>(awal.anggota)
  const [kelompok, setKelompok] = useState<Record<string, IsianKelompok>>(() => {
    const isi: Record<string, IsianKelompok> = {}
    for (const k of new Set(Object.values(awal.anggota).filter((x): x is string => Boolean(x)))) {
      isi[k] = kelompokAwal(bisaDisetor.filter(s => awal.anggota[s.id] === k))
    }
    return isi
  })

  // Kelompok yang masih punya anggota, dengan urutan tampil tetap.
  const daftarKelompok = Object.keys(kelompok)
    .map(k => ({ kunci: k, anggota: bisaDisetor.filter(s => anggota[s.id] === k) }))
    .filter(g => g.anggota.length > 0)
  const individual = bisaDisetor.filter(s => !anggota[s.id])

  /** Posisi dasar kelompok dari data anggota TERBARU — ikut maju setelah disimpan. */
  function dasarKelompok(anak: SiswaSesiTahsin[]) {
    const wakil = anak[0]
    const halaman = modus(anak.map(s => s.halaman).filter((h): h is number => h !== null))
    return { wakil, halaman, buku: wakil?.total_halaman !== null }
  }

  function labelKelompok(anak: SiswaSesiTahsin[], kunci?: string): string {
    const { wakil, halaman, buku } = dasarKelompok(anak)
    if (!wakil) return ''
    const posisi = buku
      ? `${wakil.jilid_label} hal. ${halaman ?? '—'}`
      : `${wakil.jilid_label}${wakil.quran.surat_id ? ` · ${namaSurat(surat, wakil.quran.surat_id)}:${wakil.quran.ayat ?? ''}` : ''}`
    const nama = kunci ? namaKelompok.get(kunci) : undefined
    return nama ? `${nama} · ${posisi}` : posisi
  }

  const jumlahDipilih =
    individual.filter(s => isian[s.id]?.dipilih).length +
    daftarKelompok.reduce((n, g) => n + (kelompok[g.kunci]?.dipilih ? g.anggota.filter(s => !kelompok[g.kunci].absen[s.id]).length : 0), 0)

  function ubah(id: string, perubahan: Partial<Isian>) {
    setIsian(prev => ({ ...prev, [id]: { ...prev[id], ...perubahan, galat: undefined } }))
  }
  function ubahKelompok(k: string, perubahan: Partial<IsianKelompok>) {
    setKelompok(prev => ({ ...prev, [k]: { ...prev[k], ...perubahan } }))
  }
  /**
   * Nilai satu anggota. Bintang tahsin di bawah tiga ikut menjadikan anak itu
   * Ulang — sama seperti di setoran individual — tanpa menyentuh anggota lain.
   */
  function nilaiAnggota(k: string, id: string, aspek: 'tahsin' | 'sikap', bintang: number, nilai: number) {
    setKelompok(prev => {
      const kg = prev[k]
      const lama = kg.nilaiAnak[id] ?? { tahsin: null, sikap: null }
      return {
        ...prev,
        [k]: {
          ...kg,
          nilaiAnak: { ...kg.nilaiAnak, [id]: { ...lama, [aspek]: bintang > 0 ? nilai : null } },
          statusAnak: aspek === 'tahsin' && bintang > 0
            ? { ...kg.statusAnak, [id]: harusMengulang(bintang) ? 'ulang' : 'lulus' }
            : kg.statusAnak,
        },
      }
    })
  }

  function pilihSemua(nilai: boolean) {
    setIsian(prev => Object.fromEntries(
      Object.entries(prev).map(([id, v]) => [id, individual.some(s => s.id === id) ? { ...v, dipilih: nilai } : v]),
    ))
    setKelompok(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, dipilih: nilai }])))
  }

  function keluarkan(id: string) {
    setAnggota(prev => ({ ...prev, [id]: null }))
  }
  function gabungkan(id: string, k: string) {
    setAnggota(prev => ({ ...prev, [id]: k }))
    setKelompok(prev => {
      // Anak yang baru bergabung dianggap hadir.
      const absen = { ...prev[k].absen }
      delete absen[id]
      return { ...prev, [k]: { ...prev[k], absen } }
    })
  }
  function semuaIndividual() {
    setAnggota(Object.fromEntries(bisaDisetor.map(s => [s.id, null])))
  }

  /** Kelompok yang boleh didatangi anak ini: jilid sama, bentuk setoran sama. */
  function kelompokCocok(s: SiswaSesiTahsin) {
    if (s.materi.length > 0) return []
    return daftarKelompok.filter(g => {
      const w = g.anggota[0]
      return w && w.jilid_id === s.jilid_id && (w.total_halaman !== null) === (s.total_halaman !== null)
    })
  }

  function simpan() {
    const baris: InputSetoranTahsin[] = []
    for (const s of individual) {
      const v = isian[s.id]
      if (!v.dipilih) continue
      baris.push({
        student_id: s.id,
        method_id: s.method_id,
        jilid_id: s.jilid_id,
        // Tahap tak berbuku tidak punya halaman buku sama sekali; tahap berbasis
        // materi menurunkan halamannya sendiri di server.
        halaman: s.materi.length > 0 || s.total_halaman === null
          ? null
          : v.halaman ? Number(v.halaman) : s.halaman,
        quran: keBacaanQuran(v.quran),
        materi: Object.entries(v.materi).map(([materi_id, hasil]) => ({ materi_id, hasil })),
        nilai_tahsin: v.nilai_tahsin,
        nilai_sikap: v.nilai_sikap,
        status: v.status,
        catatan: v.catatan || null,
        setoran_date: tanggal,
      })
    }
    for (const g of daftarKelompok) {
      const kg = kelompok[g.kunci]
      if (!kg?.dipilih) continue
      const { halaman: dasar, buku } = dasarKelompok(g.anggota)
      for (const s of g.anggota) {
        if (kg.absen[s.id]) continue
        baris.push({
          student_id: s.id,
          method_id: s.method_id,
          jilid_id: s.jilid_id,
          halaman: buku ? (kg.halaman ? Number(kg.halaman) : dasar) : null,
          quran: keBacaanQuran(kg.quran),
          materi: [],
          nilai_tahsin: kg.nilaiAnak[s.id]?.tahsin ?? null,
          nilai_sikap: kg.nilaiAnak[s.id]?.sikap ?? null,
          status: kg.statusAnak[s.id] ?? kg.status,
          catatan: kg.catatan ? `Klasikal · ${kg.catatan}` : 'Klasikal',
          setoran_date: tanggal,
        })
      }
    }
    if (baris.length === 0) {
      toast.error('Centang minimal satu anak atau kelompok yang setor.')
      return
    }
    kirim(baris)
  }

  function kirim(baris: InputSetoranTahsin[]) {
    startTransition(async () => {
      const hasil = await createTahsinLogSesiAction(baris)
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
      const tersimpan = new Set(baris.map(b => b.student_id).filter(id => !ditahan.has(id) && !gagal.has(id)))

      setIsian(prev => {
        const next = { ...prev }
        for (const b of baris) {
          if (ditahan.has(b.student_id)) continue
          next[b.student_id] = gagal.has(b.student_id)
            ? { ...prev[b.student_id], galat: gagal.get(b.student_id) }
            : { ...isianAwal(perId.get(b.student_id)!), versi: prev[b.student_id].versi + 1 }
        }
        return next
      })
      // Kelompok yang seluruh anggota hadirnya tersimpan kembali ke keadaan awal.
      setKelompok(prev => {
        const next = { ...prev }
        for (const g of daftarKelompok) {
          const kg = prev[g.kunci]
          if (!kg?.dipilih) continue
          const hadir = g.anggota.filter(s => !kg.absen[s.id])
          if (hadir.length > 0 && hadir.every(s => tersimpan.has(s.id))) {
            next[g.kunci] = kelompokAwal(g.anggota, kg.versi + 1)
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
          <label htmlFor="tanggal_sesi" className="text-xs font-medium">Tanggal setor</label>
          <Input id="tanggal_sesi" type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-9 w-44" />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => pilihSemua(true)}>Centang semua</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => pilihSemua(false)}>Kosongkan</Button>
        </div>
      </div>

      {/* Cara setor: mengikuti pengaturan kelompok pengampu. */}
      <div className="space-y-1.5 rounded-xl border border-dashed px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="flex-1">
            {daftarKelompok.length > 0
              ? <><b>{daftarKelompok.length} kelompok klasikal</b>{pengaturan ? ' sesuai pengaturan' : ' dari anak yang posisinya sama'}. Anak lain setor individual.</>
              : pengaturan ? 'Belum ada kelompok klasikal — semua anak setor individual.' : 'Semua anak setor individual.'}
          </span>
          {pengaturan
            ? <Link href={`/guru/setoran/tahsin/kelompok?halaqoh=${halaqohId}`} className="font-medium text-primary hover:underline">Atur kelompok →</Link>
            : daftarKelompok.length > 0 && <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={semuaIndividual}>Semua individual</Button>}
        </div>
        {pengaturan && daftarKelompok.length > 0 && (
          <p className="text-[11px] text-muted-foreground">✕ dan &ldquo;Gabung&rdquo; di bawah hanya berlaku untuk setoran hari ini; pengaturan kelompok tidak berubah.</p>
        )}
        {awal.bedaJilid.length > 0 && (
          <p className="text-[11px] text-warning">
            {awal.bedaJilid.map(id => perId.get(id)?.full_name.split(' ')[0]).filter(Boolean).join(', ')} setor individual hari ini:
            jilid/tahapnya sudah berbeda dari kelompoknya. Perbarui di Atur Kelompok bila perlu.
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {daftarKelompok.map(g => {
          const kg = kelompok[g.kunci]
          const { wakil, halaman: dasar, buku } = dasarKelompok(g.anggota)
          const hadir = g.anggota.filter(s => !kg.absen[s.id]).length
          const halamanTerakhir = buku && wakil?.total_halaman !== null &&
            Number(kg.halaman || dasar) >= (wakil?.total_halaman ?? Infinity)
          return (
            <li key={g.kunci} className={cn('rounded-xl border-2 bg-card p-3 transition-colors', kg.dipilih ? 'border-primary/60' : 'border-dashed')}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={kg.dipilih}
                  onChange={e => ubahKelompok(g.kunci, { dipilih: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Users className="h-4 w-4 text-primary" /> Klasikal · {labelKelompok(g.anggota, g.kunci)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {g.anggota.length} anak: {g.anggota.map(s => s.full_name.split(' ')[0]).join(', ')}
                  </span>
                </span>
              </label>

              {kg.dipilih && (
                <div className="mt-3 space-y-3 border-t pt-3 sm:pl-7">
                  <div className="flex flex-wrap items-end gap-3">
                    {buku && wakil && (
                      <Stepper
                        label={`Hal. ${wakil.jilid_label}`}
                        value={kg.halaman}
                        onChange={v => ubahKelompok(g.kunci, { halaman: v })}
                        bawaan={dasar}
                        min={1} max={wakil.total_halaman ?? undefined}
                        disabled={pending}
                      />
                    )}
                    <TombolStatus value={kg.status} onChange={st => ubahKelompok(g.kunci, { status: st, statusAnak: {} })} />
                  </div>

                  {wakil?.baca_quran && (
                    <div className="rounded-lg border border-dashed p-2.5">
                      <p className="mb-1.5 text-xs font-semibold">📖 Bacaan Al-Qur&rsquo;an bersama</p>
                      <BacaanQuranInput value={kg.quran} onChange={q => ubahKelompok(g.kunci, { quran: q })} surat={surat} disabled={pending} />
                    </div>
                  )}

                  {/* Anggota: hadir, Lulus/Ulang, dan nilai per anak. */}
                  <div className="rounded-lg border">
                    <p className="border-b bg-muted/40 px-2.5 py-1.5 text-[11px] font-semibold">
                      Anggota · {hadir} hadir dari {g.anggota.length}
                    </p>
                    <ul className="divide-y">
                      {g.anggota.map(s => {
                        const st = kg.statusAnak[s.id] ?? kg.status
                        const absen = Boolean(kg.absen[s.id])
                        return (
                          <li key={s.id} className={cn('px-2.5 py-1.5', absen && 'opacity-50')}>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!absen}
                                onChange={e => ubahKelompok(g.kunci, { absen: { ...kg.absen, [s.id]: !e.target.checked } })}
                                aria-label={`${s.full_name} hadir`}
                                className="h-4 w-4 accent-primary"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{s.full_name}</span>
                                {isian[s.id]?.galat && <span role="alert" className="block text-[11px] text-destructive">{isian[s.id].galat}</span>}
                              </span>
                              {!absen && (
                                <button
                                  type="button"
                                  onClick={() => ubahKelompok(g.kunci, { statusAnak: { ...kg.statusAnak, [s.id]: st === 'lulus' ? 'ulang' : 'lulus' } })}
                                  className={cn('h-8 shrink-0 rounded-md border px-2 text-xs',
                                    st === 'lulus' ? 'border-success bg-success-wash text-success' : 'border-warning bg-warning-wash text-warning')}
                                >
                                  {st === 'lulus' ? '✅ Lulus' : '🔁 Ulang'}
                                </button>
                              )}
                              <button type="button" onClick={() => keluarkan(s.id)} title="Keluarkan — setor individual"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            {/* Anak yang absen tidak dinilai — barisnya tidak disimpan. */}
                            {!absen && (
                              <div className="mt-1.5 grid gap-2 pb-1 sm:grid-cols-2 sm:pl-6">
                                <div key={`t-${kg.versi}`}>
                                  <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">Nilai tahsin</p>
                                  <StarInput
                                    name={`nilai_tahsin_k_${g.kunci}_${s.id}`}
                                    onChange={(b, n) => nilaiAnggota(g.kunci, s.id, 'tahsin', b, n)}
                                    disabled={pending}
                                  />
                                </div>
                                <div key={`s-${kg.versi}`}>
                                  <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">Nilai adab</p>
                                  <StarInput
                                    name={`nilai_sikap_k_${g.kunci}_${s.id}`}
                                    onChange={(b, n) => nilaiAnggota(g.kunci, s.id, 'sikap', b, n)}
                                    disabled={pending}
                                  />
                                </div>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <Input
                    placeholder="Catatan kelompok (opsional)"
                    value={kg.catatan}
                    onChange={e => ubahKelompok(g.kunci, { catatan: e.target.value })}
                    className="h-9"
                  />
                  {halamanTerakhir && kg.status === 'lulus' && (
                    <p className="text-xs text-primary">🎯 Halaman terakhir — anggota yang lulus masuk DRILL sampai lulus ujian tahsin.</p>
                  )}
                </div>
              )}
            </li>
          )
        })}

        {individual.map(s => {
          const v = isian[s.id]
          const halamanTerakhir = s.total_halaman !== null && Number(v.halaman || s.halaman) >= s.total_halaman
          const bisaGabung = kelompokCocok(s)
          const naik = s.total_halaman !== null && s.halaman && v.halaman ? Number(v.halaman) - s.halaman : 0
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
                    {s.drill_sejak && (
                      <span className="rounded-full bg-warning-wash px-1.5 py-px text-[10px] font-semibold text-warning">DRILL</span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.jilid_label}{s.total_halaman && s.halaman ? ` · hal. ${s.halaman}/${s.total_halaman}` : ''}
                    {s.baca_quran && s.quran.surat_id
                      ? ` · 📖 ${namaSurat(surat, s.quran.surat_id)}${s.quran.ayat ? `:${s.quran.ayat}` : ''}`
                      : ''}
                    {s.kelas ? ` · Kelas ${s.kelas}` : ''}
                  </span>
                </span>
              </label>

              {v.dipilih && (
                <div className="mt-3 space-y-3 border-t pt-3 sm:pl-7">
                  <div className="flex flex-wrap items-end gap-3">
                    {/*
                      Hanya tahap berbuku yang punya kolom ini. Di tahap Al-Qur'an
                      angka halaman yang dimaksud adalah halaman MUSHAF, dan itu
                      sudah punya kolomnya sendiri di bawah.
                    */}
                    {s.total_halaman !== null && s.materi.length === 0 && (
                      <Stepper
                        label={`Hal. ${s.jilid_label}${s.drill_sejak ? ' (drill)' : ''}`}
                        value={v.halaman}
                        onChange={h => ubah(s.id, { halaman: h })}
                        bawaan={s.halaman}
                        min={1} max={s.total_halaman}
                        disabled={pending}
                        petunjuk={naik > 0 ? `+${naik} dari posisi` : naik < 0 ? `${naik} dari posisi` : undefined}
                      />
                    )}
                    {/*
                      Tahap berbasis materi tidak punya status tunggal: server
                      menurunkannya dari hasil tiap materi.
                    */}
                    {s.materi.length === 0 && (
                      <TombolStatus value={v.status} onChange={st => ubah(s.id, { status: st })} />
                    )}
                  </div>

                  {s.materi.length > 0 && (
                    <div className="rounded-lg border p-2.5">
                      <p className="mb-1.5 text-xs font-semibold">🧠 Hafalan {s.jilid_label}</p>
                      <PilihMateri
                        materi={s.materi}
                        hasilTerakhir={s.materi_hasil}
                        value={v.materi}
                        onChange={m => ubah(s.id, { materi: m })}
                        disabled={pending}
                      />
                    </div>
                  )}

                  {s.baca_quran && (
                    <div className="rounded-lg border border-dashed p-2.5">
                      <p className="mb-1.5 text-xs font-semibold">
                        📖 Bacaan Al-Qur&rsquo;an
                        {s.total_halaman !== null && (
                          <span className="ml-1.5 font-normal text-muted-foreground">— berjalan bersama hafalan {s.jilid_label}</span>
                        )}
                      </p>
                      <BacaanQuranInput value={v.quran} onChange={q => ubah(s.id, { quran: q })} surat={surat} disabled={pending} />
                    </div>
                  )}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div key={`t-${v.versi}`}>
                      <p className="mb-1 text-xs font-medium">Nilai tahsin</p>
                      <StarInput
                        name={`nilai_tahsin_${s.id}`}
                        onChange={(b, n) => ubah(s.id, {
                          nilai_tahsin: b > 0 ? n : null,
                          ...(b > 0 ? { status: harusMengulang(b) ? 'ulang' : 'lulus' } : {}),
                        })}
                      />
                    </div>
                    <div key={`s-${v.versi}`}>
                      <p className="mb-1 text-xs font-medium">Nilai adab</p>
                      <StarInput name={`nilai_sikap_${s.id}`} onChange={(b, n) => ubah(s.id, { nilai_sikap: b > 0 ? n : null })} />
                    </div>
                  </div>

                  <Input
                    placeholder="Catatan (opsional) — mis. baris yang dibaca, madd perlu dilatih…"
                    value={v.catatan}
                    onChange={e => ubah(s.id, { catatan: e.target.value })}
                    className="h-9"
                  />

                  {!s.drill_sejak && s.materi.length === 0 && v.status === 'lulus' && halamanTerakhir && (
                    <p className="text-xs text-primary">🎯 Halaman terakhir — setelah disimpan anak masuk DRILL sampai lulus ujian tahsin.</p>
                  )}
                  {v.galat && <p role="alert" className="text-xs font-medium text-destructive">{v.galat}</p>}
                </div>
              )}

              {bisaGabung.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:pl-7">
                  <span className="text-[11px] text-muted-foreground">Gabung klasikal:</span>
                  {bisaGabung.map(g => (
                    <button key={g.kunci} type="button" onClick={() => gabungkan(s.id, g.kunci)}
                      className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] hover:bg-muted">
                      <Users className="h-3 w-3" />{labelKelompok(g.anggota, g.kunci)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {tanpaJilid.length > 0 && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {tanpaJilid.length} anak belum punya jilid awal ({tanpaJilid.map(s => s.full_name.split(' ')[0]).join(', ')}).
          Setoran pertamanya lewat{' '}
          <Link href="/guru/setoran/tahsin/baru" className="text-primary hover:underline">setor satu-satu</Link>{' '}
          untuk menetapkan metode &amp; jilid.
        </p>
      )}

      {/* Tombol simpan menempel di bawah layar — satu sesi bisa belasan
          kartu, dan menggulung kembali ke atas hanya untuk menyimpan melelahkan. */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <Button type="button" size="lg" className="w-full" onClick={simpan} disabled={pending || jumlahDipilih === 0}>
          {pending ? 'Menyimpan…' : jumlahDipilih > 0 ? `Simpan ${jumlahDipilih} setoran` : 'Centang anak yang setor'}
        </Button>
      </div>
    </div>
  )
}

function TombolStatus({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Status halaman">
      {(['lulus', 'ulang'] as const).map(st => (
        <button
          key={st}
          type="button"
          onClick={() => onChange(st)}
          aria-pressed={value === st}
          className={cn(
            'h-11 rounded-md border px-3 text-sm',
            value === st
              ? st === 'lulus' ? 'border-success bg-success-wash text-success' : 'border-warning bg-warning-wash text-warning'
              : 'bg-card',
          )}
        >
          {st === 'lulus' ? '✅ Lulus' : '🔁 Ulang'}
        </button>
      ))}
    </div>
  )
}
