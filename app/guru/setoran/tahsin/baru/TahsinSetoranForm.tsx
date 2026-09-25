'use client'

import { useActionState, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTahsinLogAction } from '@/app/actions/setoran'
import { PerbandinganSetoranDialog } from '@/components/setoran/PerbandinganSetoranDialog'
import { useSetoranTimpa } from '@/components/setoran/useSetoranTimpa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StarInput, harusMengulang } from '@/components/setoran/StarInput'
import {
  BacaanQuranInput, BACAAN_KOSONG, type IsianBacaan,
} from '@/components/setoran/BacaanQuranInput'
import { PilihMateri, type PilihanMateri } from '@/components/setoran/PilihMateri'
import type { SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import type { HasilMateri, MateriTahsin } from '@/lib/data/materi-tahsin'
import { methodsForJenjang } from '@/lib/tahsin'
import type { Jenjang } from '@/types'

interface StudentOption {
  id: string
  full_name: string
  jenjang: string
  halaqoh_name: string | null
  current_method_id: string | null
  current_jilid_id: string | null
  current_jilid_page: number | null
  /** Tanggal masuk drill; null = tidak sedang drill. */
  tahsin_drill_sejak: string | null
  /** Posisi bacaan mushaf — progres kedua, berjalan di samping posisi buku. */
  quran: { halaman: number | null; surat_id: number | null; ayat: number | null }
}
interface MethodOption { id: string; name: string }
interface JilidOption {
  id: string; label: string; method_id: string; order_num: number
  /** null untuk tahap tak berbuku — Al-Qur'an, Talaqqi, Lulus Tahsin. */
  total_pages: number | null
  /** Tahap ini ikut mencatat bacaan mushaf (tahap Al-Qur'an + Gharib/Tajwid). */
  baca_quran: boolean
}

interface Props {
  students: StudentOption[]
  methods: MethodOption[]
  jilidLevels: JilidOption[]
  surat: SuratPilihan[]
  /** Materi hafalan per tahap; tahap yang tidak ada di sini disetor per halaman. */
  materiPerJilid: Record<string, MateriTahsin[]>
  /** Keadaan terakhir tiap materi, per siswa. */
  materiHasil: Record<string, Record<string, HasilMateri>>
  defaultStudentId?: string
  /** Urutan anak dari layar Mulai sesi — untuk tombol "Simpan & berikutnya". */
  antrian?: string[]
}

/**
 * Titik berangkat isian bacaan: posisi mushaf anak saat ini, dengan ayat akhir
 * sengaja dikosongkan — itulah satu-satunya angka yang benar-benar baru hari
 * ini, dan mengisinya di muka hanya mengundang guru menekan simpan tanpa
 * membacanya.
 */
function bacaanAwal(s: StudentOption | null): IsianBacaan {
  if (!s) return BACAAN_KOSONG
  return {
    halaman: s.quran.halaman ? String(s.quran.halaman) : '',
    surat_id: s.quran.surat_id ? String(s.quran.surat_id) : '',
    ayat_dari: s.quran.ayat ? String(s.quran.ayat) : '',
    ayat_ke: '',
  }
}

export function TahsinSetoranForm({
  students, methods, jilidLevels, surat, materiPerJilid, materiHasil, defaultStudentId, antrian,
}: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createTahsinLogAction, null)
  const kirim = useSetoranTimpa(formAction, state?.ganda)

  const initialStudent = students.find(s => s.id === defaultStudentId) ?? null
  const [studentId, setStudentId] = useState(defaultStudentId ?? '')
  const [methodId, setMethodId] = useState(initialStudent?.current_method_id ?? '')
  const [status, setStatus] = useState<'lulus' | 'ulang'>('lulus')
  const [jilidId, setJilidId] = useState(initialStudent?.current_jilid_id ?? '')
  const [bacaan, setBacaan] = useState<IsianBacaan>(() => bacaanAwal(initialStudent))
  const [materiDipilih, setMateriDipilih] = useState<PilihanMateri>({})

  const selectedStudent = students.find(s => s.id === studentId) ?? null

  // Metode yang berlaku untuk jenjang siswa terpilih (semua metode bila belum pilih siswa)
  const availableMethods = useMemo(
    () => methodsForJenjang(selectedStudent?.jenjang as Jenjang | undefined, methods),
    [selectedStudent, methods],
  )

  const jilidOptions = useMemo(
    () => jilidLevels.filter(j => j.method_id === methodId).sort((a, b) => a.order_num - b.order_num),
    [jilidLevels, methodId],
  )

  // Saat ganti siswa, sync metode & jilid ke posisi siswa
  function onStudentChange(id: string) {
    setStudentId(id)
    const s = students.find(x => x.id === id)
    if (s?.current_method_id) setMethodId(s.current_method_id)
    setJilidId(s?.current_jilid_id ?? '')
    setHalamanIsi(String(s?.current_jilid_page ?? ''))
    setBacaan(bacaanAwal(s ?? null))
    setMateriDipilih({})
  }

  /**
   * Jilid yang sedang dijalani siswa. Selama terisi, ia tidak bisa diganti
   * dari formulir — hanya kenaikan jilid yang memindahkannya.
   */
  const jilidTerkunci = selectedStudent?.current_jilid_id
    ? jilidLevels.find(j => j.id === selectedStudent.current_jilid_id) ?? null
    : null
  const jilidAktif = jilidTerkunci ?? jilidOptions.find(j => j.id === jilidId) ?? null
  const maksHalaman = jilidAktif?.total_pages ?? null
  const sedangDrill = Boolean(selectedStudent?.tahsin_drill_sejak)
  // Tahap berbasis materi dikenali dari ADA TIDAKNYA daftar materinya, bukan
  // dari penanda tersendiri: penanda bisa menyala sebelum materinya diseed,
  // dan formulir yang meminta materi dari daftar kosong tidak bisa diisi.
  const materiTahap = useMemo(
    () => (jilidAktif ? materiPerJilid[jilidAktif.id] ?? [] : []),
    [jilidAktif, materiPerJilid],
  )
  const hasilTerakhir = useMemo(
    () => (selectedStudent ? materiHasil[selectedStudent.id] ?? {} : {}),
    [selectedStudent, materiHasil],
  )
  // Halaman yang sedang diketik — hanya untuk memberi tahu bahwa setoran ini
  // akan membawa anak masuk drill. Nilai sesungguhnya tetap dikirim lewat form.
  const [halamanIsi, setHalamanIsi] = useState(String(initialStudent?.current_jilid_page ?? ''))

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={kirim.onSubmit} className="space-y-4 max-w-2xl">
      {/* Siswa */}
      <div className="space-y-1.5">
        <Label htmlFor="student_id">Siswa *</Label>
        {initialStudent ? (
          <>
            <input type="hidden" name="student_id" value={initialStudent.id} />
            <div className="rounded-xl border px-4 py-3 bg-card flex items-center justify-between">
              <div>
                <p className="font-semibold">{initialStudent.full_name}</p>
                <p className="text-xs text-muted-foreground">{initialStudent.halaqoh_name ?? '—'}</p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/guru/setoran/tahsin/baru')}
                className="text-xs text-muted-foreground hover:underline"
              >
                Ganti
              </button>
            </div>
          </>
        ) : (
          <Select name="student_id" value={studentId} onValueChange={onStudentChange} required>
            <SelectTrigger id="student_id" className="w-full min-w-0"><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
            <SelectContent>
              {students.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}{s.halaqoh_name ? ` · ${s.halaqoh_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Materi */}
      <fieldset className="min-w-0 rounded-2xl border bg-card p-4 md:p-5 [&>legend]:float-left [&>legend]:w-full [&>legend+*]:clear-both space-y-3">
        <legend className="font-heading text-lg font-medium mb-3">Materi Setoran</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="method_id">Metode *</Label>
            <Select name="method_id" value={methodId} onValueChange={setMethodId} required>
              <SelectTrigger id="method_id" className="w-full min-w-0"><SelectValue placeholder="Metode" /></SelectTrigger>
              <SelectContent>
                {availableMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jilid_id">Jilid *</Label>
            {/*
              JILID TERKUNCI PADA POSISI SISWA.

              Anak berjalan di satu jilid sampai ia naik, dan kenaikan itu
              punya pintunya sendiri — kelulusan ujian tahsin, yang mencatat
              jilid_promotions dan memindahkan posisinya. Membiarkan
              jilid bebas dipilih tiap setoran membuat dua hal bisa terjadi
              tanpa jejak: setoran tercatat di jilid yang belum ditempuh, dan
              anak "naik" tanpa satu pun baris kenaikan — sehingga riwayatnya
              tidak pernah menyebutkan kapan ia lulus.
            */}
            {jilidTerkunci ? (
              <>
                <input type="hidden" name="jilid_id" value={jilidTerkunci.id} />
                <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                  {jilidTerkunci.label}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Terkunci — terbuka ke jilid berikutnya setelah lulus ujian tahsin.
                </p>
              </>
            ) : (
              <>
                <Select name="jilid_id" value={jilidId} onValueChange={setJilidId} disabled={!methodId} required>
                  <SelectTrigger id="jilid_id" className="w-full min-w-0"><SelectValue placeholder="Jilid" /></SelectTrigger>
                  <SelectContent>
                    {jilidOptions.map(j => <SelectItem key={j.id} value={j.id}>{j.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Jilid awal — setelah setoran pertama, pilihan ini terkunci.
                </p>
              </>
            )}
          </div>
          {maksHalaman !== null && materiTahap.length === 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="halaman">Hal. {jilidAktif?.label}</Label>
            {/* Batas atasnya panjang jilid itu sendiri. Dipasang sebagai `max`
                agar peramban menolaknya lebih dulu, dan diperiksa ulang di
                server action — atribut max hanya menghentikan formulir. */}
            <Input
              key={studentId}
              id="halaman" name="halaman" type="number" min={1}
              max={maksHalaman ?? undefined}
              defaultValue={selectedStudent?.current_jilid_page ?? ''}
              onChange={e => setHalamanIsi(e.target.value)}
              disabled={isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              {jilidAktif?.label} berisi {maksHalaman} halaman.
            </p>
          </div>
          )}
        </div>

        {/*
          HAFALAN GHARIB / TAJWID — DAFTAR PERIKSA, BUKAN NOMOR HALAMAN.

          Satu halaman buku ini memuat beberapa materi dan bisa memakan sampai
          empat pertemuan, jadi kolom halaman akan mengulang angka yang sama
          tanpa ada yang bisa membedakannya. Halamannya tetap tersimpan, tapi
          diturunkan dari materi di server.
        */}
        {materiTahap.length > 0 && (
          <fieldset className="min-w-0 rounded-2xl border bg-card p-4 md:p-5 [&>legend]:float-left [&>legend]:w-full [&>legend+*]:clear-both">
            <legend className="font-heading text-lg font-medium mb-3">Hafalan {jilidAktif?.label}</legend>
            {Object.entries(materiDipilih).map(([id, hasil]) => (
              <input key={id} type="hidden" name={`materi_${hasil}`} value={id} />
            ))}
            <PilihMateri
              materi={materiTahap}
              hasilTerakhir={hasilTerakhir}
              value={materiDipilih}
              onChange={setMateriDipilih}
              disabled={isPending}
            />
          </fieldset>
        )}

        {/*
          PROGRES KEDUA — BACAAN MUSHAF.

          Muncul di tahap Al-Qur'an (di sana ia satu-satunya progres) dan di
          Gharib/Tajwid UMMI, yang bukunya DIHAFAL sementara mushafnya tetap
          DIBACA. Di dua tahap terakhir itu kartu ini berdiri berdampingan
          dengan halaman buku di atas: dua kemajuan, satu setoran.
        */}
        {jilidAktif?.baca_quran && (
          <div className="rounded-lg border p-3" style={{ background: 'var(--primary-wash)' }}>
            <p className="mb-2 text-sm font-semibold">
              Bacaan Al-Qur&rsquo;an
              {maksHalaman !== null && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  — berjalan bersama hafalan {jilidAktif.label}
                </span>
              )}
            </p>
            {/* Nilainya dikirim lewat kolom tersembunyi: isiannya dikendalikan
                state supaya halaman dan surat/ayat bisa saling mengisi. */}
            <input type="hidden" name="quran_halaman" value={bacaan.halaman} />
            <input type="hidden" name="quran_surat_id" value={bacaan.surat_id} />
            <input type="hidden" name="quran_ayat_dari" value={bacaan.ayat_dari} />
            <input type="hidden" name="quran_ayat_ke" value={bacaan.ayat_ke} />
            <BacaanQuranInput
              value={bacaan}
              onChange={setBacaan}
              surat={surat}
              disabled={isPending}
            />
          </div>
        )}

        {sedangDrill && (
          <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: 'var(--warning-wash)', borderColor: 'var(--warning)', color: 'var(--warning)' }}>
            <p className="font-semibold">Sedang DRILL {jilidAktif?.label ?? ''}</p>
            <p className="mt-0.5">
              Sudah lulus halaman terakhir{selectedStudent?.tahsin_drill_sejak ? ` sejak ${selectedStudent.tahsin_drill_sejak}` : ''}.
              Setoran ini dicatat sebagai latihan drill — halaman boleh mana saja di jilid ini, dan posisi
              tidak bergerak. Jilid berikutnya terbuka setelah anak lulus ujian tahsin.
            </p>
          </div>
        )}
      </fieldset>

      {/* Penilaian */}
      <fieldset className="min-w-0 rounded-2xl border bg-card p-4 md:p-5 [&>legend]:float-left [&>legend]:w-full [&>legend+*]:clear-both">
        <legend className="font-heading text-lg font-medium mb-3">Penilaian</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">Nilai Tahsin</p>
            {/* Di bawah 3 bintang otomatis menandai setoran ini mengulang —
                itu aturan RQ, jadi guru tidak perlu mengingatnya sendiri lalu
                menekan tombol status yang kedua kalinya. */}
            <StarInput
              name="nilai_tahsin"
              onChange={b => { if (b > 0) setStatus(harusMengulang(b) ? 'ulang' : 'lulus') }}
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">Nilai Sikap</p>
            <StarInput name="nilai_sikap" />
          </div>
        </div>
      </fieldset>

      {/*
        Status setoran hanya ditanyakan di tahap yang disetor per halaman.
        Di Gharib/Tajwid tiap materi sudah punya hasilnya sendiri, dan
        pertanyaan kedua di tingkat setoran cuma melahirkan jawaban yang
        bisa bertentangan dengannya — server menurunkannya dari materi.
      */}
      {materiTahap.length === 0 && (
      <fieldset className="min-w-0 rounded-2xl border bg-card p-4 md:p-5 [&>legend]:float-left [&>legend]:w-full [&>legend+*]:clear-both">
        <legend className="font-heading text-lg font-medium mb-3">Status Halaman</legend>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => setStatus('lulus')}
            className="rounded-xl border-2 p-4 text-left transition-colors"
            style={status === 'lulus'
              ? { borderColor: 'var(--success)', background: 'var(--success-wash)' }
              : { borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <p className="font-heading text-lg font-medium">Lulus</p>
            <p className="text-xs text-muted-foreground">Lanjut halaman berikutnya</p>
          </button>
          <button
            type="button"
            onClick={() => setStatus('ulang')}
            className="rounded-xl border-2 p-4 text-left transition-colors"
            style={status === 'ulang'
              ? { borderColor: 'var(--warning)', background: 'var(--warning-wash)' }
              : { borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <p className="font-heading text-lg font-medium">Ulang</p>
            <p className="text-xs text-muted-foreground">Belum tuntas, mengulang</p>
          </button>
        </div>
        {/* Sesudah tombol, bukan sesudah legend: `legend+*` harus kotak yang terlihat supaya clear-both mengena. */}
        <input type="hidden" name="status" value={status} />
      </fieldset>
      )}

      {/* Catatan + tanggal */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 rounded-2xl border bg-card p-4 md:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="catatan">Catatan Guru</Label>
          <Textarea id="catatan" name="catatan" rows={2} placeholder="contoh: perhatikan madd, latih sukun..." disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setoran_date">Tanggal Setor</Label>
          <Input id="setoran_date" name="setoran_date" type="date" defaultValue={today} disabled={isPending} />
        </div>
      </div>

      {/* Pemberitahuan masuk drill — naik jilid tidak lagi dari setoran. */}
      {!sedangDrill && materiTahap.length === 0 && status === 'lulus' && maksHalaman !== null && Number(halamanIsi) >= maksHalaman && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ background: 'var(--primary-wash)', borderColor: 'var(--border)' }}>
          Ini halaman terakhir {jilidAktif?.label}. Setelah disimpan, anak masuk <strong>DRILL</strong> sampai
          lulus ujian tahsin — ajukan ujiannya lewat menu Pengajuan Ujian.
        </p>
      )}

      <PerbandinganSetoranDialog
        daftar={kirim.daftarGanda}
        pending={isPending}
        onTimpa={kirim.timpa}
        onBatal={kirim.batal}
      />

      {state?.error && (
        <p className="text-sm font-medium text-destructive bg-destructive-wash px-4 py-3 rounded-xl">{state.error}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" size="lg" className="min-w-40" disabled={isPending || !studentId}>
          {isPending ? 'Menyimpan...' : 'Simpan Setoran'}
        </Button>
        <TombolLanjut students={students} studentId={studentId} antrian={antrian} jenis="tahsin" disabled={isPending} />
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Batal
        </Button>
      </div>
    </form>
  )
}

function TombolLanjut({ students, studentId, antrian, jenis, disabled }: {
  students: { id: string; full_name: string }[]
  studentId: string
  antrian?: string[]
  jenis: 'tahsin' | 'tahfidz'
  disabled: boolean
}) {
  // Urutan: antrian dari layar Mulai sesi bila ada, selain itu urutan daftar siswa.
  const ada = new Set(students.map(s => s.id))
  const urut = antrian && antrian.length > 0 ? antrian.filter(id => ada.has(id)) : students.map(s => s.id)
  const i = urut.indexOf(studentId)
  const berikut = i >= 0 ? urut[i + 1] : urut.find(id => id !== studentId)
  if (!studentId || !berikut) return null
  const nama = students.find(s => s.id === berikut)?.full_name.split(' ')[0] ?? ''
  const antrianQs = antrian && antrian.length > 0 ? `&antrian=${antrian.join(',')}` : ''
  return (
    <Button type="submit" name="lanjut" value={`/guru/setoran/${jenis}/baru?student=${berikut}${antrianQs}`}
      variant="outline" size="lg" disabled={disabled}>
      Simpan &amp; berikutnya{nama ? ` · ${nama}` : ''}
    </Button>
  )
}
