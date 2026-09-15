'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, ClipboardList, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmen } from './Segmen'
import { TAHSIN_LEVELS, getTahfidzLabel } from '@/lib/rq/ujian'
import { juzTersedia, ringkasHafalan } from '@/lib/rq/hafalan'
import { PilihSiswa } from './PilihSiswa'
import type { SaranSiswa } from '@/app/actions/ujian'
import { createTahfidzUjianAction, createTahsinUjianAction } from '@/app/actions/ujian'
import type { TahfidzTipe, UjianSiswa, UjianUnit } from '@/types'

interface Props {
  /**
   * Unit yang boleh dipilih pengaju. Satu unit = tampil sebagai keterangan,
   * dua unit = tampil sebagai pilihan (kepala RQ & kumik memegang keduanya).
   */
  units: UjianUnit[]
  /** Ke mana diarahkan setelah pengajuan tersimpan. */
  redirectTo: string
}

const SELECT_CLASS =
  'h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function FormPengajuan({ units, redirectTo }: Props) {
  const [jenis, setJenis] = useState<'tahfidz' | 'tahsin'>('tahfidz')
  const [unit, setUnit] = useState<UjianUnit>(units[0] ?? 'SD')

  return (
    <div className="space-y-5">
      <Segmen
        label="Jenis ujian"
        value={jenis}
        onChange={setJenis}
        options={[
          { value: 'tahfidz', label: 'Tahfidz', icon: <BookOpen className="h-4 w-4" />      },
          { value: 'tahsin',  label: 'Tahsin',  icon: <ClipboardList className="h-4 w-4" /> },
        ]}
      />

      {units.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="unit">Unit</Label>
          <select
            id="unit"
            value={unit}
            onChange={e => setUnit(e.target.value as UjianUnit)}
            className={SELECT_CLASS}
          >
            {units.map(u => (
              <option key={u} value={u}>{u === 'SD' ? 'SDIT LHI' : 'SMPIT LHI'}</option>
            ))}
          </select>
        </div>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Unit: <span className="font-medium text-foreground">{unit}</span> — sesuai akun Anda.
        </p>
      )}

      <div className="rounded-xl border bg-card p-4">
        {jenis === 'tahfidz'
          ? <FormTahfidz key={unit} unit={unit} redirectTo={redirectTo} />
          : <FormTahsin unit={unit} redirectTo={redirectTo} />}
      </div>
    </div>
  )
}

// ─── Tahfidz ─────────────────────────────────────────────────────────────────


