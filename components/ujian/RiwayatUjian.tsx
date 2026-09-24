'use client'

import { useMemo, useState } from 'react'
import { BookOpen, ClipboardList, Filter, UserCheck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERIODE_SELECT_CLASS, PilihPeriode } from './PilihPeriode'
import {
  BULAN_ID, KATEGORI_TAHFIDZ_LABEL, TASMI_TIPE,
  formatTanggal, groupSiswaByLevel,
  getPredikatClass, getPredikatLabel, getTahfidzKategori, getTahfidzLabel,
  getSiswaPredikatClass, getSiswaPredikatLabel, urutJuz,
} from '@/lib/rq/ujian'
import type { TahfidzKategori } from '@/lib/rq/ujian'
import type { TahfidzTipe, UjianTahfidz, UjianTahsin } from '@/types'

interface Props {
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
  month: number
  year: number
}

const TANPA_PENGUJI = 'Tanpa penguji'

/** Kategori baris: dua agenda tahfidz, plus tahsin yang berdiri sendiri. */
type Kategori = TahfidzKategori | 'tahsin'

interface Baris {
  id: string
  penguji: string
  nama: string
  jadwal: string | null
  kategori: Kategori
  /** Tahfidz saja — dipakai penyaring turunan tasmi' (3 juz / 5 juz). */
  tipe: TahfidzTipe | null
  /** Tahfidz saja — nomor juz untuk juz'iyyah, rentang untuk tasmi'. */
  juz: string | null
  /** Tahsin saja — seluruh level yang diuji kelompok ini, untuk penyaring jilid. */
  levels: string[] | null
  /** Tahsin saja — sumbernya disimpan supaya baris bisa dihitung ulang per jilid. */
  tahsin: UjianTahsin | null
  rincian: string
  hasil: string
  hasilKelas: string
}

const KATEGORI_OPSI: { value: Kategori; label: string }[] = [
  { value: 'juziyyah', label: KATEGORI_TAHFIDZ_LABEL.juziyyah },
  { value: 'tasmi',    label: KATEGORI_TAHFIDZ_LABEL.tasmi    },
  { value: 'tahsin',   label: 'Tahsin'                        },
]

/** Hitung berapa baris per nilai; kunci null diabaikan. */
function hitung<T>(rows: Baris[], ambil: (r: Baris) => T | null): Map<T, number> {
  const peta = new Map<T, number>()
  for (const r of rows) {
    const k = ambil(r)
    if (k === null) continue
    peta.set(k, (peta.get(k) ?? 0) + 1)
  }
  return peta
}

/** Jumlah siswa per level di seluruh kelompok tahsin pada `rows`. */
function hitungSiswaPerJilid(rows: Baris[]): Map<string, number> {
  const peta = new Map<string, number>()
  for (const r of rows) {
    if (!r.tahsin) continue
    for (const g of groupSiswaByLevel(r.tahsin)) {
      peta.set(g.level, (peta.get(g.level) ?? 0) + g.siswa.length)
    }
  }
  return peta
}

/** Satu baris mewakili satu kelompok tahsin — bentuk bawaan daftar ini. */
function barisTahsin(t: UjianTahsin): Baris {
  const grup = groupSiswaByLevel(t)
  const lulus = t.siswa.filter(s => s.predikat === 'lulus').length

  return {
    id: `ts-${t.id}`,
    penguji: t.penguji?.trim() || TANPA_PENGUJI,
    nama: t.nama_kelompok,
    jadwal: t.jadwal,
    kategori: 'tahsin',
    tipe: null,
    juz: null,
    levels: grup.map(g => g.level),
    tahsin: t,
    rincian: `${grup.map(g => g.level).join(', ') || t.level} · ${t.unit} · ${t.siswa.length} siswa · Sesi ${t.sesi}`,
    hasil: `${lulus}/${t.siswa.length} lulus`,
    hasilKelas: 'text-success font-medium',
  }
}

