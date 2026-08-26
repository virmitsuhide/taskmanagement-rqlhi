'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, ClipboardList, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmen } from './Segmen'
import { TAHSIN_LEVELS, getTahfidzLabel } from '@/lib/rq/ujian'
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
          ? <FormTahfidz unit={unit} redirectTo={redirectTo} />
          : <FormTahsin unit={unit} redirectTo={redirectTo} />}
      </div>
    </div>
  )
}

// ─── Tahfidz ─────────────────────────────────────────────────────────────────

const JUZ_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1)

function FormTahfidz({ unit, redirectTo }: { unit: UjianUnit; redirectTo: string }) {
  const router = useRouter()
  const [tipe, setTipe] = useState<TahfidzTipe>('1_juz')
  const [juz, setJuz] = useState('1')
  const [namaSiswa, setNamaSiswa] = useState('')
  const [namaAyah, setNamaAyah] = useState('')
  const [kelas, setKelas] = useState('')
  const [isQuls, setIsQuls] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const hasil = await createTahfidzUjianAction({
        tipe,
        juz,
        nama_siswa: namaSiswa,
        nama_ayah: namaAyah,
        kelas,
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
      <div className="space-y-1.5">
        <Label htmlFor="tipe">Tipe ujian</Label>
        <select
          id="tipe"
          value={tipe}
          onChange={e => {
            const nilai = e.target.value as TahfidzTipe
            setTipe(nilai)
            // Rentang juz untuk 3/5 juz tidak bisa ditebak, jadi dikosongkan
            // supaya pengaju mengetiknya sendiri alih-alih mengirim '1'.
            setJuz(nilai === '1_juz' ? '1' : '')
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
          <select id="juz" value={juz} onChange={e => setJuz(e.target.value)} className={SELECT_CLASS}>
            {JUZ_OPTIONS.map(n => <option key={n} value={String(n)}>Juz {n}</option>)}
          </select>
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

      {juz && (
        <p className="rounded-lg bg-info-wash px-3 py-2 text-sm text-info">
          Label: {getTahfidzLabel(tipe, juz)}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="nama_siswa">Nama siswa</Label>
        <Input id="nama_siswa" className="h-9" value={namaSiswa}
          onChange={e => setNamaSiswa(e.target.value)} placeholder="Nama lengkap siswa" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nama_ayah">Nama ayah</Label>
        <Input id="nama_ayah" className="h-9" value={namaAyah}
          onChange={e => setNamaAyah(e.target.value)} placeholder="Nama lengkap ayah" required />
        <p className="text-xs text-muted-foreground">
          Dipakai pada teks pengumuman ke wali murid setelah ujian selesai.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kelas">Kelas</Label>
        <Input id="kelas" className="h-9" value={kelas}
          onChange={e => setKelas(e.target.value)} placeholder="Contoh: 5A, 7B" required />
      </div>

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
            Centang bila siswa ini termasuk program QULS.
          </span>
        </span>
      </label>

      {error && <PesanError>{error}</PesanError>}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? 'Menyimpan…' : 'Ajukan ujian tahfidz'}
      </Button>
    </form>
  )
}

// ─── Tahsin ──────────────────────────────────────────────────────────────────

/** Satu capaian/level beserta daftar siswanya. */
interface KelompokLevel {
  level: string
  siswa: { nama: string }[]
}

function kelompokKosong(): KelompokLevel {
  return { level: '', siswa: [{ nama: '' }] }
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

  function ubahNama(gi: number, si: number, nama: string) {
    setKelompok(prev => prev.map((g, i) =>
      i === gi ? { ...g, siswa: g.siswa.map((s, j) => (j === si ? { nama } : s)) } : g))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Rakit daftar datar — tiap siswa membawa levelnya sendiri, sebab satu
    // kelompok bisa menguji beberapa level dalam satu sesi.
    const siswa: UjianSiswa[] = []
    const levelDipakai: string[] = []
    for (const g of kelompok) {
      const level = g.level.trim()
      const nama = g.siswa.map(s => s.nama.trim()).filter(Boolean)
      if (!level && nama.length === 0) continue
      if (!level) {
        setError('Pilih level untuk setiap capaian.')
        return
      }
      if (nama.length === 0) {
        setError(`Level "${level}" belum punya siswa. Tambahkan minimal satu nama.`)
        return
      }
      if (!levelDipakai.includes(level)) levelDipakai.push(level)
      for (const n of nama) siswa.push({ nama: n, predikat: null, level })
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
                <div key={si} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{si + 1}.</span>
                  <Input
                    aria-label={`Nama siswa ${si + 1}`}
                    className="h-9"
                    placeholder={`Nama siswa ${si + 1}`}
                    value={s.nama}
                    onChange={e => ubahNama(gi, si, e.target.value)}
                  />
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
                i === gi ? { ...g, siswa: [...g.siswa, { nama: '' }] } : g))}
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
