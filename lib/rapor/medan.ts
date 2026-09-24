import type { Blok } from '@/lib/rapor/docx'

/**
 * Medan rapor — daftar data yang bisa ditempelkan ke sebuah template, dan
 * penebakan otomatis dari template yang diunggah koordinator.
 *
 * Koordinator mengunggah berkas Word yang SUDAH ADA, lengkap dengan contoh
 * isinya ("Aliyah Putri", "91,52"). Sistem menebak dari LABEL barisnya, bukan
 * dari contoh nilainya, lalu menyerahkan tebakan itu ke layar pemetaan untuk
 * dibenarkan. Tebakan yang salah karena itu murah: ia kelihatan sebelum satu
 * rapor pun dicetak.
 */

export const KODE_MEDAN = [
  // Siswa
  'nama_siswa', 'nis', 'kelas', 'unit', 'halaqoh',
  // Tahsin
  'level_tahsin', 'jilid', 'halaman_jilid', 'metode',
  // Tahfidz
  'capaian_tahfidz', 'juz_tuntas', 'juz_berjalan', 'total_hafalan',
  // Nilai
  'nilai_tahsin', 'nilai_tahfidz', 'nilai_karakter',
  // Kehadiran
  'hadir', 'izin', 'sakit', 'izin_sakit', 'alfa', 'total_pertemuan', 'persen_hadir',
  // Guru & pengesahan
  'nama_pengampu', 'nip_pengampu', 'nama_koordinator', 'nip_koordinator',
  // Ruang tanda tangan — gambar, bukan teks
  'ttd_pengampu', 'ttd_koordinator', 'ttd_keduanya',
  // Periode
  'semester', 'tahun_ajaran', 'tanggal_terbit', 'tempat_terbit', 'tempat_tanggal',
  // Sapaan yang bergantung jenis kelamin
  'sapaan_pengampu', 'sapaan_siswa',
  // Diisi guru di layar edit
  'deskripsi', 'isian_guru',
  // Halaman yang hanya dicetak untuk sebagian siswa
  'halaman_riyadhoh',
  // Perlakuan khusus
  'tetap', 'kosongkan',
] as const

export type KodeMedan = (typeof KODE_MEDAN)[number]

export interface InfoMedan {
  kode: KodeMedan
  label: string
  grup: string
  /** Contoh isi — ditampilkan di layar pemetaan supaya pilihannya terbayang. */
  contoh: string
}

