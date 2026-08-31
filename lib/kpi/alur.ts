import type { KpiBandingStatus, KpiRaporStatus, KpiSelesaiSebab } from '@/types'

/**
 * Alur pengesahan rapor KPI: status, tenggat, dan siapa boleh apa.
 *
 * Semuanya murni — tidak menyentuh database — supaya aturan mainnya bisa
 * dibaca (dan diuji) di satu berkas, alih-alih tersebar sebagai perbandingan
 * string di dalam action dan halaman. Penjagaan sesungguhnya tetap ada di
 * server action & trigger database; yang di sini adalah rumusannya.
 *
 *   draft ──ajukan(SDM)──> diajukan ──terbitkan(koor)──> terbit
 *     ^                       │                            │
 *     └──kembalikan(koor)─────┘                ┌───────────┴──────────┐
 *                                         ttd guru                 banding
 *                                              │                       │
 *                                           selesai <──ditolak─────────┤
 *                                              ^                       │
 *                                              └──diterima → draft (versi+1)
 */

// ── Tenggat ───────────────────────────────────────────────────────

/** Masa guru boleh mengajukan banding, sejak rapor terbit. */
export const MASA_BANDING_HARI_KERJA = 7

/**
 * Masa pemutus menjawab banding.
 *
 * Ada bukan sebagai formalitas: tenggat yang hanya mengikat pihak yang lemah
 * bukan tenggat melainkan alat tekan. Guru dibatasi 7 hari kerja untuk
 * menyanggah, jadi yang memutus pun terikat — dan yang lewat muncul sebagai
 * peringatan, bukan diam-diam mengendap.
 */
export const MASA_PUTUSAN_HARI_KERJA = 5

/**
 * Hari yang tidak dihitung sebagai hari kerja: Ahad (0) dan Sabtu (6).
 *
 * Hari libur nasional sengaja TIDAK diperhitungkan. Menghitungnya menuntut
 * daftar tanggal merah yang harus diperbarui tiap tahun, dan daftar yang lupa
 * diperbarui memendekkan masa banding seseorang tanpa ada yang menyadarinya.
 * Kalau tenggatnya jatuh di tengah libur panjang, koordinator bisa
 * menerbitkan rapornya setelah libur — itu keputusan manusia, bukan tabel.
 */
const AKHIR_PEKAN = new Set([0, 6])

/**
 * Tanggal `n` hari kerja setelah `dari`.
 *
 * Hari `dari` sendiri tidak dihitung, jadi rapor yang terbit hari Jumat dengan
 * masa 7 hari kerja berakhir Selasa pekan berikutnya — bukan Jumat itu juga.
 */
export function tambahHariKerja(dari: Date, n: number): Date {
  const d = new Date(dari.getTime())
  let sisa = n
  while (sisa > 0) {
    d.setDate(d.getDate() + 1)
    if (!AKHIR_PEKAN.has(d.getDay())) sisa--
  }
  return d
}

/** yyyy-mm-dd untuk kolom `date` Postgres, memakai waktu setempat. */
export function tanggalSql(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Sudah lewat tenggat?
 *
 * Batasnya inklusif — guru yang mengajukan banding pada hari terakhir masih
 * terhitung tepat waktu. Perbandingannya per tanggal, bukan per detik, sebab
 * kolomnya memang `date`: tenggat yang habis pada pukul 00.00 akan memotong
 * satu hari penuh dari yang dijanjikan.
 */
export function lewatTenggat(batas: string | null, kini = new Date()): boolean {
  if (!batas) return false
  return tanggalSql(kini) > batas
}

/** Sisa hari kalender menuju tenggat. Negatif berarti sudah lewat. */
export function sisaHari(batas: string | null, kini = new Date()): number | null {
  if (!batas) return null
  const b = new Date(`${batas}T23:59:59`)
  return Math.ceil((b.getTime() - kini.getTime()) / 86_400_000)
}

// ── Label ─────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<KpiRaporStatus, string> = {
  draft: 'Draf',
  diajukan: 'Menunggu koordinator',
  dikembalikan: 'Dikembalikan ke SDM',
  terbit: 'Sudah diserahkan',
  banding: 'Dalam banding',
  selesai: 'Selesai',
}

/**
 * Kelas warna lencana status. Memakai token yang sudah ada di globals.css
 * supaya seragam dengan lencana level KPI di halaman lain.
 */
export const STATUS_TONE: Record<KpiRaporStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  diajukan: 'bg-warning-wash text-warning',
  dikembalikan: 'bg-destructive-wash text-destructive',
  terbit: 'bg-primary-wash text-primary',
  banding: 'bg-warning-wash text-warning',
  selesai: 'bg-success-wash text-success',
}

