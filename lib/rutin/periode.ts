import type { RoutineCadence } from '@/types'

/**
 * Periode untuk checklist tugas rutin.
 *
 * Modul murni: tidak menyentuh database, tidak membaca sesi. Ia menjawab satu
 * pertanyaan — "pekan/bulan mana yang sedang berjalan, dan apa kuncinya?" —
 * dan seluruh fitur Tugas Rutin bersandar pada jawaban itu.
 *
 * KENAPA WAKTUNYA DIPAKU KE WIB, BUKAN KE JAM SERVER
 *
 * Pergantian periode adalah peristiwa yang terlihat: seluruh checklist
 * berpindah ke pekan baru. Kalau periodenya dihitung dari jam server, di
 * Vercel yang berjalan UTC pergantian itu terjadi pukul 07.00 WIB Senin —
 * pengurus yang membuka aplikasi Senin pagi masih melihat centang pekan lalu.
 * Karena itu tanggalnya diambil eksplisit di zona Asia/Jakarta, bukan dari
 * zona waktu mesin yang kebetulan menjalankan kodenya.
 */

const ZONA = 'Asia/Jakarta'

// en-CA memberi 'YYYY-MM-DD' — satu-satunya locale bawaan yang formatnya
// memang sudah berurut tahun-bulan-hari, jadi tidak perlu dirakit ulang.
const FORMAT_TANGGAL = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Tanggal hari ini menurut kalender WIB, 'YYYY-MM-DD'. */
export function hariIni(): string {
  return FORMAT_TANGGAL.format(new Date())
}

/**
 * 'YYYY-MM-DD' → Date pada tengah hari lokal.
 *
 * Tengah hari, bukan tengah malam: aritmetika tanggal di bawah menambah dan
 * mengurangi hari, dan pergeseran DST sebesar satu jam pada tengah malam bisa
 * melempar hasilnya ke tanggal sebelahnya.
 */
