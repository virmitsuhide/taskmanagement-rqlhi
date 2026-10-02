'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canTeacherAccessStudent, getTeacherHalaqohIds } from '@/lib/data/teacher'
import { isValidPeriod, toPeriodDate } from '@/lib/finance/period'
import { SURAH } from '@/lib/rq/quran'

/** Jenis setoran tahfidz yang menambah hafalan (posisi tahfidz). */
const ZIYADAH = ['ziyadah', 'hafalan_baru']

type Result = { error?: string; success?: boolean }

/**
 * Capaian awal & akhir bulan seorang siswa.
 *
 * Izinnya bukan soal role melainkan penugasan: guru hanya boleh mengisi anak
 * di halaqoh yang diampunya. Dicek lewat canTeacherAccessStudent tiap kali —
 * id siswa datang dari peramban dan karenanya tidak boleh dipercaya.
 */
export async function saveStudentMonthlyAction(_: unknown, formData: FormData): Promise<Result> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid. Silakan masuk ulang.' }

  const studentId = (formData.get('student_id') as string) ?? ''
  const periodKey = (formData.get('period') as string) ?? ''
  if (!studentId) return { error: 'Siswa tidak dikenali.' }
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }

  const boleh = await canTeacherAccessStudent(session.teacherId, studentId)
  if (!boleh) return { error: 'Siswa ini bukan anggota halaqoh Anda.' }

  const halaman = Number((formData.get('capaian_halaman') as string) ?? '0')
  const text = (key: string) => ((formData.get(key) as string) ?? '').trim()

  const supabase = createServerClient()
  const { error } = await supabase.from('student_monthly').upsert(
    {
      student_id: studentId,
      period: toPeriodDate(periodKey),
      level: text('level'),
      halaman_awal_tahsin: text('halaman_awal_tahsin'),
      halaman_akhir_tahsin: text('halaman_akhir_tahsin'),
      tahfidz_awal: text('tahfidz_awal'),
      tahfidz_akhir: text('tahfidz_akhir'),
      capaian_halaman: Number.isFinite(halaman) && halaman > 0 ? Math.round(halaman) : 0,
      catatan: text('catatan'),
      recorded_by: session.teacherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,period' },
  )

  if (error) return { error: error.message || 'Gagal menyimpan capaian.' }

  revalidatePath('/guru/capaian')
  return { success: true }
}

/**
 * Salin capaian akhir bulan lalu jadi capaian awal bulan ini, untuk seluruh
 * anak di satu halaqoh sekaligus.
 *
 * Titik berangkat sebuah bulan hampir selalu sama dengan titik akhir bulan
 * sebelumnya. Tanpa ini guru harus mengetik ulang dua kolom untuk tiap anak
 * di awal bulan — pekerjaan yang paling mungkin ditunda, dan begitu ditunda
 * patokan bulanannya hilang.
 */
