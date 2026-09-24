import { createServerClient } from '@/lib/supabase/server'
import { getPetaHalaman } from '@/lib/data/target-tahfidz'
import { halamanHafalan } from '@/lib/rq/target-tahfidz'
import { getInfoSurat } from '@/lib/data/nama-surat'
import { getJuzTerujiPerSiswa, gabungJuz, juzSetoranPerSiswa, type BarisJuzProgress } from '@/lib/data/hafalan'
import { juzTerjauh, posisiJuz } from '@/lib/rq/hafalan'
import { getRekapAbsensi } from '@/lib/data/absensi'
import { getKalender, tmPerSiswa } from '@/lib/data/kalender-quran'
import { REKAP_KOSONG, type RekapAbsensi } from '@/lib/rq/absensi'
import { persenTM } from '@/lib/rq/kalender-quran'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { formatTanggal, tanggalWIB } from '@/lib/rq/ujian'
import { ttdSrc } from '@/lib/kpi/ttd-berkas'
import type { HalaqohSesi } from '@/lib/data/setoran-sesi'
import { isiAwalIsian, slotIsianGuru, type KodeMedan } from '@/lib/rapor/medan'
import { templateUntuk, urlLatar, type JenisRapor, type RaporTemplate } from '@/lib/data/rapor-template'
import type { Jenjang } from '@/types'

/**
 * Bahan rapor Qur'an satu sesi dalam satu semester (0082).
 *
 * Semuanya DIHITUNG ULANG tiap kali rapor dibuka, tidak pernah disalin ke
 * tabel rapor: yang tersimpan hanya tulisan guru (deskripsi & timpaan).
 * Rapor yang dicetak ulang setelah setoran dibetulkan harus ikut berubah —
 * kalau tidak, ada dua angka resmi untuk anak yang sama.
 *
 * Seluruh anak satu sesi diambil dalam satu rombongan kueri, bukan per anak:
 * satu halaqoh berisi belasan sampai puluhan anak, dan memanggil delapan
 * kueri untuk masing-masing membuat layar daftar rapor menunggu ratusan
 * perjalanan ke basis data.
 */

const ZIYADAH = ['ziyadah', 'hafalan_baru']

async function ambilSemua<T>(buat: (dari: number, ke: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const hasil: T[] = []
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await buat(dari, dari + 999)
    if (error) return hasil
    const potong = (data ?? []) as T[]
    hasil.push(...potong)
    if (potong.length < 1000) return hasil
  }
}

/** Rata-rata satu desimal; null bila tidak ada satu pun nilai. */
function rerata(nums: (number | string | null)[]): number | null {
  const sah = nums.map(Number).filter(n => !Number.isNaN(n))
  if (sah.length === 0) return null
  return Math.round((sah.reduce((a, b) => a + b, 0) / sah.length) * 10) / 10
}

/** 91.5 → "91,5". Rapor ditulis dalam bahasa Indonesia, komanya ikut. */
function angka(n: number | null): string {
  return n === null ? '' : String(n).replace('.', ',')
}

export interface Semester {
  id: string
  year_label: string
  semester: 'ganjil' | 'genap'
  start_date: string
  end_date: string
}