/**
 * Kalimat penutup rapor, dibedakan per sebab.
 *
 * "Final tanpa tanda tangan" sengaja dikatakan apa adanya. Menyebutnya
 * "disetujui" akan mengarang persetujuan dari guru yang tidak pernah membuka
 * rapornya, dan itu justru menutupi hal yang paling perlu dilihat SDM.
 */
export const SEBAB_LABELS: Record<KpiSelesaiSebab, string> = {
  ttd_guru: 'Ditandatangani guru',
  lewat_tenggat: 'Final tanpa tanda tangan (masa banding habis)',
  putusan_final: 'Final melalui putusan banding',
}

export const BANDING_STATUS_LABELS: Record<KpiBandingStatus, string> = {
  diajukan: 'Menunggu putusan',
  diterima: 'Diterima',
  diterima_sebagian: 'Diterima sebagian',
  ditolak: 'Ditolak',
  kedaluwarsa: 'Lewat tenggat putusan',
}

export const BANDING_TONE: Record<KpiBandingStatus, string> = {
  diajukan: 'bg-warning-wash text-warning',
  diterima: 'bg-success-wash text-success',
  diterima_sebagian: 'bg-primary-wash text-primary',
  ditolak: 'bg-destructive-wash text-destructive',
  kedaluwarsa: 'bg-destructive-wash text-destructive',
}

// ── Peralihan yang sah ────────────────────────────────────────────

/** SDM menyerahkan rapor ke koordinator. */
export function bolehDiajukan(status: KpiRaporStatus): boolean {
  return status === 'draft' || status === 'dikembalikan'
}

/** Koordinator menandatangani & memublikasikan, atau mengembalikan ke SDM. */
export function bolehDiterbitkan(status: KpiRaporStatus): boolean {
  return status === 'diajukan'
}

/**
 * Nilai rapor masih boleh disunting SDM?
 *
 * Begitu terbit, tidak — sampai Kepala RQ mereset. Ini pasangan di sisi
 * aplikasi dari trigger kpi_monthly_jaga_terbit di drizzle/0050.
 */
export function bolehDisuntingSdm(status: KpiRaporStatus): boolean {
  return status === 'draft' || status === 'dikembalikan'
}

/** Rapor terkunci — perubahan angkanya butuh reset oleh Kepala RQ. */
export function terkunci(status: KpiRaporStatus): boolean {
  return status === 'terbit' || status === 'banding' || status === 'selesai'
}

/** Guru boleh melihat rapornya sendiri hanya setelah koordinator menerbitkan. */
export function terlihatGuru(status: KpiRaporStatus): boolean {
  return terkunci(status)
}

/**
 * Guru masih boleh membubuhkan tanda tangan?
 *
 * Termasuk saat rapor sudah final: guru yang perkaranya diputus di tingkat
 * akhir tetap boleh menyatakan menerima. Yang tidak boleh adalah menandatangani
 * rapor yang bandingnya masih menggantung — itu dua pernyataan yang saling
 * meniadakan.
 */
export function bolehTtdGuru(status: KpiRaporStatus, sudahTtd: boolean): boolean {
  if (sudahTtd) return false
  return status === 'terbit' || status === 'selesai'
}

/**
 * Guru masih boleh mengajukan banding?
 *
 * Tiga syarat sekaligus: rapornya terbit, belum ditandatangani (tanda tangan
 * berarti menerima), dan tenggatnya belum lewat.
 */
export function bolehBanding(
  status: KpiRaporStatus,
  sudahTtd: boolean,
  batas: string | null,
  kini = new Date(),
): boolean {
  return status === 'terbit' && !sudahTtd && !lewatTenggat(batas, kini)
}

/**
 * Banding tingkat 1 yang ditolak atau diterima sebagian boleh dinaikkan ke
 * Kepala RQ. Yang diterima penuh tidak — tidak ada lagi yang disengketakan.
 */
export function bolehEskalasi(b: {
  tingkat: number
  status: KpiBandingStatus
}): boolean {
  return b.tingkat === 1 && (b.status === 'ditolak' || b.status === 'diterima_sebagian')
}

/**
 * Rapor yang sudah lewat masa bandingnya tanpa tanggapan apa pun.
 *
 * Dipakai untuk mematangkannya menjadi 'selesai' saat halaman dibuka, bukan
 * lewat pekerjaan terjadwal. Alasannya sederhana: proyek ini belum punya
 * penjadwal, dan status yang hanya berubah kalau ada cron yang hidup akan
 * diam-diam salah pada hari cron itu mati.
 */
export function jatuhTempo(r: {
  status: KpiRaporStatus
  guru_ttd_at: string | null
  banding_batas: string | null
}, kini = new Date()): boolean {
  return r.status === 'terbit' && !r.guru_ttd_at && lewatTenggat(r.banding_batas, kini)
}