export async function carryOverMonthlyAction(halaqohId: string, periodKey: string, previousKey: string): Promise<Result> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!isValidPeriod(periodKey) || !isValidPeriod(previousKey)) return { error: 'Periode tidak valid.' }

  const supabase = createServerClient()

  const { data: halaqoh } = await supabase
    .from('halaqoh').select('id, wali_teacher_id').eq('id', halaqohId).maybeSingle()
  if (!halaqoh) return { error: 'Halaqoh tidak ditemukan.' }
  if (halaqoh.wali_teacher_id !== session.teacherId) {
    return { error: 'Anda bukan wali halaqoh ini.' }
  }

  const { data: studentRows } = await supabase
    .from('students').select('id').eq('halaqoh_id', halaqohId).eq('is_active', true)
  const studentIds = ((studentRows ?? []) as { id: string }[]).map(s => s.id)
  if (studentIds.length === 0) return { error: 'Halaqoh ini belum punya siswa.' }

  const { data: prevRows } = await supabase
    .from('student_monthly')
    .select('student_id, level, halaman_akhir_tahsin, tahfidz_akhir')
    .in('student_id', studentIds)
    .eq('period', toPeriodDate(previousKey))

  const prev = (prevRows ?? []) as {
    student_id: string; level: string; halaman_akhir_tahsin: string; tahfidz_akhir: string
  }[]
  if (prev.length === 0) return { error: 'Bulan sebelumnya belum ada catatan untuk disalin.' }

  // Hanya kolom AWAL yang diisi. Kolom akhir dibiarkan kosong supaya jelas
  // mana yang sudah dinilai bulan ini dan mana yang baru titik berangkatnya.
  const { error } = await supabase.from('student_monthly').upsert(
    prev.map(p => ({
      student_id: p.student_id,
      period: toPeriodDate(periodKey),
      level: p.level,
      halaman_awal_tahsin: p.halaman_akhir_tahsin,
      tahfidz_awal: p.tahfidz_akhir,
      recorded_by: session.teacherId,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'student_id,period', ignoreDuplicates: false },
  )

  if (error) return { error: error.message || 'Gagal menyalin capaian.' }

  revalidatePath('/guru/capaian')
  return { success: true }
}

// ─── Rangkuman bulanan dari setoran harian (0056) ────────────────────────────

/**
 * Menghitung rangkuman bulanan satu halaqoh dari setoran hariannya.
 *
 * Inilah yang membuat model "semi" bekerja. Sebelum ini, guru yang rajin
 * mencatat harian TETAP harus mengetik ulang capaian akhir dan jumlah halaman
 * di akhir bulan — dari ingatan, bukan dari yang sudah ia masukkan. Pekerjaan
 * dua kali untuk satu keterangan, dan itulah sebabnya setoran harian
 * ditinggalkan: 17 baris untuk 694 santri sepanjang satu semester, sementara
 * rangkuman bulanan terisi 1.238 baris.
 *
 * Sekarang mencatat harian menguntungkan yang mencatat — rangkumannya terisi
 * sendiri dari catatan itu.
 *
 * YANG TIDAK DISENTUH: capaian awal dan catatan. Capaian awal milik bulan
 * sebelumnya (lihat carryOverMonthlyAction) dan bukan turunan setoran bulan
 * ini; catatan adalah kalimat guru, yang tidak bisa dihitung dari mana pun.
 */
export async function rangkumBulanAction(
  halaqohId: string,
  periodKey: string,
): Promise<Result & { dirangkum?: number; dilewati?: number }> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }

  const supabase = createServerClient()

  const [{ data: halaqoh }, milik] = await Promise.all([
    supabase.from('halaqoh').select('id').eq('id', halaqohId).maybeSingle(),
    getTeacherHalaqohIds(session.teacherId),
  ])
  if (!halaqoh) return { error: 'Halaqoh tidak ditemukan.' }
  // Wali maupun pengampu pendamping (halaqoh_teachers) — mis. guru tahsin SMA
  // yang bukan wali tetap perlu merangkum capaian tahsin anak-anaknya.
  if (!milik.includes(halaqohId)) {
    return { error: 'Anda tidak mengampu halaqoh ini.' }
  }

  const { data: studentRows } = await supabase
    .from('students')
    .select('id, full_name, jilid:jilid_levels!students_current_jilid_id_fkey(label, is_terminal)')
    .eq('halaqoh_id', halaqohId).eq('is_active', true)
  const siswa = (studentRows ?? []) as unknown as {
    id: string; full_name: string; jilid: { label: string; is_terminal: boolean } | null
  }[]
  const ids = siswa.map(s => s.id)
  if (ids.length === 0) return { error: 'Halaqoh ini belum punya siswa.' }

  // Rentang bulan. Hari terakhirnya dihitung lewat tanggal 0 bulan berikutnya
  // supaya Februari dan tahun kabisat ikut benar.
  const [tahun, bulan] = periodKey.split('-').map(Number)
  const awal = `${periodKey}-01`
  const akhir = `${periodKey}-${String(new Date(tahun, bulan, 0).getDate()).padStart(2, '0')}`

  const [tahsinRes, tahfidzRes, jilidRes, ujianTfRes, ujianTsRes, tahsinLaluRes, ziyadahLaluRes] = await Promise.all([
    supabase.from('tahsin_logs')
      .select('student_id, setoran_date, jilid_id, halaman')
      .in('student_id', ids).gte('setoran_date', awal).lte('setoran_date', akhir)
      .order('setoran_date'),
    supabase.from('tahfidz_logs')
      // '*', bukan daftar kolom: surat_ke_id baru ada setelah 0076, dan
      // menyebutnya langsung membuat kueri ini gagal sebelum migrasi jalan.
      .select('*')
      .in('student_id', ids).gte('setoran_date', awal).lte('setoran_date', akhir)
      .order('setoran_date'),
    supabase.from('jilid_levels').select('id, label'),
    supabase.from('ujian_tahfidz')
      .select('nama_siswa, tipe, juz, predikat, jadwal')
      .gte('jadwal', `${awal}T00:00:00`).lte('jadwal', `${akhir}T23:59:59`),
    supabase.from('ujian_tahsin')
      .select('siswa, level, jadwal')
      .gte('jadwal', `${awal}T00:00:00`).lte('jadwal', `${akhir}T23:59:59`),
    // Posisi SEBELUM bulan ini — cadangan bagi anak yang bulan ini tidak
    // menyetor tahsin/ziyadah (mis. hanya muroja'ah): posisinya tidak
    // berubah, bukan kosong. Terbaru lebih dulu; yang pertama dipakai.
    supabase.from('tahsin_logs')
      .select('student_id, jilid_id, halaman')
      .in('student_id', ids).lt('setoran_date', awal)
      .order('setoran_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('tahfidz_logs')
      .select('student_id, surat_id, ayat_ke')
      .in('student_id', ids).in('kind', ZIYADAH).lt('setoran_date', awal)
      .order('setoran_date', { ascending: false }).order('created_at', { ascending: false }),
  ])

  const jilid = new Map(
    ((jilidRes.data ?? []) as { id: string; label: string }[]).map(j => [j.id, j.label]),
  )

  /*
    Setoran TERAKHIR bulan itu jadi capaian akhir, bukan yang tertinggi.

    Keduanya berbeda saat seorang anak mengulang: ia bisa menyetor jilid 3
    halaman 20, lalu pekan berikutnya kembali ke halaman 12 karena belum lancar.
    Yang benar dilaporkan sebagai capaian akhir bulan adalah posisinya SEKARANG
    — halaman 12 — bukan titik terjauh yang pernah disinggahinya.
  */
  const akhirTahsin = new Map<string, { label: string; halaman: number | null }>()
  const halamanBulan = new Map<string, Set<number>>()
  for (const log of (tahsinRes.data ?? []) as {
    student_id: string; jilid_id: string | null; halaman: number | null
  }[]) {
    const label = log.jilid_id ? jilid.get(log.jilid_id) ?? '' : ''
    akhirTahsin.set(log.student_id, { label, halaman: log.halaman })
    // Halaman DIBEDAKAN, bukan dijumlahkan: satu halaman yang disetor tiga kali
    // karena diulang tetap satu halaman capaian, bukan tiga.
    if (log.halaman != null) {
      const set = halamanBulan.get(log.student_id) ?? new Set<number>()
      set.add(log.halaman)
      halamanBulan.set(log.student_id, set)
    }
  }

  const tahsinLalu = new Map<string, { label: string; halaman: number | null }>()
  for (const log of (tahsinLaluRes.data ?? []) as { student_id: string; jilid_id: string | null; halaman: number | null }[]) {
    if (tahsinLalu.has(log.student_id)) continue
    tahsinLalu.set(log.student_id, { label: log.jilid_id ? jilid.get(log.jilid_id) ?? '' : '', halaman: log.halaman })
  }

  /*
    Posisi tahfidz = setoran ZIYADAH, bukan setoran tahfidz apa pun.
    Muroja'ah mengulang hafalan lama: muroja'ah An-Nas di akhir bulan tidak
    berarti hafalannya kembali ke An-Nas. Dulu semua jenis ikut, sehingga
    capaian akhir & total hafalan bisa menunjuk surat muroja'ah. Muroja'ah
    tetap membuat anak terangkum (ada jejak bulan itu) — lihat adaTahfidz.
  */
  // Surah TERJAUH = nomor terkecil; hafalan berjalan mundur dari juz 30.
  const akhirTahfidz = new Map<string, { surat: number; ayat: number | null }>()
  const terjauh = new Map<string, number>()
  const adaTahfidz = new Set<string>()
  for (const log of (tahfidzRes.data ?? []) as {
    student_id: string; kind: string; surat_id: number; surat_ke_id?: number | null; ayat_ke: number | null
  }[]) {
    adaTahfidz.add(log.student_id)
    if (!ZIYADAH.includes(log.kind)) continue
    const suratAkhir = log.surat_ke_id ?? log.surat_id
    akhirTahfidz.set(log.student_id, { surat: suratAkhir, ayat: log.ayat_ke })
    const kini = terjauh.get(log.student_id)
    const terkecil = Math.min(log.surat_id, suratAkhir)
    if (kini === undefined || terkecil < kini) terjauh.set(log.student_id, terkecil)
  }
  for (const log of (ziyadahLaluRes.data ?? []) as { student_id: string; surat_id: number; ayat_ke: number | null }[]) {
    if (akhirTahfidz.has(log.student_id)) continue
    akhirTahfidz.set(log.student_id, { surat: log.surat_id, ayat: log.ayat_ke })
    if (!terjauh.has(log.student_id)) terjauh.set(log.student_id, log.surat_id)
  }

  // Ujian dicocokkan lewat NAMA, sebab ujian_tahfidz/ujian_tahsin menyimpan nama
  // siswa sebagai teks, bukan id. Pencocokannya karena itu longgar dan hasilnya
  // hanya dipakai sebagai keterangan — tidak pernah sebagai dasar nilai.
  const namaKe = new Map(siswa.map(s => [s.full_name.trim().toLowerCase(), s.id]))
  const ujian = new Map<string, string[]>()
  const catat = (nama: string, teks: string) => {
    const id = namaKe.get((nama ?? '').trim().toLowerCase())
    if (!id) return
    ujian.set(id, [...(ujian.get(id) ?? []), teks])
  }

  for (const u of (ujianTfRes.data ?? []) as {
    nama_siswa: string; tipe: string; juz: string; predikat: string | null
  }[]) {
    catat(
      u.nama_siswa,
      `Tahfidz ${u.tipe.replace(/_/g, ' ')} juz ${u.juz}${u.predikat ? ` — ${u.predikat}` : ''}`,
    )
  }
  for (const u of (ujianTsRes.data ?? []) as {
    siswa: { nama?: string; predikat?: string | null }[]; level: string
  }[]) {
    for (const s of u.siswa ?? []) {
      if (s?.nama) catat(s.nama, `Tahsin ${u.level}${s.predikat ? ` — ${s.predikat}` : ''}`)
    }
  }

  // Hanya anak yang PUNYA jejak bulan itu dirangkum. Menulis baris kosong untuk
  // yang tidak pernah setor akan menyatakan "capaiannya nol" — padahal yang
  // benar adalah "tidak ada catatannya", dan keduanya berbeda arti di rapor.
  const perId = new Map(siswa.map(s => [s.id, s]))
  const baris = ids
    .map(id => {
      const ux = ujian.get(id)
      // Hanya anak dengan jejak BULAN INI: setoran apa pun, atau ujian.
      if (!akhirTahsin.has(id) && !adaTahfidz.has(id) && !ux) return null
      /*
        Tahsin akhir: setoran tahsin terakhir bulan ini. Tanpa setoran tahsin
        bulan ini — anak Lulus Tahsin menulis tahapnya ("Lulus Tahsin"), anak
        lain memakai posisi terakhir sebelum bulan ini. Dulu kolom ini kosong
        dan layar menampilkan "belum" untuk anak yang tahsinnya sudah selesai.
      */
      const kini = perId.get(id)?.jilid
      const ts = akhirTahsin.get(id)
        ?? (kini?.is_terminal ? { label: kini.label, halaman: null } : tahsinLalu.get(id))
      const tf = akhirTahfidz.get(id)

      const surat = terjauh.get(id)
      const info = surat ? SURAH[surat - 1] : undefined
      const akhirSurah = tf ? SURAH[tf.surat - 1] : undefined

      return {
        student_id: id,
        period: toPeriodDate(periodKey),
        level: ts?.label ?? '',
        halaman_akhir_tahsin: ts
          ? `${ts.label}${ts.halaman != null ? ` hal ${ts.halaman}` : ''}`.trim()
          : '',
        tahfidz_akhir: akhirSurah
          ? `${akhirSurah.nama}${tf?.ayat != null ? ` ayat ${tf.ayat}` : ''}`
          : '',
        capaian_halaman: halamanBulan.get(id)?.size ?? 0,
        ujian_tercatat: ux?.join(' · ') ?? '',
        total_hafalan: info ? `Juz ${info.juz} · ${info.nama}` : '',
        dari_setoran: true,
        recorded_by: session.teacherId,
        updated_at: new Date().toISOString(),
      }
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)

  if (baris.length === 0) {
    return { error: 'Belum ada setoran harian di bulan ini untuk dirangkum.' }
  }

  const { error } = await supabase
    .from('student_monthly')
    .upsert(baris, { onConflict: 'student_id,period' })

  if (error) {
    return error.message.includes('ujian_tercatat') || error.message.includes('dari_setoran')
      ? { error: 'Rangkuman bulanan belum aktif: jalankan drizzle/0056_rangkuman_bulanan_dari_setoran_PASTE_TO_SUPABASE.sql di Supabase.' }
      : { error: error.message || 'Gagal merangkum bulan ini.' }
  }

  revalidatePath('/guru/capaian')
  return { success: true, dirangkum: baris.length, dilewati: ids.length - baris.length }
}