export interface BahanRapor {
  student: { id: string; nama: string; kelas: string | null }
  /** Nilai siap cetak per kode medan — sudah termasuk timpaan guru. */
  nilai: Record<KodeMedan, string>
  /** Yang dihitung sistem, tanpa timpaan — pembanding di layar edit. */
  asli: Record<KodeMedan, string>
  deskripsi: string
  timpaan: Record<string, string>
  /** Isian merah siap cetak (id slot → teks): tulisan guru, atau isi awalnya. */
  isian: Record<string, string>
  /** Isian merah yang benar-benar pernah disimpan guru. */
  isianTersimpan: Record<string, string>
  /**
   * Guru sudah menyelesaikan bagiannya: seluruh isian merah tersimpan dan
   * berisi — atau, untuk template tanpa isian merah, deskripsinya berisi.
   */
  selesai: boolean
  /** Isian merah yang masih kosong di lembar cetak. */
  isianKosong: number
  /** Peserta Riyadhoh — halaman khususnya ikut tercetak (tahap berikutnya). */
  riyadhoh: boolean
  absensi: RekapAbsensi
  /** true = anak ini belum punya satu pun setoran di semester ini. */
  sepi: boolean
  /** Template yang berlaku untuk anak ini; null = belum ada yang cocok. */
  template: RaporTemplate | null
  /** Url bertanda tangan untuk gambar ttd; null = ruang ttd dibiarkan kosong. */
  ttd: { pengampu: string | null; koordinator: string | null }
  /** Url kop surat template ini (path → url); kosong = tanpa kop. */
  latar: Record<string, string | null>
}

interface BarisIsian {
  student_id: string
  deskripsi: string
  timpaan: Record<string, string>
  isian: Record<string, string>
}

/**
 * Tulisan guru untuk satu jenis laporan. Sebelum migrasi 0086 kolom jenis &
 * isian belum ada: rapor semester tetap terbaca dari baris lama, sedangkan
 * ATS belum punya isian apa pun — dan memang belum pernah bisa diisi.
 */
async function ambilIsian(ids: string[], termId: string, jenis: JenisRapor): Promise<BarisIsian[]> {
  const supabase = createServerClient()
  const baru = await supabase.from('rapor_isian')
    .select('student_id, deskripsi, timpaan, isian')
    .in('student_id', ids).eq('term_id', termId).eq('jenis', jenis)
  if (!baru.error) return (baru.data ?? []) as BarisIsian[]
  if (jenis === 'ats') return []
  const lama = await supabase.from('rapor_isian')
    .select('student_id, deskripsi, timpaan').in('student_id', ids).eq('term_id', termId)
  return ((lama.data ?? []) as Omit<BarisIsian, 'isian'>[]).map(r => ({ ...r, isian: {} }))
}

interface Pengampu {
  full_name: string
  nip: string | null
  signature_path: string | null
  gender: 'L' | 'P' | null
}

/** Wali halaqoh; jenis kelaminnya baru ada setelah migrasi 0086. */
async function ambilPengampu(halaqohId: string): Promise<Pengampu | null> {
  const supabase = createServerClient()
  const kueri = (kolom: string) => supabase.from('halaqoh')
    .select(`wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(${kolom})`).eq('id', halaqohId).maybeSingle()
  let res = await kueri('full_name, nip, signature_path, gender')
  if (res.error) res = await kueri('full_name, nip, signature_path')
  const guru = (res.data as unknown as { wali_teacher: Omit<Pengampu, 'gender'> & { gender?: 'L' | 'P' | null } | null } | null)?.wali_teacher
  return guru ? { ...guru, gender: guru.gender ?? null } : null
}

function kosongkan(): Record<KodeMedan, string> {
  return {} as Record<KodeMedan, string>
}

/**
 * Susun bahan rapor seluruh anak satu sesi.
 *
 * Template dipilih PER ANAK dari daftar yang diberikan, bukan per halaqoh:
 * satu sesi bisa berisi kelas 5 dan 6 sekaligus, dan keduanya berhak atas
 * format unitnya masing-masing.
 */