export const MEDAN: InfoMedan[] = [
  { kode: 'nama_siswa', label: 'Nama siswa', grup: 'Siswa', contoh: 'Aliyah Putri' },
  { kode: 'nis', label: 'NIS', grup: 'Siswa', contoh: '2314' },
  { kode: 'kelas', label: 'Kelas', grup: 'Siswa', contoh: '2A' },
  { kode: 'unit', label: 'Unit', grup: 'Siswa', contoh: 'SDIT LHI' },
  { kode: 'halaqoh', label: 'Nama halaqoh/sesi', grup: 'Siswa', contoh: 'Sesi 2 — Ust. Amru' },

  { kode: 'level_tahsin', label: 'Level tahsin (jilid + halaman)', grup: 'Tahsin', contoh: 'Jilid 6 Halaman 35' },
  { kode: 'jilid', label: 'Jilid saja', grup: 'Tahsin', contoh: 'Jilid 6' },
  { kode: 'halaman_jilid', label: 'Halaman jilid saja', grup: 'Tahsin', contoh: '35' },
  { kode: 'metode', label: 'Metode tahsin', grup: 'Tahsin', contoh: 'UMMI' },

  { kode: 'capaian_tahfidz', label: 'Capaian tahfidz terakhir', grup: 'Tahfidz', contoh: 'QS. Al-Ghasyiyah ayat 3' },
  { kode: 'juz_tuntas', label: 'Jumlah juz tuntas (teruji)', grup: 'Tahfidz', contoh: '2 juz' },
  { kode: 'juz_berjalan', label: 'Juz yang sedang dihafal', grup: 'Tahfidz', contoh: 'Juz 29' },
  { kode: 'total_hafalan', label: 'Total hafalan', grup: 'Tahfidz', contoh: '2 juz 7 halaman' },

  { kode: 'nilai_tahsin', label: 'Rata-rata nilai tahsin', grup: 'Nilai', contoh: '91,5' },
  { kode: 'nilai_tahfidz', label: 'Rata-rata nilai tahfidz', grup: 'Nilai', contoh: '90,8' },
  { kode: 'nilai_karakter', label: 'Rata-rata adab (tahsin + tahfidz)', grup: 'Nilai', contoh: '90,6' },

  { kode: 'hadir', label: 'Jumlah hadir', grup: 'Kehadiran', contoh: '38' },
  { kode: 'izin', label: 'Jumlah izin', grup: 'Kehadiran', contoh: '2' },
  { kode: 'sakit', label: 'Jumlah sakit', grup: 'Kehadiran', contoh: '1' },
  { kode: 'izin_sakit', label: 'Izin + sakit digabung', grup: 'Kehadiran', contoh: '3' },
  { kode: 'alfa', label: 'Jumlah alfa', grup: 'Kehadiran', contoh: '1' },
  { kode: 'total_pertemuan', label: 'Total pertemuan sesi', grup: 'Kehadiran', contoh: '42' },
  { kode: 'persen_hadir', label: 'Persentase kehadiran', grup: 'Kehadiran', contoh: '90%' },

  { kode: 'nama_pengampu', label: 'Nama guru pengampu', grup: 'Guru & pengesahan', contoh: 'Sella Andriani, S.Pi' },
  { kode: 'nip_pengampu', label: 'NIY/NIP pengampu', grup: 'Guru & pengesahan', contoh: 'NIY.20001011.308' },
  { kode: 'nama_koordinator', label: 'Nama koordinator', grup: 'Guru & pengesahan', contoh: 'Erna, S.Pd' },
  { kode: 'nip_koordinator', label: 'NIY/NIP koordinator', grup: 'Guru & pengesahan', contoh: 'NIY.20001011.308' },

  { kode: 'ttd_pengampu', label: 'Tanda tangan pengampu', grup: 'Tanda tangan', contoh: '(gambar ttd guru)' },
  { kode: 'ttd_koordinator', label: 'Tanda tangan koordinator', grup: 'Tanda tangan', contoh: '(gambar ttd koordinator)' },
  { kode: 'ttd_keduanya', label: 'Tanda tangan koordinator & pengampu', grup: 'Tanda tangan', contoh: '(dua ttd berdampingan)' },

  { kode: 'semester', label: 'Semester', grup: 'Periode', contoh: 'II' },
  { kode: 'tahun_ajaran', label: 'Tahun pelajaran', grup: 'Periode', contoh: '2025/2026' },
  { kode: 'tanggal_terbit', label: 'Tanggal terbit rapor', grup: 'Periode', contoh: '26 Juni 2026' },
  { kode: 'tempat_terbit', label: 'Tempat terbit', grup: 'Periode', contoh: 'Banguntapan' },
  { kode: 'tempat_tanggal', label: 'Tempat, tanggal terbit', grup: 'Periode', contoh: 'Banguntapan, 26 Juni 2026' },

  { kode: 'sapaan_pengampu', label: 'ustadz / ustadzah (menurut guru)', grup: 'Sapaan', contoh: 'ustadzah' },
  { kode: 'sapaan_siswa', label: 'sholih / sholihah (menurut siswa)', grup: 'Sapaan', contoh: 'sholihah' },

  { kode: 'deskripsi', label: 'Deskripsi perkembangan (diisi guru)', grup: 'Diisi guru', contoh: 'Alhamdulillah, Ananda…' },
  { kode: 'isian_guru', label: 'Isian merah (diisi guru)', grup: 'Diisi guru', contoh: 'Sangat baik' },

  { kode: 'halaman_riyadhoh', label: 'Hanya untuk peserta Riyadhoh', grup: 'Halaman', contoh: 'halaman ini disembunyikan bagi siswa lain' },

  { kode: 'tetap', label: 'Biarkan apa adanya', grup: 'Perlakuan khusus', contoh: 'teks template tidak diubah' },
  { kode: 'kosongkan', label: 'Kosongkan', grup: 'Perlakuan khusus', contoh: '(dibiarkan kosong)' },
]

