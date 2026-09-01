import type {
  TahfidzTipe,
  UjianPredikat,
  UjianSiswa,
  UjianStatus,
  UjianTahfidz,
  UjianTahsin,
  UjianUnit,
} from '@/types'

/**
 * Label, format, dan teks laporan untuk modul pengajuan ujian.
 *
 * Semuanya murni perhitungan atas data — tidak menyentuh database — supaya
 * bisa dipakai server component maupun komponen klien tanpa perantara.
 */

export const UJIAN_UNITS: UjianUnit[] = ['SD', 'SMP']

export const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Level tahsin yang bisa dipilih saat mengajukan, per unit.
 *
 * SMP berhenti di Jilid 5: anak SMP yang tuntas jilid melanjutkan ke program
 * tahfidz, bukan ke gharib/tajwid seperti di SD.
 */
export const TAHSIN_LEVELS: Record<UjianUnit, string[]> = {
  SD: ['Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6', "Al-Qur'an", 'Gharib', 'Tajwid'],
  SMP: ['Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5'],
}

export const PREDIKAT_OPTIONS: { value: UjianPredikat; label: string }[] = [
  { value: 'mumtaz',        label: 'Mumtaz'        },
  { value: 'jayyid_jiddan', label: 'Jayyid Jiddan' },
  { value: 'jayyid',        label: 'Jayyid'        },
  { value: 'maqbul',        label: 'Maqbul'        },
  { value: 'mengulang',     label: 'Mengulang'     },
]

export const STATUS_FLOW: UjianStatus[] = ['diajukan', 'dijadwalkan', 'selesai']

// ─── Label ───────────────────────────────────────────────────────────────────

/**
 * Sengaja menyebut "Tasmi'" untuk ketiga tipe, termasuk ujian satu juz.
 *
 * Bukan kelalaian: label ini ikut terbaca wali murid lewat teks WhatsApp dan
 * flyer, dan di sana "Tasmi'" adalah istilah yang sudah dikenal untuk semua
 * ujian tahfidz. "Juz'iyyah" hanya kosakata internal koordinator — hidup di
 * penyaring riwayat lewat [getTahfidzKategori], bukan di teks keluar.
 */
export function getTahfidzLabel(tipe: TahfidzTipe, juz: string): string {
  switch (tipe) {
    case '1_juz': return `Tasmi' Juz ${juz}`
    case '3_juz': return `Tasmi' 3 Juz (${juz})`
    case '5_juz': return `Tasmi' 5 Juz (${juz})`
  }
}

/**
 * Dua agenda yang berbeda, meski keduanya tersimpan sebagai tahfidz.
 *
 * Juz'iyyah adalah ujian satu juz — anak naik juz demi juz. Tasmi' adalah
 * setoran 3 atau 5 juz sekali duduk, acara yang jauh lebih jarang dan disiapkan
 * tersendiri. Koordinator menyebut dan merekapnya terpisah, jadi pembedanya
 * diberi nama sendiri alih-alih dibaca ulang dari `tipe` di tiap pemakaian.
 */
export type TahfidzKategori = 'juziyyah' | 'tasmi'

export const KATEGORI_TAHFIDZ_LABEL: Record<TahfidzKategori, string> = {
  juziyyah: "Juz'iyyah",
  tasmi: "Tasmi'",
}

export function getTahfidzKategori(tipe: TahfidzTipe): TahfidzKategori {
  return tipe === '1_juz' ? 'juziyyah' : 'tasmi'
}

/** Tipe tasmi' saja, untuk penyaring turunan di bawah kategori 'tasmi'. */
export const TASMI_TIPE: { value: Extract<TahfidzTipe, '3_juz' | '5_juz'>; label: string }[] = [
  { value: '3_juz', label: "Tasmi' 3 Juz" },
  { value: '5_juz', label: "Tasmi' 5 Juz" },
]

/**
 * Urutan juz untuk penyaring: 30 lebih dulu, lalu 29, 28, dan seterusnya.
 *
 * Mengikuti arah hafalan anak — mereka mulai dari juz 30 — bukan urutan mushaf.
 * Juz yang bukan angka hanya ada pada data lama, dan didorong ke belakang.
 */
export function urutJuz(a: string, b: string): number {
  const angka = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : null)
  const na = angka(a)
  const nb = angka(b)
  if (na !== null && nb !== null) return nb - na
  if (na !== null) return -1
  if (nb !== null) return 1
  return a.localeCompare(b)
}

