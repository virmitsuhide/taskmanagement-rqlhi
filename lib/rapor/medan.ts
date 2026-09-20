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
  'semester', 'tahun_ajaran', 'tanggal_terbit', 'tempat_terbit',
  // Diisi guru di layar edit
  'deskripsi',
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

  { kode: 'deskripsi', label: 'Deskripsi perkembangan (diisi guru)', grup: 'Diisi guru', contoh: 'Alhamdulillah, Ananda…' },

  { kode: 'tetap', label: 'Biarkan apa adanya', grup: 'Perlakuan khusus', contoh: 'teks template tidak diubah' },
  { kode: 'kosongkan', label: 'Kosongkan', grup: 'Perlakuan khusus', contoh: '(dibiarkan kosong)' },
]

export const MEDAN_PER_KODE = new Map(MEDAN.map(m => [m.kode, m]))

/** Medan yang diisi guru di layar edit, bukan dihitung sistem. */
export const MEDAN_ISIAN_GURU: KodeMedan[] = ['deskripsi']

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
}

const POLA_PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/i

function dariPlaceholder(teks: string): KodeMedan | null {
  const kode = teks.match(POLA_PLACEHOLDER)?.[1]?.toLowerCase()
  return kode && (KODE_MEDAN as readonly string[]).includes(kode) ? (kode as KodeMedan) : null
}

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
        tebakan: berisi > 1 ? labelBerdiriSendiri(seg, kolom) : null,
        pasti: berisi > 1 && placeholderKosong(seg) && labelBerdiriSendiri(seg, kolom) !== null,
      })
    })
  })

  return slot
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