/**
 * Satu baris per siswa, untuk satu jilid dari satu kelompok.
 *
 * Dipakai begitu penyaring jilid aktif: pertanyaannya berubah dari "kelompok
 * mana yang menguji Jilid 3" menjadi "siapa saja yang diuji Jilid 3", jadi nama
 * anak naik jadi judul baris dan kelompoknya turun jadi keterangan asal.
 */
function barisSiswaTahsin(t: UjianTahsin, level: string): Baris[] {
  const grup = groupSiswaByLevel(t).find(g => g.level === level)

  return (grup?.siswa ?? []).map((s, i) => ({
    // Nama bisa kembar antar kelompok, jadi kuncinya ikut membawa asal & urutan.
    id: `ts-${t.id}-${level}-${i}`,
    penguji: t.penguji?.trim() || TANPA_PENGUJI,
    nama: s.nama,
    jadwal: t.jadwal,
    kategori: 'tahsin',
    tipe: null,
    juz: null,
    // Baris ini lahir setelah penyaringan, jadi ia tidak perlu ikut disaring lagi.
    levels: null,
    tahsin: null,
    rincian: `${t.nama_kelompok} · ${level} · ${t.unit} · Sesi ${t.sesi}`,
    hasil: getSiswaPredikatLabel(s.predikat),
    hasilKelas: getSiswaPredikatClass(s.predikat),
  }))
}

/**
 * Rekap ujian selesai satu bulan, dikelompokkan per penguji.
 *
 * Sudut pandangnya sengaja berbeda dari halaman rekap publik: yang dicari di
 * sini bukan "anak mana yang lulus" melainkan "berapa banyak yang diuji siapa"
 * — dipakai koordinator untuk membagi beban penguji bulan berikutnya.
 */