export function getStatusLabel(status: UjianStatus): string {
  switch (status) {
    case 'diajukan':    return 'Diajukan'
    case 'dijadwalkan': return 'Dijadwalkan'
    case 'selesai':     return 'Selesai'
  }
}

/** Varian Badge dari design system, bukan warna mentah — supaya ikut tema gelap. */
export function getStatusVariant(status: UjianStatus): 'warning' | 'info' | 'success' {
  switch (status) {
    case 'diajukan':    return 'warning'
    case 'dijadwalkan': return 'info'
    case 'selesai':     return 'success'
  }
}

export function getPredikatLabel(predikat: UjianPredikat | null): string {
  if (!predikat) return '-'
  return PREDIKAT_OPTIONS.find(p => p.value === predikat)?.label ?? predikat
}

/** Kelas warna teks untuk predikat, memakai token tema. */
export function getPredikatClass(predikat: UjianPredikat | null): string {
  switch (predikat) {
    case 'mumtaz':        return 'text-success font-semibold'
    case 'jayyid_jiddan': return 'text-info font-semibold'
    case 'jayyid':        return 'text-info font-semibold'
    case 'maqbul':        return 'text-warning font-semibold'
    case 'mengulang':     return 'text-destructive font-semibold'
    default:              return 'text-muted-foreground'
  }
}

// ─── Level tahsin per siswa ──────────────────────────────────────────────────

type SumberSiswa = Pick<UjianTahsin, 'level' | 'siswa'>

/**
 * Kelompokkan siswa per level, mempertahankan urutan kemunculan.
 *
 * Satu kelompok tahsin kerap menguji beberapa level sekaligus. Siswa pada data
 * lama belum membawa `level` sendiri, jadi ia jatuh kembali ke level pengajuan.
 */
export function groupSiswaByLevel(item: SumberSiswa): { level: string; siswa: UjianSiswa[] }[] {
  const groups: { level: string; siswa: UjianSiswa[] }[] = []
  for (const s of item.siswa) {
    const level = s.level?.trim() || item.level
    let group = groups.find(g => g.level === level)
    if (!group) {
      group = { level, siswa: [] }
      groups.push(group)
    }
    group.siswa.push(s)
  }
  return groups
}

/** Daftar level unik pada satu pengajuan tahsin, urut kemunculan. */
export function getTahsinLevels(item: SumberSiswa): string[] {
  return groupSiswaByLevel(item).map(g => g.level)
}

/** String ringkas level untuk ditampilkan, mis. "Jilid 1, Al-Qur'an". */
export function formatTahsinLevels(item: SumberSiswa): string {
  const levels = getTahsinLevels(item)
  return levels.length > 0 ? levels.join(', ') : item.level
}

// ─── Tanggal ─────────────────────────────────────────────────────────────────
//
// Semuanya dipaksa ke Asia/Jakarta. Tanpa itu, jadwal jam 07.00 WIB terbaca
// sebagai hari sebelumnya di server yang berjalan pada UTC.