export const MEDAN_PER_KODE = new Map(MEDAN.map(m => [m.kode, m]))

/** Medan yang diisi guru di layar edit, bukan dihitung sistem. */
export const MEDAN_ISIAN_GURU: KodeMedan[] = ['deskripsi', 'isian_guru']

// ─── Penebakan ───────────────────────────────────────────────────────────────

/**
 * Label → medan. Diperiksa berurutan, yang pertama cocok menang, jadi pola
 * yang lebih khusus harus lebih dulu: "Nilai Tahfidz" sebelum "Tahfidz",
 * "Total Pertemuan" sebelum "Total".
 */
const TEBAKAN: { pola: RegExp; kode: KodeMedan }[] = [
  // Yang menyebut jabatan harus lebih dulu: "Nama Pengampu" bukan nama siswa.
  { pola: /nama\s*(guru\s*)?(pengampu|ustadz|ustadzah)/i, kode: 'nama_pengampu' },
  { pola: /nama\s*koordinator/i, kode: 'nama_koordinator' },
  { pola: /nama\s*(lengkap)?\s*(siswa|santri|ananda)?$|^nama$/i, kode: 'nama_siswa' },
  { pola: /^n\.?i\.?s\.?$|nomor induk siswa/i, kode: 'nis' },
  { pola: /^kelas/i, kode: 'kelas' },
  { pola: /halaqoh|halaqah|kelompok/i, kode: 'halaqoh' },

  { pola: /^level|^capaian tahsin|^tahsin$/i, kode: 'level_tahsin' },
  { pola: /^jilid/i, kode: 'jilid' },
  { pola: /^metode/i, kode: 'metode' },

  { pola: /nilai\s*tahsin/i, kode: 'nilai_tahsin' },
  { pola: /nilai\s*tahfidz|nilai\s*hafalan/i, kode: 'nilai_tahfidz' },
  { pola: /nilai\s*(karakter|adab|sikap)/i, kode: 'nilai_karakter' },

  { pola: /capaian\s*tahfidz|hafalan terakhir/i, kode: 'capaian_tahfidz' },
  { pola: /juz\s*(tuntas|selesai|teruji)/i, kode: 'juz_tuntas' },
  { pola: /total\s*hafalan/i, kode: 'total_hafalan' },

  { pola: /total\s*(pertemuan|tatap muka)|jumlah\s*pertemuan/i, kode: 'total_pertemuan' },
  { pola: /^hadir$|kehadiran/i, kode: 'hadir' },
  { pola: /^izin$/i, kode: 'izin' },
  { pola: /^sakit$/i, kode: 'sakit' },
  { pola: /^alfa$|^alpa$|tanpa keterangan/i, kode: 'alfa' },

  { pola: /guru\s*pengampu|^pengampu|^ustadz|^ustadzah|wali\s*halaqoh/i, kode: 'nama_pengampu' },
  { pola: /koordinator/i, kode: 'nama_koordinator' },
  { pola: /^n\.?i\.?y\.?|^n\.?i\.?p\.?/i, kode: 'nip_pengampu' },

  { pola: /^semester/i, kode: 'semester' },
  { pola: /tahun\s*(pelajaran|ajaran)/i, kode: 'tahun_ajaran' },
  { pola: /pada\s*tanggal|^tanggal/i, kode: 'tanggal_terbit' },
  { pola: /dikeluarkan\s*di|^tempat/i, kode: 'tempat_terbit' },

  { pola: /^deskripsi|^catatan|^narasi|perkembangan/i, kode: 'deskripsi' },
]