export function RiwayatUjian({ tahfidz, tahsin, month, year }: Props) {
  const [saring, setSaring] = useState('semua')
  const [kategori, setKategori] = useState<Kategori | 'semua'>('semua')
  // Juz dan tipe tasmi' disimpan terpisah supaya berpindah jenis bolak-balik
  // tidak menghapus pilihan yang tadi dipakai.
  const [juz, setJuz] = useState('semua')
  const [tasmi, setTasmi] = useState<TahfidzTipe | 'semua'>('semua')
  const [jilid, setJilid] = useState('semua')

  const baris = useMemo<Baris[]>(() => {
    const tf: Baris[] = tahfidz.map(t => ({
      id: `tf-${t.id}`,
      penguji: t.penguji?.trim() || TANPA_PENGUJI,
      nama: t.nama_siswa,
      jadwal: t.jadwal,
      kategori: getTahfidzKategori(t.tipe),
      tipe: t.tipe,
      juz: t.juz,
      levels: null,
      tahsin: null,
      rincian: `${getTahfidzLabel(t.tipe, t.juz)} · ${t.unit} kelas ${t.kelas}${t.is_quls ? ' · QULS' : ''}`,
      hasil: getPredikatLabel(t.predikat),
      hasilKelas: getPredikatClass(t.predikat),
    }))

    const ts: Baris[] = tahsin.map(barisTahsin)

    return [...tf, ...ts]
  }, [tahfidz, tahsin])

  // "Tanpa penguji" selalu di urutan terakhir — ia bukan nama orang, dan
  // menaruhnya di antara nama-nama membuat daftarnya sulit dibaca.
  const urutPenguji = (a: string, b: string) =>
    a === TANPA_PENGUJI ? 1 : b === TANPA_PENGUJI ? -1 : a.localeCompare(b)

  const namaPenguji = useMemo(
    () => [...new Set(baris.map(r => r.penguji))].sort(urutPenguji),
    [baris],
  )

  // Penguji disaring lebih dulu dan jadi dasar semua penyaring berikutnya:
  // saat satu penguji dipilih, pilihan juz ikut menyusut ke juz yang benar-benar
  // ia uji, bukan seluruh juz di bulan itu.
  const dasar = useMemo(
    () => (saring === 'semua' ? baris : baris.filter(r => r.penguji === saring)),
    [baris, saring],
  )

  const jumlahKategori = useMemo(() => hitung(dasar, r => r.kategori), [dasar])

  const juzTersedia = useMemo(() => {
    const peta = hitung(dasar, r => (r.kategori === 'juziyyah' ? r.juz : null))
    return [...peta.entries()].sort((a, b) => urutJuz(a[0], b[0]))
  }, [dasar])

  const tasmiTersedia = useMemo(() => {
    const peta = hitung(dasar, r => (r.kategori === 'tasmi' ? r.tipe : null))
    return TASMI_TIPE.map(t => ({ ...t, jumlah: peta.get(t.value) ?? 0 }))
      .filter(t => t.jumlah > 0)
  }, [dasar])

  // Angkanya jumlah siswa, bukan jumlah kelompok — satu kelompok berisi lima
  // anak Jilid 2 dan tiga anak Jilid 3 tidak berarti kedua jilid itu sama sibuk.
  // Jilid tersibuk lebih dulu: yang dicari koordinator adalah "bulan ini paling
  // banyak menguji jilid berapa", bukan urutan kurikulumnya. Seri dipecah menurut
  // nama supaya daftarnya tidak berubah-ubah sendiri antar render.
  const jilidTersedia = useMemo(() => {
    const peta = hitungSiswaPerJilid(dasar)
    return [...peta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [dasar])

  // Pilihan yang hilang dari data (ganti bulan, ganti penguji) jatuh kembali ke
  // "semua" — kalau tidak, daftarnya kosong karena menyaring nilai yang sudah
  // tidak ada pilihannya di dropdown.
  const juzAktif = juzTersedia.some(([j]) => j === juz) ? juz : 'semua'
  const tasmiAktif = tasmiTersedia.some(t => t.value === tasmi) ? tasmi : 'semua'
  // Ikut mensyaratkan kategori tahsin, tidak seperti dua penyaring di atas:
  // pilihan jilid mengubah bentuk daftar di luar penyaringan, jadi ia harus mati
  // sepenuhnya saat jenis lain dipilih — bukan sekadar tak terpakai.
  const jilidAktif =
    kategori === 'tahsin' && jilidTersedia.some(([l]) => l === jilid) ? jilid : 'semua'

  const tampil = useMemo(() => {
    const cocok = dasar.filter(r => {
      if (kategori === 'semua') return true
      if (r.kategori !== kategori) return false
      if (kategori === 'juziyyah') return juzAktif === 'semua' || r.juz === juzAktif
      if (kategori === 'tasmi') return tasmiAktif === 'semua' || r.tipe === tasmiAktif
      return jilidAktif === 'semua' || (r.levels?.includes(jilidAktif) ?? false)
    })

    // Memilih satu jilid mengganti satuan barisnya: kelompok pecah menjadi
    // siswa-siswanya, dan hanya yang benar-benar diuji di jilid itu yang tinggal.
    if (jilidAktif === 'semua') return cocok
    return cocok.flatMap(r => (r.tahsin ? barisSiswaTahsin(r.tahsin, jilidAktif) : [r]))
  }, [dasar, kategori, juzAktif, tasmiAktif, jilidAktif])

  /** Saat jilid dipilih satu baris adalah satu anak, bukan satu ujian. */
  const perSiswa = jilidAktif !== 'semua'

  const perPenguji = useMemo(() => {
    const peta = new Map<string, Baris[]>()
    for (const r of tampil) {
      const arr = peta.get(r.penguji) ?? []
      arr.push(r)
      peta.set(r.penguji, arr)
    }
    return [...peta.entries()].sort((a, b) => urutPenguji(a[0], b[0]))
  }, [tampil])

  const adaSaringan = saring !== 'semua' || kategori !== 'semua'

  return (
    <div className="space-y-4">
      <PilihPeriode month={month} year={year}>
        <select
          aria-label="Saring penguji"
          value={saring}
          onChange={e => setSaring(e.target.value)}
          className={`${PERIODE_SELECT_CLASS} w-full sm:w-56`}
        >
          <option value="semua">Semua penguji</option>
          {namaPenguji.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </PilihPeriode>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Jenis
        </span>
        <select
          aria-label="Jenis ujian"
          value={kategori}
          onChange={e => setKategori(e.target.value as Kategori | 'semua')}
          className={`${PERIODE_SELECT_CLASS} min-w-40 flex-1 sm:w-52 sm:flex-none`}
        >
          <option value="semua">Semua jenis ({dasar.length})</option>
          {KATEGORI_OPSI.map(({ value, label }) => (
            <option key={value} value={value}>
              {label} ({jumlahKategori.get(value) ?? 0})
            </option>
          ))}
        </select>

        {/* Dropdown turunan: hanya muncul untuk jenis tahfidz yang dipilih, dan
            hanya bila ada nilai yang benar-benar terpakai bulan itu. */}
        {kategori === 'juziyyah' && juzTersedia.length > 0 && (
          <select
            aria-label="Saring juz"
            value={juzAktif}
            onChange={e => setJuz(e.target.value)}
            className={`${PERIODE_SELECT_CLASS} min-w-36 flex-1 sm:w-44 sm:flex-none`}
          >
            <option value="semua">Semua juz</option>
            {juzTersedia.map(([j, n]) => (
              <option key={j} value={j}>Juz {j} ({n})</option>
            ))}
          </select>
        )}

        {kategori === 'tasmi' && tasmiTersedia.length > 0 && (
          <select
            aria-label="Saring tipe tasmi'"
            value={tasmiAktif}
            onChange={e => setTasmi(e.target.value as TahfidzTipe | 'semua')}
            className={`${PERIODE_SELECT_CLASS} min-w-40 flex-1 sm:w-48 sm:flex-none`}
          >
            <option value="semua">Semua tasmi&apos;</option>
            {tasmiTersedia.map(({ value, label, jumlah }) => (
              <option key={value} value={value}>{label} ({jumlah})</option>
            ))}
          </select>
        )}

        {kategori === 'tahsin' && jilidTersedia.length > 0 && (
          <select
            aria-label="Saring jilid"
            value={jilidAktif}
            onChange={e => setJilid(e.target.value)}
            className={`${PERIODE_SELECT_CLASS} min-w-36 flex-1 sm:w-44 sm:flex-none`}
          >
            <option value="semua">Semua jilid</option>
            {/* Satuannya ditulis apa adanya: angka di dropdown lain menghitung
                ujian, yang ini menghitung anak. */}
            {jilidTersedia.map(([l, n]) => (
              <option key={l} value={l}>{l} ({n} siswa)</option>
            ))}
          </select>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{tampil.length}</span>{' '}
        {perSiswa ? `siswa diuji ${jilidAktif}` : 'ujian selesai'} pada{' '}
        {BULAN_ID[month - 1]} {year}
      </p>

      {tampil.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center">
          <UserCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">
            {adaSaringan
              ? `Tidak ada ${perSiswa ? 'siswa' : 'ujian'} yang cocok dengan penyaring ini`
              : 'Belum ada ujian selesai pada periode ini'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {perPenguji.map(([penguji, items]) => (
            <section key={penguji}>
              <h2 className="font-heading text-lg font-medium mb-2 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                {penguji}
                <span className="font-normal text-muted-foreground">
                  ({items.length} {perSiswa ? 'siswa' : 'ujian'})
                </span>
              </h2>
              <ul className="divide-y rounded-2xl border bg-card">
                {items.map(r => (
                  <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium">
                        {r.kategori !== 'tahsin'
                          ? <BookOpen className="h-3.5 w-3.5 shrink-0 text-info" />
                          : perSiswa
                            ? <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
                            : <ClipboardList className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        <span className="truncate">{r.nama}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.rincian}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        Diuji {formatTanggal(r.jadwal)}
                      </p>
                    </div>
                    <span className={cn('shrink-0 text-right text-xs', r.hasilKelas)}>
                      {r.hasil}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