export function formatJadwal(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

export function formatJadwalSingkat(date: string | null): string {
  if (!date) return 'Belum dijadwalkan'
  return new Date(date).toLocaleString('id-ID', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

export function formatTanggal(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

export function formatTanggalSingkat(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

/** YYYY-MM-DD menurut WIB — kunci kalender, bukan untuk ditampilkan. */
export function tanggalWIB(date: Date | string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' })
    .format(typeof date === 'string' ? new Date(date) : date)
}

/**
 * Nilai untuk `<input type="datetime-local">` dari timestamp ISO.
 *
 * Harus dihitung dalam WIB, bukan lewat toISOString(): input datetime-local
 * membaca angkanya apa adanya sebagai waktu lokal, sehingga UTC akan tampil
 * mundur tujuh jam dari jadwal yang sebenarnya.
 */
export function toDatetimeLocalWIB(iso: string | null): string {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
  // 'sv-SE' memberi "2026-08-25 14:30"; input butuh "T" sebagai pemisah.
  return parts.replace(' ', 'T')
}

/** Kebalikannya: isi datetime-local (dibaca sebagai WIB) menjadi ISO UTC. */
export function fromDatetimeLocalWIB(value: string): string | null {
  if (!value) return null
  // Offset ditempelkan eksplisit supaya hasilnya tidak bergantung pada zona
  // waktu peramban pengguna — koordinator yang laptopnya masih WITA tetap
  // menyimpan jam yang sama dengan yang ia ketik.
  const iso = new Date(`${value}:00+07:00`)
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString()
}

// ─── Teks laporan ────────────────────────────────────────────────────────────

const WA_FOOTER = `
———————————
Info terkait PPDB TPAIT, SDIT, SMPIT, SMA, QULS LHI :

📱 0823-1115-3344 (Admin PPDB)
🔗 https://ppdb.lhi.sch.id
📍Jl Karanglo, Jogoragan, Banguntapan, Bantul, D.I.Yogyakarta`

const NAMA_UNIT_LENGKAP: Record<UjianUnit, string> = {
  SD: 'SDIT LHI Banguntapan',
  SMP: 'SMPIT LHI Banguntapan',
}

const DOA_PENUTUP = 'ونسأل الله أن يجعل القرآن رببع قلوبنا ونور صدورنا وجلاء أحزاننا وذهاب همومنا وغمومنا. اللهم آمين'
const HARAPAN = 'Semoga Allāh jadikan Ananda semua Ahlul Quran yang hidup sesuai tuntunan Al Quran, dan berakhlak dengan akhlak Al Quran.'

/**
 * Teks pengumuman WhatsApp untuk wali murid.
 *
 * Kalimat lanjutannya berbeda per tipe karena target berikutnya memang
 * berbeda — anak yang baru tasmi' 1 juz diarahkan ke 3-5 juz, yang sudah
 * 5 juz ke 10 juz.
 */
export function generateWAText(item: UjianTahfidz, gender: 'putra' | 'putri'): string {
  const isPutri = gender === 'putri'
  const emoji = isPutri ? '🧕🏻' : '🧒🏻'
  const putraPutri = isPutri ? 'Putri' : 'Putra'
  const siswaSiswi = isPutri ? 'Siswi' : 'Siswa'
  const kelasLine = `${siswaSiswi} Kelas ${item.kelas}${item.is_quls ? ' QULS' : ''} ${NAMA_UNIT_LENGKAP[item.unit]}`

  if (item.tipe === '3_juz') {
    return `[Laporan TASMI' 3 Juz]

Alhamdulillah, dengan rahmat dan taufik-Nya ﷻ, telah menghafal dan melaksanakan Ujian Al Quran

📖 Tasmi' 3 Juz bil ghoib, Ananda:
${emoji}${item.nama_siswa}
${putraPutri} dari Bapak ${item.nama_ayah}
${kelasLine}

Kedepan insyaAllah Ananda akan melanjutkan hafalannya dengan target melaksanakan ujian hafalan 5-10 juz dengan Tasmi' sekali duduk.

${HARAPAN}

${DOA_PENUTUP}
${WA_FOOTER}`
  }

  const judul = item.tipe === '1_juz' ? `[Laporan TASMI' Juz ${item.juz}]` : "[Laporan TASMI' 5 Juz]"
  const lanjutan = item.tipe === '1_juz'
    ? 'Kedepan insyaAllah ananda akan melanjutkan hafalannya dengan target melaksanakan ujian hafalan 3-5 juz sekali duduk.'
    : 'Kedepan insyaAllah ananda akan melanjutkan hafalannya dengan target melaksanakan ujian hafalan 10 Juz sekali duduk.'

  return `${judul}

Alhamdulillah, dengan rahmat dan taufik-Nya ﷻ, telah menghafal dan melaksanakan Ujian Al Quran :

Juz ${item.juz} bil ghoib,  Ananda

${emoji} ${item.nama_siswa}, ${putraPutri} dari Bapak ${item.nama_ayah}
${kelasLine}

${lanjutan}

${HARAPAN}

${DOA_PENUTUP}
${WA_FOOTER}`
}

/** Data poin ringkas untuk pembuat flyer — sengaja tanpa kalimat pengantar. */
export function generateFlyerText(item: UjianTahfidz): string {
  return `👑Laporan ${getTahfidzLabel(item.tipe, item.juz)}

Nama : ${item.nama_siswa}
Nama Ayah: ${item.nama_ayah}
Kelas : ${item.kelas}${item.is_quls ? ' QULS' : ''}
Tanggal ujian : ${formatTanggal(item.jadwal)}
Penguji: ${item.penguji ?? '-'}
Predikat: ${getPredikatLabel(item.predikat)}`
}