export function tebakDariLabel(label: string): KodeMedan | null {
  const bersih = label.replace(/[:\s]+$/, '').trim()
  if (!bersih) return null
  return TEBAKAN.find(t => t.pola.test(bersih))?.kode ?? null
}

// ─── Slot ────────────────────────────────────────────────────────────────────

/**
 * Satu tempat di template yang bisa diisi data.
 *
 * Id-nya berdasarkan POSISI ("p3.1" = paragraf blok ke-3 segmen ke-1), bukan
 * isi: template yang diunggah ulang selalu diurai ulang berikut pemetaannya,
 * jadi id tidak perlu bertahan antar unggahan.
 */
export interface Slot {
  id: string
  /** Label/petunjuk yang membuat slot ini terdeteksi. */
  petunjuk: string
  /** Teks contoh di template — "Aliyah Putri", "91,52". */
  contoh: string
  /** Tebakan sistem; null = tidak ada yang cocok, koordinator yang memutuskan. */
  tebakan: KodeMedan | null
  /**
   * Teks di depan nilai yang HARUS ikut tercetak, mis. ": " atau
   * "Dikeluarkan di : ". Tanpa ini, mengganti segmen ": 91,52" dengan angka
   * baru ikut menghapus titik duanya.
   */
  prefiks: string
  /** true = ditemukan lewat placeholder {{kode}} yang ditulis manual. */
  eksplisit?: boolean
  /**
   * true = tebakannya dipakai langsung; false = hanya disarankan.
   *
   * Yang boleh dipakai langsung hanyalah NILAI yang mengikuti label yang
   * dikenali ("Nilai Tahsin" ⇥ ": 91,52"). Teks yang sekadar BERBUNYI seperti
   * label tidak: "Koordinator Al-Qur'an SDIT LHI" di blok tanda tangan adalah
   * judul kolom, dan menggantinya dengan nama koordinator menghapus judulnya.
   */
  pasti: boolean
  /**
   * Hanya untuk isian merah di tengah kalimat: teks hitam yang mengapitnya.
   * Guru mengisi potongan itu tanpa melihat lembarnya, jadi yang ia butuhkan
   * adalah kalimat di sekitarnya — "…Ananda ▢ dalam mendengarkan…".
   */
  konteks?: { sebelum: string; sesudah: string }
}

/**
 * Id slot isian merah: k7.1.m2 = kotak blok ke-7, paragraf ke-1, merah ke-2;
 * p12.m0 = paragraf blok ke-12, merah ke-0. Dipakai bersama oleh cariSlot
 * dan LembarRapor supaya keduanya tidak bisa berbeda pendapat.
 */
export function idIsian(blokKe: number, paragrafKe: number | null, merahKe: number): string {
  return paragrafKe === null ? `p${blokKe}.m${merahKe}` : `k${blokKe}.${paragrafKe}.m${merahKe}`
}

/** Tebakan untuk satu isian merah: sapaan dikenali dari bunyinya, sisanya diisi guru. */
function tebakIsian(contoh: string): KodeMedan {
  if (/^ustadz(ah)?$/i.test(contoh.trim())) return 'sapaan_pengampu'
  if (/^sholih(ah)?$|^shalih(ah)?$/i.test(contoh.trim())) return 'sapaan_siswa'
  return 'isian_guru'
}

/** Ambil ±40 huruf di ujung teks, dipotong di batas kata. */
function ujung(teks: string, dari: 'awal' | 'akhir'): string {
  const t = teks.trim()
  if (t.length <= 40) return t
  if (dari === 'akhir') {
    const potong = t.slice(-40)
    return '…' + potong.slice(potong.indexOf(' ') + 1)
  }
  const potong = t.slice(0, 40)
  return potong.slice(0, potong.lastIndexOf(' ')) + '…'
}