function FormTahfidz({ unit, redirectTo }: { unit: UjianUnit; redirectTo: string }) {
  const router = useRouter()
  const [tipe, setTipe] = useState<TahfidzTipe>('1_juz')
  const [siswa, setSiswa] = useState<SaranSiswa | null>(null)
  const [namaFlyer, setNamaFlyer] = useState('')
  const [isQuls, setIsQuls] = useState(false)

  // Juz yang sudah dilewati tidak ditawarkan lagi. Anak yang sudah juz'iyyah
  // juz 26 hanya melihat 1-25, sebab 30-26 pasti sudah lewat.
  const pilihanJuz = juzTersedia(siswa?.sudahSampai ?? 0)
  const [juz, setJuz] = useState('')

  // Berganti siswa mengubah daftar juz-nya, jadi pilihan lama bisa jadi tidak
  // sah lagi. Dijatuhkan ke juz terdekat yang belum dilewati, bukan dibiarkan
  // menunjuk juz yang sudah hilang dari daftar.
  const juzSah = juz && pilihanJuz.includes(Number(juz)) ? juz : String(pilihanJuz[0] ?? '')

  function pilihSiswa(s: SaranSiswa | null) {
    setSiswa(s)
    setJuz('')
    if (s) {
      // Nama flyer diisi awal dengan nama depannya saja — pengaju tinggal
      // menyingkat sisanya, alih-alih mengetik ulang dari nol.
      setNamaFlyer(s.full_name.split(' ')[0] ?? '')
      setIsQuls(Boolean(s.program && s.program.includes('quls')))
    } else {
      setNamaFlyer('')
      setIsQuls(false)
    }
  }
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const hasil = await createTahfidzUjianAction({
        tipe,
        juz: tipe === '1_juz' ? juzSah : juz,
        student_id: siswa?.id ?? null,
        nama_siswa: siswa?.full_name ?? '',
        nama_flyer: namaFlyer,
        kelas: siswa?.kelas ?? '',
        is_quls: isQuls,
        unit,
      })
      if (hasil.error) {
        setError(hasil.error)
        return
      }
      router.push(redirectTo)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Siswa lebih dulu, dan bukan sekadar urutan yang enak dibaca: daftar
          juz di bawah disaring oleh capaian anaknya, jadi memilih juz sebelum
          memilih siswa berarti daftarnya berubah setelah pengaju memilih. */}
      <div className="space-y-1.5">
        <Label>Siswa</Label>
        <PilihSiswa unit={unit} terpilih={siswa} onPilih={pilihSiswa} />
        {siswa && (
          <p className="text-xs text-muted-foreground">
            Kelas &amp; capaian juz terisi dari data siswa, jadi tidak perlu diketik.
          </p>
        )}
      </div>

      {siswa && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="nama_flyer">Nama untuk flyer</Label>
            <Input id="nama_flyer" className="h-9" value={namaFlyer}
              onChange={e => setNamaFlyer(e.target.value)} placeholder="Contoh: Khansa A. C." required />
            <p className="text-xs text-muted-foreground">
              Yang tercantum di flyer &amp; broadcast. Sengaja bukan nama lengkap:
              keduanya beredar ke luar sekolah.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipe">Tipe ujian</Label>
            <select
              id="tipe"
              value={tipe}
              onChange={e => {
                setTipe(e.target.value as TahfidzTipe)
                // Rentang tasmi' tidak bisa ditebak dari capaian, jadi
                // dikosongkan supaya pengaju mengetiknya sendiri.
                setJuz('')
              }}
              className={SELECT_CLASS}
            >
              <option value="1_juz">1 Juz — Tasmi&apos; Juz</option>
              <option value="3_juz">3 Juz — Tasmi&apos; 3 Juz</option>
              <option value="5_juz">5 Juz — Tasmi&apos; 5 Juz</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="juz">{tipe === '1_juz' ? 'Nomor juz' : 'Rentang juz'}</Label>
            {tipe === '1_juz' ? (
              <>
                <select id="juz" value={juzSah} onChange={e => setJuz(e.target.value)} className={SELECT_CLASS}>
                  {pilihanJuz.map(n => <option key={n} value={String(n)}>Juz {n}</option>)}
                </select>
                {siswa.sudahSampai > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Juz yang sudah dilewati tidak ditawarkan — {ringkasHafalan(siswa.sudahSampai)}.
                  </p>
                )}
              </>
            ) : (
              <Input
                id="juz"
                className="h-9"
                placeholder={tipe === '3_juz' ? '28-30' : '26-30'}
                value={juz}
                onChange={e => setJuz(e.target.value)}
                required
              />
            )}
          </div>

          {(tipe === '1_juz' ? juzSah : juz) && (
            <p className="rounded-lg bg-info-wash px-3 py-2 text-sm text-info">
              Label: {getTahfidzLabel(tipe, tipe === '1_juz' ? juzSah : juz)}
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 select-none">
            <input
              type="checkbox"
              checked={isQuls}
              onChange={e => setIsQuls(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="text-sm font-medium">Program QULS</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Tercentang sendiri bila program siswa ini QULS. Boleh dikoreksi.
              </span>
            </span>
          </label>
        </>
      )}

      {error && <PesanError>{error}</PesanError>}

      <Button type="submit" size="lg" className="w-full" disabled={loading || !siswa}>
        {loading ? 'Menyimpan…' : siswa ? 'Ajukan ujian tahfidz' : 'Pilih siswa lebih dulu'}
      </Button>
    </form>
  )
}

// ─── Tahsin ──────────────────────────────────────────────────────────────────

/** Satu capaian/level beserta daftar siswanya. */
/**
 * Satu baris siswa di pengajuan tahsin.
 *
 * `pilihan` menyimpan anak yang benar-benar dipilih dari daftar halaqoh.
 * Selama null, barisnya belum sah — nama yang hanya diketik tidak lagi
 * diterima, sebab nama tanpa tautan tidak bisa dinaikkan jilidnya saat lulus
 * dan tidak bisa dihitung analitik. Persoalan yang sama sudah diselesaikan
 * lebih dulu di pengajuan tahfidz; pengajuan tahsin tertinggal.
 */
interface BarisSiswaTahsin {
  pilihan: SaranSiswa | null
}

interface KelompokLevel {
  level: string
  siswa: BarisSiswaTahsin[]
}

function kelompokKosong(): KelompokLevel {
  return { level: '', siswa: [{ pilihan: null }] }
}