export async function getBahanRaporSesi(
  halaqoh: HalaqohSesi,
  termPenuh: Semester,
  templates: RaporTemplate[],
  jenis: JenisRapor = 'semester',
): Promise<BahanRapor[]> {
  const supabase = createServerClient()

  // ATS dibagikan di tengah semester: kehadiran, nilai, dan TM dihitung
  // sampai hari ini, bukan sampai akhir semester. Tanpa ini "Total
  // Pertemuan" menghitung Sabtu-Sabtu yang belum terjadi, dan anak yang tak
  // pernah absen terlihat hadir 50%.
  const hariIniISO = tanggalWIB(new Date())
  const term: Semester = jenis === 'ats' && hariIniISO < termPenuh.end_date
    ? { ...termPenuh, end_date: hariIniISO < termPenuh.start_date ? termPenuh.start_date : hariIniISO }
    : termPenuh

  const { data: siswaRows } = await supabase
    .from('students')
    .select('id, full_name, nis, kelas, jenjang, program, gender, current_jilid_page, current_quran_halaman,' +
      ' jilid:jilid_levels!students_current_jilid_id_fkey(label, total_pages, is_terminal),' +
      ' metode:tahsin_methods!students_current_method_id_fkey(name)')
    .eq('halaqoh_id', halaqoh.id)
    .eq('is_active', true)
    .order('full_name')

  const siswa = (siswaRows ?? []) as unknown as {
    id: string; full_name: string; nis: string | null; kelas: string | null; jenjang: Jenjang; program: string | null
    gender: 'L' | 'P' | null
    current_jilid_page: number | null; current_quran_halaman: number | null
    jilid: { label: string; total_pages: number | null; is_terminal: boolean } | null
    metode: { name: string } | null
  }[]
  const ids = siswa.map(s => s.id)
  if (ids.length === 0) return []

  type LogTahsin = { student_id: string; nilai_tahsin: number | null; nilai_sikap: number | null }
  type LogTahfidz = { student_id: string; nilai_tahfidz: number | null; nilai_sikap: number | null }
  type Ziyadah = { student_id: string; surat_id: number; ayat_dari: number | null; ayat_ke: number | null; setoran_date: string; created_at: string }

  const [tahsin, tahfidz, ziyadahSemua, progres, juzTeruji, absensi, kalender, peta, surat, isianRes, pengampuRes] =
    await Promise.all([
      ambilSemua<LogTahsin>((a, b) =>
        supabase.from('tahsin_logs').select('student_id, nilai_tahsin, nilai_sikap')
          .in('student_id', ids).gte('setoran_date', term.start_date).lte('setoran_date', term.end_date).range(a, b)),
      ambilSemua<LogTahfidz>((a, b) =>
        supabase.from('tahfidz_logs').select('student_id, nilai_tahfidz, nilai_sikap')
          .in('student_id', ids).gte('setoran_date', term.start_date).lte('setoran_date', term.end_date).range(a, b)),
      // Ziyadah terakhir sepanjang masa — posisi hafalan hari ini, bukan
      // capaian semester: itulah yang ditanyakan wali.
      ambilSemua<Ziyadah>((a, b) =>
        supabase.from('tahfidz_logs').select('student_id, surat_id, ayat_dari, ayat_ke, setoran_date, created_at')
          .in('student_id', ids).in('kind', ZIYADAH)
          .order('setoran_date', { ascending: false }).order('created_at', { ascending: false }).range(a, b)),
      ambilSemua<BarisJuzProgress>((a, b) =>
        supabase.from('juz_progress').select('student_id, juz_number, ayat_hafal, mutqin').in('student_id', ids).range(a, b)),
      getJuzTerujiPerSiswa(ids),
      getRekapAbsensi(ids, term.start_date, term.end_date),
      // TM menurut kalender unit (0084) — bukan banyaknya tanggal yang sempat
      // diabsen, yang membuat pertemuan lupa-absen menghilang dari penyebut.
      getKalender(term.id, [...new Set(siswa.map(x => x.jenjang))], term.start_date, term.end_date),
      getPetaHalaman(),
      getInfoSurat(),
      ambilIsian(ids, term.id, jenis),
      ambilPengampu(halaqoh.id),
    ])

  const pengampu = pengampuRes

  // Url ttd dibuat sekali untuk seluruh sesi: pengampunya satu orang, dan
  // koordinatornya satu per template. Membuatnya per anak berarti puluhan
  // url bertanda tangan untuk gambar yang sama persis.
  const ttdPengampu = await ttdSrc(pengampu?.signature_path)
  const ttdKoordinator = new Map<string, string | null>()
  const latarPer = new Map<string, Record<string, string | null>>()
  for (const tpl of templates) {
    if (tpl.ttd_koordinator_path) ttdKoordinator.set(tpl.id, await ttdSrc(tpl.ttd_koordinator_path))
    latarPer.set(tpl.id, await urlLatar(tpl.blok))
  }
  const isianPer = new Map(isianRes.map(r => [r.student_id, r]))
  // Slot isian per template dihitung sekali, bukan per anak: cariSlot
  // menelusuri seluruh blok templatenya.
  const slotPerTemplate = new Map(templates.map(t => [t.id, slotIsianGuru(t.blok, t.pemetaan)]))
  // TM dihitung per anak: satu halaqoh bisa berisi anak reguler dan anak
  // QULS sekaligus, dan yang QULS punya satu hari sesi lebih banyak.
  const tm = tmPerSiswa(siswa, kalender, term.start_date, term.end_date)
  const setoranTuntas = juzSetoranPerSiswa(progres)
  const namaSurat = (id: number) => surat.get(id)?.name_latin ?? `Surat ${id}`
  const semesterRomawi = term.semester === 'ganjil' ? 'I' : 'II'
  const hariIni = formatTanggal(new Date().toISOString())

  return siswa.map(s => {
    const ts = tahsin.filter(l => l.student_id === s.id)
    const tf = tahfidz.filter(l => l.student_id === s.id)
    const rekap = absensi.per[s.id] ?? { ...REKAP_KOSONG }

    const halBuku = s.jilid?.total_pages && s.current_jilid_page ? s.current_jilid_page : null
    const terakhir = ziyadahSemua.find(z => z.student_id === s.id)
    const juz = gabungJuz(setoranTuntas.get(s.id) ?? 0, (juzTeruji.get(s.id) ?? []).length)
    const sedang = juzTerjauh(progres.filter(p => p.student_id === s.id && p.ayat_hafal > 0).map(p => p.juz_number))
    const totalHalaman = halamanHafalan(peta, juz.total, ziyadahSemua.filter(z => z.student_id === s.id))
    const isian = isianPer.get(s.id)
    const template = templateUntuk(templates, s.jenjang, s.kelas, jenis)

    // Adab digabung dari kedua jenis setoran: itu satu sifat anak, bukan dua.
    const karakter = rerata([...ts.map(l => l.nilai_sikap), ...tf.map(l => l.nilai_sikap)])

    const asli: Record<KodeMedan, string> = {
      ...kosongkan(),
      nama_siswa: s.full_name,
      nis: s.nis ?? '',
      kelas: s.kelas ?? '',
      unit: JENJANG_LABELS[s.jenjang] ?? '',
      halaqoh: halaqoh.name,

      level_tahsin: s.jilid ? `${s.jilid.label}${halBuku ? ` Halaman ${halBuku}` : ''}` : '',
      jilid: s.jilid?.label ?? '',
      halaman_jilid: halBuku ? String(halBuku) : '',
      metode: s.metode?.name ?? '',

      capaian_tahfidz: terakhir && terakhir.ayat_dari !== null
        ? `QS. ${namaSurat(terakhir.surat_id)} ayat ${terakhir.ayat_dari}${terakhir.ayat_ke && terakhir.ayat_ke !== terakhir.ayat_dari ? `–${terakhir.ayat_ke}` : ''}`
        : '',
      juz_tuntas: juz.total > 0 ? `${juz.total} juz` : '',
      juz_berjalan: sedang !== null && (posisiJuz(sedang) ?? 0) > juz.total ? `Juz ${sedang}` : '',
      total_hafalan: totalHalaman > 0 ? `${juz.total} juz ${Math.round(totalHalaman % 20)} halaman` : '',

      nilai_tahsin: angka(rerata(ts.map(l => l.nilai_tahsin))),
      nilai_tahfidz: angka(rerata(tf.map(l => l.nilai_tahfidz))),
      nilai_karakter: angka(karakter),

      hadir: String(rekap.hadir),
      izin: String(rekap.izin),
      sakit: String(rekap.sakit),
      izin_sakit: String(rekap.izin + rekap.sakit),
      alfa: String(rekap.alfa),
      // Penyebut yang benar adalah TM. Bila kalender belum diatur sama sekali
      // dan TM-nya nol, barulah jatuh ke jumlah baris absensi anak ini.
      total_pertemuan: String(tm[s.id] || rekap.total),
      persen_hadir: persenTM(rekap.hadir, tm[s.id] || rekap.total) === null
        ? ''
        : `${persenTM(rekap.hadir, tm[s.id] || rekap.total)}%`,

      nama_pengampu: pengampu?.full_name ?? '',
      nip_pengampu: pengampu?.nip ?? '',
      nama_koordinator: template?.nama_koordinator ?? '',
      nip_koordinator: template?.nip_koordinator ?? '',

      semester: semesterRomawi,
      tahun_ajaran: term.year_label,
      tanggal_terbit: hariIni,
      tempat_terbit: template?.tempat_terbit ?? '',
      // Bentuk gabungan yang lazim di kaki dokumen sekolah. Tanpa tempat
      // terbit ia menyusut jadi tanggal saja — bukan ", 26 Juni 2026".
      tempat_tanggal: template?.tempat_terbit ? `${template.tempat_terbit}, ${hariIni}` : hariIni,

      // Tanpa jenis kelamin tercatat, keduanya ditulis — lebih baik terbaca
      // janggal daripada menyapa ustadzah dengan "ustadz".
      sapaan_pengampu: pengampu?.gender === 'P' ? 'ustadzah' : pengampu?.gender === 'L' ? 'ustadz' : 'ustadz/ustadzah',
      sapaan_siswa: s.gender === 'P' ? 'sholihah' : s.gender === 'L' ? 'sholih' : 'sholih/sholihah',

      deskripsi: isian?.deskripsi ?? '',
      isian_guru: '',
      halaman_riyadhoh: '',
      tetap: '',
      kosongkan: '',
    }

    const timpaan = isian?.timpaan ?? {}
    const nilai = { ...asli }
    for (const [kode, isi] of Object.entries(timpaan)) {
      if (isi !== '' && kode in nilai) nilai[kode as KodeMedan] = isi
    }
    nilai.deskripsi = isian?.deskripsi ?? ''

    const slotIsian = template ? (slotPerTemplate.get(template.id) ?? []) : []
    const isianTersimpan = isian?.isian ?? {}
    const isianCetak = Object.fromEntries(slotIsian.map(sl => [
      sl.id,
      isianTersimpan[sl.id] ?? isiAwalIsian(sl, template?.awal_isian[sl.id], nilai),
    ]))
    const isianKosong = slotIsian.filter(sl => !isianCetak[sl.id]?.trim()).length
    const selesai = slotIsian.length > 0
      ? slotIsian.every(sl => isianTersimpan[sl.id]?.trim())
      : Boolean(isian?.deskripsi?.trim())

    return {
      student: { id: s.id, nama: s.full_name, kelas: s.kelas },
      nilai,
      asli,
      deskripsi: isian?.deskripsi ?? '',
      timpaan,
      isian: isianCetak,
      isianTersimpan,
      selesai,
      isianKosong,
      riyadhoh: false,
      absensi: rekap,
      sepi: ts.length === 0 && tf.length === 0,
      template,
      ttd: {
        pengampu: ttdPengampu,
        koordinator: template ? (ttdKoordinator.get(template.id) ?? null) : null,
      },
      latar: template ? (latarPer.get(template.id) ?? {}) : {},
    }
  })
}