function urai(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function format(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function tambahHari(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Indeks hari dengan Senin = 0 — pekan di sini dimulai Senin, bukan Ahad. */
const indeksHari = (d: Date) => (d.getDay() + 6) % 7

/**
 * Nomor pekan ISO-8601 beserta tahun pekannya.
 *
 * Tahun pekan tidak selalu sama dengan tahun tanggalnya: 1 Januari bisa jatuh
 * di pekan terakhir tahun sebelumnya, dan 31 Desember bisa jatuh di pekan
 * pertama tahun berikutnya. Patokannya hari Kamis pada pekan yang sama —
 * itulah definisi ISO, dan itu pula yang membuat kuncinya tidak pernah
 * bertabrakan di pergantian tahun.
 */
function pekanIso(d: Date): { tahun: number; pekan: number } {
  const kamis = tambahHari(d, 3 - indeksHari(d))
  const tahun = kamis.getFullYear()
  const empatJan = new Date(tahun, 0, 4, 12)
  const seninPekanSatu = tambahHari(empatJan, -indeksHari(empatJan))
  const pekan = 1 + Math.round((kamis.getTime() - seninPekanSatu.getTime()) / 604_800_000)
  return { tahun, pekan }
}

/**
 * Bulan (0-indeks) tempat tahun ajaran dimulai — Juli.
 *
 * KENAPA TAHUN AJARAN, BUKAN TAHUN KALENDER
 *
 * Tugas rutin semesteran dan tahunan lahir dari kalender kerja RQ: "sebar
 * angket wali murid tiap awal semester", "susun rapor akhir tahun". Kalau
 * periodenya dipatok ke tahun kalender, satu semester ajaran akan terbelah
 * dua — pekerjaan yang dilakukan Desember dan Januari jatuh di periode yang
 * berbeda padahal semesternya sama.
 *
 * KENAPA TIDAK DIBACA DARI academic_terms
 *
 * Tabel itu memang memuat tanggal semester yang sesungguhnya, dan memakainya
 * akan lebih tepat satu-dua pekan di tiap pergantian. Tapi modul ini murni
 * dan dipanggil juga dari komponen klien (label kelompok di checklist);
 * menjadikannya async dan bergantung database berarti seluruh halaman
 * checklist ikut menunggu satu query hanya untuk menulis judul — dan gagal
 * total saat barisnya belum diisi. Aturan kalender di bawah tidak pernah
 * gagal, dan selisih beberapa hari di pergantian semester tidak mengubah
 * tugas mana yang perlu dikerjakan.
 */
const AWAL_TAHUN_AJARAN = 6

/** Tahun ajaran yang memuat tanggal ini — 2026 berarti 2026/2027. */
function tahunAjaran(d: Date): number {
  return d.getMonth() >= AWAL_TAHUN_AJARAN ? d.getFullYear() : d.getFullYear() - 1
}

/** 1 = ganjil (Juli–Desember), 2 = genap (Januari–Juni). */
function nomorSemester(d: Date): 1 | 2 {
  return d.getMonth() >= AWAL_TAHUN_AJARAN ? 1 : 2
}

/** '2026/2027' — label tahun ajaran yang memuat tanggal ini. */
export function labelTahunAjaran(iso: string = hariIni()): string {
  const t = tahunAjaran(urai(iso))
  return `${t}/${t + 1}`
}

/**
 * Kunci periode yang disimpan di routine_task_checks.period.
 *
 * '2026-W36' pekanan, '2026-08' bulanan, '2026-S1' semester ganjil TA
 * 2026/2027, '2026-TA' satu tahun ajaran penuh. Keempatnya terurut benar
 * secara leksikografis, jadi "periode terakhir" cukup ORDER BY period DESC.
 *
 * Bentuknya sengaja dibuat tidak mungkin bertabrakan satu sama lain: keempat
 * irama berbagi satu kolom, dan kunci yang sama untuk dua irama berbeda akan
 * membuat laporan pekanan terbaca sebagai laporan bulanan.
 */
export function kunciPeriode(cadence: RoutineCadence, iso: string = hariIni()): string {
  const d = urai(iso)
  if (cadence === 'bulanan') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  if (cadence === 'semesteran') {
    return `${tahunAjaran(d)}-S${nomorSemester(d)}`
  }
  if (cadence === 'tahunan') {
    return `${tahunAjaran(d)}-TA`
  }
  const { tahun, pekan } = pekanIso(d)
  return `${tahun}-W${String(pekan).padStart(2, '0')}`
}

/** Tanggal awal & akhir periode yang memuat `iso`. */
export function rentangPeriode(
  cadence: RoutineCadence,
  iso: string = hariIni(),
): { mulai: string; selesai: string } {
  const d = urai(iso)
  if (cadence === 'bulanan') {
    return {
      mulai: format(new Date(d.getFullYear(), d.getMonth(), 1, 12)),
      selesai: format(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)),
    }
  }
  if (cadence === 'semesteran') {
    const ta = tahunAjaran(d)
    return nomorSemester(d) === 1
      ? { mulai: `${ta}-07-01`, selesai: `${ta}-12-31` }
      : { mulai: `${ta + 1}-01-01`, selesai: `${ta + 1}-06-30` }
  }
  if (cadence === 'tahunan') {
    const ta = tahunAjaran(d)
    return { mulai: `${ta}-07-01`, selesai: `${ta + 1}-06-30` }
  }
  const senin = tambahHari(d, -indeksHari(d))
  return { mulai: format(senin), selesai: format(tambahHari(senin, 6)) }
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const BULAN_SINGKAT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

/**
 * Label periode berjalan untuk judul kelompok.
 *
 * Pekanan diberi rentang tanggalnya, bukan nomor pekan ISO. Nomor pekan itu
 * kunci penyimpanan yang rapi, tapi hampir tidak ada orang yang tahu sedang
 * berada di pekan ke-36 — sementara "31 Agu – 6 Sep" langsung dikenali.
 */
export function labelPeriode(cadence: RoutineCadence, iso: string = hariIni()): string {
  const { mulai, selesai } = rentangPeriode(cadence, iso)
  if (cadence === 'bulanan') {
    const d = urai(mulai)
    return `${BULAN[d.getMonth()]} ${d.getFullYear()}`
  }
  if (cadence === 'semesteran') {
    const ganjil = nomorSemester(urai(iso)) === 1
    return `Semester ${ganjil ? 'Ganjil' : 'Genap'} ${labelTahunAjaran(iso)}`
  }
  if (cadence === 'tahunan') {
    return `Tahun Ajaran ${labelTahunAjaran(iso)}`
  }
  const a = urai(mulai)
  const b = urai(selesai)
  const kiri = a.getMonth() === b.getMonth()
    ? String(a.getDate())
    : `${a.getDate()} ${BULAN_SINGKAT[a.getMonth()]}`
  return `${kiri} – ${b.getDate()} ${BULAN_SINGKAT[b.getMonth()]} ${b.getFullYear()}`
}

export const CADENCE_LABELS: Record<RoutineCadence, string> = {
  pekanan: 'Pekanan',
  bulanan: 'Bulanan',
  semesteran: 'Semesteran',
  tahunan: 'Tahunan',
}

/** Judul kelompok di halaman checklist, mis. "Pekan ini". */
export const CADENCE_PERIOD_LABELS: Record<RoutineCadence, string> = {
  pekanan: 'Pekan ini',
  bulanan: 'Bulan ini',
  semesteran: 'Semester ini',
  tahunan: 'Tahun ajaran ini',
}

/** Kapan periodenya berganti — dipakai form tambah & catatan kaki checklist. */
export const CADENCE_RESET_LABELS: Record<RoutineCadence, string> = {
  pekanan: 'Dilaporkan ulang tiap Senin',
  bulanan: 'Dilaporkan ulang tiap tanggal 1',
  semesteran: 'Dilaporkan ulang tiap awal semester (Juli & Januari)',
  tahunan: 'Dilaporkan ulang tiap awal tahun ajaran (Juli)',
}

/**
 * Urutannya dari yang paling sering ke yang paling jarang — sama dengan
 * urutan tampil kelompoknya di checklist dan di papan kepala RQ. Tugas
 * pekanan yang dibuka tiap hari layak berada di atas tugas tahunan yang
 * disentuh sekali setahun.
 */
export const CADENCES: RoutineCadence[] = ['pekanan', 'bulanan', 'semesteran', 'tahunan']

export function isCadence(v: unknown): v is RoutineCadence {
  return typeof v === 'string' && (CADENCES as string[]).includes(v)
}