function FormTahsin({ unit, redirectTo }: { unit: UjianUnit; redirectTo: string }) {
  const router = useRouter()
  const [namaKelompok, setNamaKelompok] = useState('')
  const [sesi, setSesi] = useState('')
  const [kelompok, setKelompok] = useState<KelompokLevel[]>([kelompokKosong()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function ubahLevel(gi: number, level: string) {
    setKelompok(prev => prev.map((g, i) => (i === gi ? { ...g, level } : g)))
  }

  function ubahSiswa(gi: number, si: number, pilihan: SaranSiswa | null) {
    setKelompok(prev => prev.map((g, i) =>
      i === gi ? { ...g, siswa: g.siswa.map((s, j) => (j === si ? { pilihan } : s)) } : g))
  }

  /** Anak yang sudah dipakai di baris lain — supaya tidak diajukan dua kali. */
  const sudahDipakai = new Set(
    kelompok.flatMap(g => g.siswa.map(s => s.pilihan?.id).filter(Boolean) as string[]),
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Rakit daftar datar — tiap siswa membawa levelnya sendiri, sebab satu
    // kelompok bisa menguji beberapa level dalam satu sesi.
    const siswa: UjianSiswa[] = []
    const levelDipakai: string[] = []
    for (const g of kelompok) {
      const level = g.level.trim()
      const dipilih = g.siswa.map(s => s.pilihan).filter((s): s is SaranSiswa => Boolean(s))
      if (!level && dipilih.length === 0) continue
      if (!level) {
        setError('Pilih level untuk setiap capaian.')
        return
      }
      if (dipilih.length === 0) {
        setError(`Level "${level}" belum punya siswa. Pilih minimal satu nama dari halaqoh Anda.`)
        return
      }
      if (!levelDipakai.includes(level)) levelDipakai.push(level)
      for (const s of dipilih) {
        siswa.push({
          nama: s.full_name,
          predikat: null,
          level,
          student_id: s.id,
          kelas: s.kelas,
        })
      }
    }

    if (siswa.length === 0) {
      setError('Tambahkan minimal satu level dengan satu siswa.')
      return
    }

    setLoading(true)
    try {
      const hasil = await createTahsinUjianAction({
        nama_kelompok: namaKelompok,
        sesi,
        level: levelDipakai.join(', '),
        siswa,
        unit,
      })
      if (hasil.error) {
        setError(hasil.error)
        return
      }
      router.push(redirectTo)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nama_kelompok">Nama kelompok / ustadz-ustadzah</Label>
        <Input id="nama_kelompok" className="h-9" value={namaKelompok}
          onChange={e => setNamaKelompok(e.target.value)} placeholder="Nama ustadz/ustadzah" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sesi">Sesi</Label>
        <Input id="sesi" className="h-9" value={sesi}
          onChange={e => setSesi(e.target.value)} placeholder="Contoh: Sesi 1, Pagi" required />
      </div>

      <div className="space-y-3">
        <Label>Level &amp; siswa</Label>

        {kelompok.map((group, gi) => (
          <div key={gi} className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                Capaian {gi + 1}
              </span>
              <select
                aria-label={`Level capaian ${gi + 1}`}
                value={group.level}
                onChange={e => ubahLevel(gi, e.target.value)}
                required
                className={`${SELECT_CLASS} flex-1`}
              >
                <option value="" disabled>Pilih level…</option>
                {TAHSIN_LEVELS[unit].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {kelompok.length > 1 && (
                <Button
                  type="button" variant="ghost" size="icon-sm"
                  aria-label={`Hapus capaian ${gi + 1}`}
                  onClick={() => setKelompok(prev => prev.filter((_, i) => i !== gi))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {group.siswa.map((s, si) => (
                <div key={si} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right text-xs text-muted-foreground">{si + 1}.</span>
                  {/* Ketik nama → muncul anak dari halaqoh yang diampu saja.
                      Penyaringan halaqohnya dikerjakan server (lihat
                      cariSiswaUjianAction), bukan komponen ini. */}
                  <div className="min-w-0 flex-1">
                    <PilihSiswa
                      unit={unit}
                      terpilih={s.pilihan}
                      onPilih={p => ubahSiswa(gi, si, p)}
                      kecualikan={sudahDipakai}
                    />
                  </div>
                  {group.siswa.length > 1 && (
                    <Button
                      type="button" variant="ghost" size="icon-sm"
                      aria-label={`Hapus siswa ${si + 1}`}
                      onClick={() => setKelompok(prev => prev.map((g, i) =>
                        i === gi ? { ...g, siswa: g.siswa.filter((_, j) => j !== si) } : g))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button" variant="ghost" size="sm"
              onClick={() => setKelompok(prev => prev.map((g, i) =>
                i === gi ? { ...g, siswa: [...g.siswa, { pilihan: null }] } : g))}
            >
              <Plus className="mr-1 h-4 w-4" /> Tambah siswa
            </Button>
          </div>
        ))}

        <Button
          type="button" variant="outline" className="w-full border-dashed"
          onClick={() => setKelompok(prev => [...prev, kelompokKosong()])}
        >
          <Plus className="mr-1 h-4 w-4" /> Tambah level / capaian
        </Button>
      </div>

      {error && <PesanError>{error}</PesanError>}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? 'Menyimpan…' : 'Ajukan ujian tahsin'}
      </Button>
    </form>
  )
}

function PesanError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  )
}