/** Slot untuk tiap potongan merah di satu paragraf berpotongan. */
function slotIsian(potongan: { teks: string; merah?: true }[], id: (m: number) => string): Slot[] {
  const hasil: Slot[] = []
  let m = 0
  potongan.forEach((pot, j) => {
    if (!pot.merah) return
    const tebakan = tebakIsian(pot.teks)
    hasil.push({
      id: id(m++),
      petunjuk: ujung(potongan[j - 1]?.teks ?? '', 'akhir') || 'Awal paragraf',
      contoh: pot.teks,
      prefiks: '',
      tebakan,
      pasti: true,
      konteks: { sebelum: ujung(potongan[j - 1]?.teks ?? '', 'akhir'), sesudah: ujung(potongan[j + 1]?.teks ?? '', 'awal') },
    })
  })
  return hasil
}

/**
 * Halaman yang judulnya menyebut Riyadhoh: laporan sesi Sabtu, yang hanya
 * berlaku bagi pesertanya. Dikenali dari beberapa paragraf pertama halaman.
 */
function halamanRiyadhoh(blok: Blok[], mulai: number): boolean {
  for (let j = mulai + 1; j < blok.length && j <= mulai + 6; j++) {
    const b = blok[j]
    if (b.jenis === 'halaman') return false
    if (b.jenis === 'paragraf' && /riyadh?oh/i.test(b.segmen.join(' '))) return true
  }
  return false
}

const POLA_PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/i

function dariPlaceholder(teks: string): KodeMedan | null {
  const kode = teks.match(POLA_PLACEHOLDER)?.[1]?.toLowerCase()
  return kode && (KODE_MEDAN as readonly string[]).includes(kode) ? (kode as KodeMedan) : null
}

/**
 * "Banguntapan, 26 Juni 2026" — tempat dan tanggal dalam satu tarikan.
 *
 * Bentuk ini tidak punya label di depannya, jadi ia tidak bisa ditebak dari
 * label seperti medan lain; yang dikenali adalah BENTUK teksnya. Karena itu ia
 * hanya disarankan, tak pernah dipakai langsung — sebuah kalimat yang kebetulan
 * berbentuk sama tidak boleh diam-diam berubah jadi tanggal hari ini.
 */
const POLA_TEMPAT_TANGGAL = /^[\p{L} .'-]{3,30},\s*\d{1,2}\s+\p{L}+\s+\d{4}$/u

/**
 * Segmen yang jelas-jelas tempat isian kosong, bukan teks yang harus tetap
 * tercetak.
 *
 * "Nama Pengampu" dan "NIY." tanpa angka adalah tempat menunggu isi — boleh
 * diisi sistem tanpa bertanya. "Koordinator Al-Qur'an SDIT LHI" adalah judul
 * kolom dan "NIY.20001011.308" adalah nomor yang sudah tertulis; keduanya
 * hanya disarankan, sebab menggantinya menghapus sesuatu yang memang ada.
 */
function placeholderKosong(seg: string): boolean {
  return /^nama\s+(guru\s+)?(pengampu|koordinator|ustadz|ustadzah)$/i.test(seg)
    || /^n\.?i\.?[yp]\.?$/i.test(seg)
}

/** Segmen yang berdiri sendiri sebagai label — "NIY.", "Nama Pengampu". */
function labelBerdiriSendiri(seg: string, urutanKolom: number): KodeMedan | null {
  if (seg.length > 40) return null
  const kode = tebakDariLabel(seg)
  if (!kode) return null
  // Blok tanda tangan kedua template menaruh koordinator di kolom kiri dan
  // pengampu di kanan. Ini tebakan tata letak, bukan aturan — layar pemetaan
  // yang membetulkan kalau sekolah menulisnya terbalik.
  if (kode === 'nip_pengampu' && urutanKolom === 0) return 'nip_koordinator'
  return kode
}

/**
 * Semua tempat di template yang bisa diisi data.
 *
 * Tiga bentuk yang dikenali:
 *   1. Baris identitas — segmen yang diawali ":" mengambil label dari segmen
 *      berisi sebelumnya ("Nilai Tahsin" ⇥ ": 91,52"). Segmen labelnya sendiri
 *      TIDAK menjadi slot: ia teks tetap, bukan tempat isian.
 *   2. Sel tabel — baris data mengambil label dari baris kepala di atasnya
 *      (tabel Hadir/Izin/Alfa di rapor SMP).
 *   3. Kotak teks — kotak DESKRIPSI.
 * Segmen lain tetap dikembalikan dengan `tebakan: null` supaya koordinator
 * bisa memetakannya sendiri lewat "tampilkan semua baris" — di situlah nama
 * dan NIY di blok tanda tangan dibereskan.
 */
/** Jabatan yang disebut sebuah paragraf — penentu ruang tanda tangan siapa. */
function jabatanDi(b: Blok | undefined): { koor: boolean; pengampu: boolean } {
  if (!b || b.jenis !== 'paragraf') return { koor: false, pengampu: false }
  const teks = b.segmen.join(' ')
  return {
    koor: /koordinator/i.test(teks),
    pengampu: /pengampu|ustadz|ustadzah|wali\s*halaqoh/i.test(teks),
  }
}

/** Baris yang berbunyi seperti nama atau NIY — penutup blok tanda tangan. */
function barisPenutupTtd(b: Blok | undefined): boolean {
  if (!b || b.jenis !== 'paragraf') return false
  const teks = b.segmen.join(' ')
  return /n\.?i\.?[yp]\.?/i.test(teks) || /nama\s*(guru\s*)?(pengampu|koordinator)/i.test(teks) || /,\s*S\.|,\s*M\./.test(teks)
}

export function cariSlot(blok: Blok[]): Slot[] {
  const slot: Slot[] = []

  blok.forEach((b, i) => {
    if (b.jenis === 'halaman') {
      const riyadhoh = halamanRiyadhoh(blok, i)
      slot.push({
        id: `h${i}`,
        petunjuk: `Halaman ${blok.slice(0, i + 1).filter(x => x.jenis === 'halaman').length + 1}`,
        contoh: riyadhoh ? 'Laporan Riyadhoh Al-Qur’an' : 'halaman lanjutan',
        prefiks: '',
        tebakan: riyadhoh ? 'halaman_riyadhoh' : null,
        // Judulnya menyebut Riyadhoh dengan jelas — mencetaknya untuk siswa
        // yang tidak ikut Riyadhoh justru kesalahan yang lebih buruk.
        pasti: riyadhoh,
      })
      return
    }

    if (b.jenis === 'jeda') {
      // Ruang kosong antara baris jabatan dan baris nama adalah tempat tanda
      // tangan — itulah sebabnya diketik empat kali Enter, bukan sekali.
      const jabatan = jabatanDi(blok[i - 1])
      const ditutupNama = barisPenutupTtd(blok[i + 1])
      const tebakan: KodeMedan | null =
        jabatan.koor && jabatan.pengampu ? 'ttd_keduanya'
          : jabatan.koor ? 'ttd_koordinator'
            : jabatan.pengampu ? 'ttd_pengampu'
              : null
      slot.push({
        id: `j${i}`,
        petunjuk: `Ruang kosong ${b.baris} baris`,
        contoh: tebakan ? 'ruang tanda tangan' : '',
        prefiks: '',
        tebakan,
        // Dipakai langsung hanya bila ruang itu benar-benar terapit jabatan di
        // atas dan nama/NIY di bawah. Baris kosong biasa tetap jadi jeda.
        pasti: Boolean(tebakan) && ditutupNama && b.baris >= 2,
      })
      return
    }

    // Kotak berisi isian merah: tiap potongan merah jadi slot sendiri, dan
    // kotaknya TIDAK lagi menjadi satu slot deskripsi utuh — kalimat hitamnya
    // terkunci, persis maksud template.
    if (b.jenis === 'kotak' && b.potongan?.some(Boolean)) {
      b.potongan.forEach((pot, pk) => {
        if (pot) slot.push(...slotIsian(pot, m => idIsian(i, pk, m)))
      })
      return
    }

    if (b.jenis === 'kotak') {
      const judul = b.paragraf[0] ?? ''
      const adaJudul = tebakDariLabel(judul) !== null && judul.length <= 60
      const isi = adaJudul ? b.paragraf.slice(1) : b.paragraf
      slot.push({
        id: `k${i}`,
        petunjuk: adaJudul ? judul : 'Kotak teks',
        contoh: isi.join(' '),
        prefiks: '',
        tebakan: dariPlaceholder(b.paragraf.join(' ')) ?? (adaJudul ? tebakDariLabel(judul) : null) ?? 'deskripsi',
        eksplisit: POLA_PLACEHOLDER.test(b.paragraf.join(' ')),
        pasti: true,
      })
      return
    }

    if (b.jenis === 'tabel') {
      b.baris.forEach((baris, r) => {
        if (r === 0 && b.baris.length > 1) return // baris kepala memberi label, bukan tempat isian
        baris.forEach((sel, c) => {
          const kepala = b.baris.length > 1 ? (b.baris[0]?.[c] ?? '') : ''
          const eksplisit = dariPlaceholder(sel)
          slot.push({
            id: `t${i}.${r}.${c}`,
            petunjuk: kepala || sel.slice(0, 40) || `Kolom ${c + 1}`,
            contoh: sel,
            prefiks: '',
            tebakan: eksplisit ?? (kepala ? tebakDariLabel(kepala) : null),
            eksplisit: Boolean(eksplisit),
            pasti: true,
          })
        })
      })
      return
    }

    // Paragraf biasa dengan isian merah di tengah kalimat. Baris identitas
    // ("Nama ⇥ : Bayu") juga merah, tapi nilainya satu segmen utuh sesudah
    // titik dua — ia tetap ditangani jalur segmen di bawah, yang sudah tahu
    // cara menebaknya dari label.
    if (b.potongan && !b.segmen.some(s => s.startsWith(':')) && !/^.{2,40}?\s*:\s*.+$/.test(b.segmen.find(Boolean) ?? '')) {
      slot.push(...slotIsian(b.potongan, m => idIsian(i, null, m)))
      return
    }

    // Segmen yang dipakai sebagai label oleh segmen nilai sesudahnya.
    const dipakaiLabel = new Set<number>()
    b.segmen.forEach((seg, s) => {
      if (!seg.startsWith(':')) return
      for (let j = s - 1; j >= 0; j--) {
        if (b.segmen[j]) { dipakaiLabel.add(j); break }
      }
    })

    const berisi = b.segmen.filter(Boolean).length
    let kolom = -1

    b.segmen.forEach((seg, s) => {
      if (!seg) return
      kolom += 1
      if (dipakaiLabel.has(s)) return

      const eksplisit = dariPlaceholder(seg)
      if (eksplisit) {
        slot.push({ id: `p${i}.${s}`, petunjuk: seg, contoh: seg, prefiks: '', tebakan: eksplisit, eksplisit: true, pasti: true })
        return
      }

      // Bentuk 1: ": nilai".
      if (seg.startsWith(':')) {
        const label = [...b.segmen.slice(0, s)].reverse().find(Boolean) ?? ''
        slot.push({
          id: `p${i}.${s}`,
          petunjuk: label || 'Setelah titik dua',
          contoh: seg.replace(/^:\s*/, ''),
          prefiks: ': ',
          tebakan: tebakDariLabel(label),
          pasti: true,
        })
        return
      }

      // Bentuk 1b: "Dikeluarkan di : Bantul" — label dan nilai satu segmen.
      const sebaris = seg.match(/^(.{2,40}?)\s*:\s*(.+)$/)
      if (sebaris) {
        slot.push({
          id: `p${i}.${s}`,
          petunjuk: sebaris[1],
          contoh: sebaris[2],
          prefiks: `${sebaris[1]} : `,
          tebakan: tebakDariLabel(sebaris[1]),
          pasti: true,
        })
        return
      }

      // Sisanya: hanya paragraf berkolom (blok tanda tangan) yang ditebak dari
      // teksnya sendiri. Judul dokumen selalu satu segmen, jadi ia tak ikut —
      // "LAPORAN PERKEMBANGAN SEMESTER II" bukan tempat isian.
      slot.push({
        id: `p${i}.${s}`,
        petunjuk: seg.slice(0, 40),
        contoh: seg,
        prefiks: '',
        tebakan: berisi > 1
          ? labelBerdiriSendiri(seg, kolom)
          : (POLA_TEMPAT_TANGGAL.test(seg) ? 'tempat_tanggal' : null),
        pasti: berisi > 1 && placeholderKosong(seg) && labelBerdiriSendiri(seg, kolom) !== null,
      })
    })
  })

  return slot
}

// ─── Isi awal isian merah ────────────────────────────────────────────────────

/**
 * Apa yang sudah tertulis di kolom isian sebelum guru menyentuhnya:
 * contoh dari template, kosong, atau hitungan sistem untuk medan tertentu.
 */
export type AwalIsian = 'contoh' | 'kosong' | KodeMedan

/**
 * Bawaan: contoh template dipakai HANYA bila ia frasa umum ("Sangat baik",
 * "berusaha hadir tepat waktu"). Contoh yang memuat angka — "Surat
 * Al-Qiyamah ayat 34", "Jilid 4 halaman 20" — adalah data anak lain yang
 * kebetulan dipakai menulis template; memasangnya sebagai isi awal berarti
 * rapor yang lupa diedit tercetak dengan capaian anak yang salah.
 */
export function awalIsianBawaan(s: Pick<Slot, 'contoh'>): AwalIsian {
  return /\d/.test(s.contoh) ? 'kosong' : 'contoh'
}

export function isiAwalIsian(
  s: Pick<Slot, 'contoh'>,
  awal: AwalIsian | undefined,
  hitungan: Partial<Record<KodeMedan, string>>,
): string {
  const a = awal ?? awalIsianBawaan(s)
  if (a === 'contoh') return s.contoh
  if (a === 'kosong') return ''
  return hitungan[a] ?? ''
}

/**
 * Isian merah yang diisi guru di template ini, berurutan seperti di lembar.
 * Slot yang belum pernah dipetakan (template diunggah sebelum pemetaan
 * disimpan) memakai tebakannya bila tebakan itu pasti.
 */
export function slotIsianGuru(blok: Blok[], pemetaan: Record<string, KodeMedan>): Slot[] {
  return cariSlot(blok).filter(s => (pemetaan[s.id] ?? (s.pasti ? s.tebakan : null)) === 'isian_guru')
}

/** "Ustadzah" bila contoh di template berhuruf kapital, "ustadzah" bila tidak. */
export function ikutHuruf(contoh: string, nilai: string): string {
  if (!nilai || !contoh) return nilai
  const kapital = contoh[0] === contoh[0].toUpperCase() && contoh[0] !== contoh[0].toLowerCase()
  return kapital ? nilai[0].toUpperCase() + nilai.slice(1) : nilai[0].toLowerCase() + nilai.slice(1)
}

/**
 * Pemetaan bawaan — titik berangkat layar pemetaan.
 *
 * Hanya tebakan yang `pasti` yang langsung dipakai. Sisanya dibiarkan apa
 * adanya dan tebakannya cukup ditawarkan: lebih baik koordinator menambahkan
 * satu pemetaan yang kurang daripada menemukan judul kolom tanda tangannya
 * tergantikan nama orang di rapor yang sudah dibagikan.
 */
export function pemetaanAwal(slot: Slot[]): Record<string, KodeMedan> {
  return Object.fromEntries(slot.map(s => [s.id, (s.pasti && s.tebakan) || 'tetap']))
}
