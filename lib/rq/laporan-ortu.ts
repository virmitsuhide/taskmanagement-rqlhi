/**
 * Laporan orang tua per sesi — bagian murni (tanpa akses data), dipakai
 * halaman /guru/laporan-ortu di server dan kotak teks WhatsApp di klien.
 *
 * Laporan ini PER SESI: satu lembar untuk seluruh anak satu halaqoh, dikirim
 * ke grup wali sesi itu. Rapor per anak tetap di /guru/siswa/[id]/rapor.
 */

export type PresetPeriode = 'hari' | 'pekan' | 'bulan' | 'rentang'

export interface PeriodeLaporan {
  preset: PresetPeriode
  /** 'YYYY-MM-DD', inklusif. */
  dari: string
  sampai: string
  /** "Senin–Kamis, 15–18 September 2026" */
  label: string
}

export interface AnakLaporan {
  id: string
  nama: string
  kelas: string | null
  /** Hari berbeda anak ini setor (tahsin atau tahfidz) dalam periode. */
  hariSetor: number
  tahsin: {
    /**
     * Halaman TERAKHIR YANG LULUS: "Jilid 3 hal. 14", "Jilid 6 · Drill hal. 1–5",
     * "Al-Qur'an T2 · mushaf hal. 45", "Lulus Tahsin".
     */
    posisi: string | null
    setoran: number
    /** Setoran lulus di luar drill — tiap satu memajukan satu halaman. */
    lulus: number
    /** Halaman drill yang lulus dalam periode — latihan ulang, posisi tidak maju. */
    drillLulus: number
    /**
     * Setoran terakhir periode ini berstatus Lanjut (halaman belum tuntas):
     * "hal. 7 baris 1–8". Tanpa ini setoran beberapa baris tidak terbaca
     * sama sekali — "+0 hal." seolah anak tidak membaca apa pun.
     */
    baris: string | null
    /** Sudah Lulus Tahsin — tahsinnya bukan kabar baru bagi wali. */
    selesai: boolean
  }
  tahfidz: {
    /** Setoran ziyadah terakhir sepanjang masa, mis. "Al-Baqarah 187–188". */
    terakhir: string | null
    juzTuntas: number
    /** Juz yang sedang dihafal bila melewati juz tuntas. */
    sedangJuz: number | null
    /** Hafalan baru dalam periode, halaman mushaf (boleh pecahan). */
    ziyadahHalaman: number
    ziyadahAyat: number
    /** Berapa kali setor ziyadah dalam periode. */
    ziyadahSetoran: number
    /** Berapa kali setor muroja'ah (baru + lama) dalam periode. */
    murojaah: number
    /** Halaman muroja'ah dalam periode — volume baca, tiap setoran dijumlah. */
    murojaahBaruHalaman: number
    murojaahLamaHalaman: number
    /** Nama surat yang dimuroja'ah dalam periode, urut mushaf, tiap surat sekali. */
    murojaahBaruSurat: string[]
    murojaahLamaSurat: string[]
    /** Total hafalan saat ini dalam halaman mushaf menurut urutan hafalan RQ. */
    totalHalaman: number
  }
  /** Ujian yang selesai dalam periode, mis. "Tasmi' Juz 30 · Mumtaz". */
  ujian: string[]
  /** TPAIT (PAUD) saja: setoran terakhir periode, bahan baris pesan "Fun Qur'an". */
  funQuran?: {
    tahsin: { jilid: string; halaman: number | null; status: string } | null
    tahfidz: { surat: string; ayatDari: number | null; ayatKe: number | null; murojaah: boolean } | null
  }
}

export interface LaporanOrtu {
  /** `ekstra` = laporan satu kelompok ekstra (0091): hanya setoran pertemuan ekstranya. */
  sesi: { id: string; nama: string; jenjang?: string; ekstra?: boolean }
  guru: { nama: string; ttdUrl: string | null }
  periode: PeriodeLaporan
  /** Hari yang ada setoran di sesi ini — bukan hari kalender, supaya libur tidak terbaca bolos. */
  hariPertemuan: number
  anak: AnakLaporan[]
  ringkas: {
    jumlahAnak: number
    anakSetor: number
    tahsinLulus: number
    ziyadahHalaman: number
    murojaah: number
    /** Halaman muroja'ah baru + lama seluruh anak. */
    murojaahHalaman: number
    ujian: number
  }
  dicetak: string
}

// ─── Periode ─────────────────────────────────────────────────────────────────

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']
/** Rentang bebas dibatasi supaya satu laporan tetap terbaca dan kueri tetap ringan. */
export const RENTANG_MAKS_HARI = 93

function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const hariKe = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const tgl = (iso: string) => Number(iso.slice(8, 10))
const bln = (iso: string) => BULAN[Number(iso.slice(5, 7)) - 1]
const thn = (iso: string) => iso.slice(0, 4)
const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

export function labelPeriode(dari: string, sampai: string): string {
  if (dari === sampai) return `${HARI[hariKe(dari)]}, ${tgl(dari)} ${bln(dari)} ${thn(dari)}`
  // Sepekan atau kurang: nama harinya ikut disebut, itu yang diingat wali.
  const namaHari = selisihHari(dari, sampai) < 7 ? `${HARI[hariKe(dari)]}–${HARI[hariKe(sampai)]}, ` : ''
  if (dari.slice(0, 7) === sampai.slice(0, 7)) return `${namaHari}${tgl(dari)}–${tgl(sampai)} ${bln(sampai)} ${thn(sampai)}`
  if (thn(dari) === thn(sampai)) return `${namaHari}${tgl(dari)} ${bln(dari)} – ${tgl(sampai)} ${bln(sampai)} ${thn(sampai)}`
  return `${namaHari}${tgl(dari)} ${bln(dari)} ${thn(dari)} – ${tgl(sampai)} ${bln(sampai)} ${thn(sampai)}`
}

const TANGGAL_SAH = /^\d{4}-\d{2}-\d{2}$/

/**
 * Rentang dari pilihan guru. Tidak pernah melewati hari ini; rentang bebas
 * yang tidak masuk akal (terbalik, kosong, terlalu panjang) dirapikan, bukan
 * ditolak — guru tetap mendapat laporan.
 */
export function rentangLaporan(
  preset: PresetPeriode,
  hariIni: string,
  diminta: { dari?: string; sampai?: string } = {},
): PeriodeLaporan {
  let dari = hariIni
  let sampai = hariIni
  if (preset === 'pekan') dari = tambahHari(hariIni, -((hariKe(hariIni) + 6) % 7))
  if (preset === 'bulan') dari = `${hariIni.slice(0, 7)}-01`
  if (preset === 'rentang') {
    sampai = TANGGAL_SAH.test(diminta.sampai ?? '') && diminta.sampai! <= hariIni ? diminta.sampai! : hariIni
    dari = TANGGAL_SAH.test(diminta.dari ?? '') ? diminta.dari! : sampai
    if (dari > sampai) [dari, sampai] = [sampai, dari]
    if (selisihHari(dari, sampai) >= RENTANG_MAKS_HARI) dari = tambahHari(sampai, -(RENTANG_MAKS_HARI - 1))
  }
  return { preset, dari, sampai, label: labelPeriode(dari, sampai) }
}

// ─── Angka ───────────────────────────────────────────────────────────────────

/** Surat yang disebut paling banyak per jenis; sisanya diringkas "+N surat lain". */
const SURAT_MAKS = 6

function daftarSurat(nama: string[]): string {
  if (nama.length <= SURAT_MAKS) return nama.join(', ')
  return `${nama.slice(0, SURAT_MAKS).join(', ')} +${nama.length - SURAT_MAKS} surat lain`
}

/**
 * "baru: Al-Mulk, Al-Qalam (6,5 hal.) · lama: An-Naba' (4 hal.)" — jenis yang
 * nol tidak ditulis. Wali perlu tahu SURAT mana yang diulang supaya bisa
 * ikut menyimak di rumah, bukan hanya berapa halamannya.
 */
export function teksMurojaah(t: {
  murojaahBaruHalaman: number; murojaahLamaHalaman: number
  murojaahBaruSurat: string[]; murojaahLamaSurat: string[]
}): string {
  const satu = (jenis: string, halaman: number, surat: string[]) =>
    surat.length > 0
      ? `${jenis}: ${daftarSurat(surat)} (${angka1(halaman)} hal.)`
      : `${jenis} ${angka1(halaman)} hal.`
  return [
    t.murojaahBaruHalaman > 0 ? satu('baru', t.murojaahBaruHalaman, t.murojaahBaruSurat) : null,
    t.murojaahLamaHalaman > 0 ? satu('lama', t.murojaahLamaHalaman, t.murojaahLamaSurat) : null,
  ].filter(Boolean).join(' · ')
}

export function angka1(n: number): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

/**
 * Tambahan hafalan untuk dibaca wali. Di bawah satu halaman ditulis dalam
 * ayat: satu ayat ≈ 0,04 halaman, dan "+0 hal." terbaca seperti tidak ada
 * kemajuan sama sekali.
 */
export function tambahHafalan(halaman: number, ayat: number): string {
  return halaman >= 1 ? `+${angka1(halaman)} hal.` : `+${ayat} ayat`
}

/** Keterangan tahsin satu anak untuk wali: "+2 hal. · lanjut hal. 7 baris 1–8". */
export function teksTahsinPeriode(t: { lulus: number; drillLulus?: number; setoran: number; baris: string | null }): string | null {
  const bagian = [
    t.lulus > 0 ? `+${t.lulus} hal.` : null,
    t.drillLulus ? `${t.drillLulus} hal. drill lulus` : null,
    t.baris ? `lanjut ${t.baris}` : null,
  ].filter(Boolean)
  return bagian.length > 0 ? bagian.join(' · ') : null
}

/** "6 juz (124 hal.)" — juz tuntas + halaman mushaf; hanya halaman bila belum ada juz tuntas. */
export function labelTotalHafalan(t: Pick<AnakLaporan['tahfidz'], 'juzTuntas' | 'totalHalaman'>): string {
  const hal = `${angka1(t.totalHalaman)} hal.`
  return t.juzTuntas > 0 ? `${t.juzTuntas} juz (${hal})` : hal
}

// ─── Teks WhatsApp ───────────────────────────────────────────────────────────

export interface OpsiPesan {
  /** Rincian satu baris per anak. Dimatikan bila grup wali berisi orang tua sesi lain. */
  rincian: boolean
  /** Pesan tambahan dari guru, disisipkan sebelum penutup. */
  pesan: string
  /**
   * Tautan laporan yang bisa dibuka wali tanpa login. Kosong = tidak
   * disertakan, dan penutupnya kembali menyebut lampiran PDF — wali yang
   * tidak diberi tautan tidak boleh disuruh membuka sesuatu yang tak ada.
   */
  tautan?: string
}

// ─── Teks WhatsApp TPAIT: "Laporan Capaian Fun Qur'an" ───────────────────────

/** Bagian yang disunting guru — antara judul pendampingan dan "Jazakumullahu". */
export const PENDAMPINGAN_BAWAAN = [
  "🌈 Muroja'ah hafalan minimal 5–10 menit/hari, dengan di talaqqi perayat.",
  "🌈 Muraja'ah Tahsin jilid sesuai capaian ananda, dengan fokus pembetulan bacaan per huruf. agar progres lebih cepat, hafalan terjaga, dan bacaan semakin baik.",
].join('\n')

/** Laporan sesi TPAIT memakai format Fun Qur'an. */
export function pakaiFunQuran(l: LaporanOrtu): boolean {
  return l.sesi.jenjang === 'paud'
}

/** Nama buku UMMI seperti yang dipakai guru TPAIT: 'Pra-UMMI' → 'Pra Ummi', 'Jilid 1' → 'Ummi 1'. */
function namaBukuTpait(label: string): string {
  return label.trim()
    .replace(/^pra[\s-]*(ummi)?/i, 'Pra Ummi')
    .replace(/^jilid\s*(\d)/i, 'Ummi $1')
    .replace(/\bhal\./g, 'hlm')
}

/**
 * Hasil setoran dalam bahasa guru TPAIT: lulus = lanjut ke halaman berikut,
 * ulang = ulang. Status "Lanjut" aplikasi (halaman belum tuntas) ditulis
 * "belum tuntas" supaya tidak tertukar dengan "lanjut" milik guru.
 */
const HASIL_TPAIT: Record<string, string> = { lulus: 'lanjut', ulang: 'ulang', lanjut: 'belum tuntas' }

function barisFunQuran(a: AnakLaporan): string {
  const f = a.funQuran
  const ts = f?.tahsin
    ? `${namaBukuTpait(f.tahsin.jilid)}${f.tahsin.halaman ? ` hlm ${f.tahsin.halaman}` : ''}${HASIL_TPAIT[f.tahsin.status] ? ` (${HASIL_TPAIT[f.tahsin.status]})` : ''}`
    : a.tahsin.posisi ? namaBukuTpait(a.tahsin.posisi) : '-'
  const tf = f?.tahfidz
  const ayat = tf?.ayatDari
    ? tf.ayatKe && tf.ayatKe !== tf.ayatDari ? `${tf.ayatDari}-${tf.ayatKe}` : `${tf.ayatDari}`
    : ''
  const teksTf = tf
    ? tf.murojaah ? `penguatan QS. ${tf.surat}${ayat ? ` ${ayat}` : ''}` : `${tf.surat}${ayat ? ` ayat ${ayat}` : ''}`
    : '-'
  return `${a.nama} : ${ts}/${teksTf}`
}

export function teksWaFunQuran(l: LaporanOrtu, pendampingan: string): string {
  return [
    '🕌✨🕌✨🕌✨🕌✨',
    " Laporan Capaian Fun Qur'an ",
    '',
    `  ${l.periode.label}`,
    '',
    'Assalamu’alaikum warahmatullahi wabarakatuh,',
    '',
    `Ayah/Bunda, berikut kami sampaikan laporan ngaji ananda selama ${l.periode.preset === 'hari' ? 'hari ini' : l.periode.preset === 'bulan' ? '1 bulan' : '1 pekan'}:`,
    '',
    ...l.anak.map((a, i) => `${i + 1}. ${barisFunQuran(a)}`),
    '',
    '==================',
    ' Mohon Pendampingan Ayah/Bunda di Rumah: ',
    pendampingan.trim(),
    '',
    'Jazakumullahu khairan Katsir atas kerja samanya Ayah/Bunda semua.',
    'Semoga Allah mudahkan ananda menjadi generasi cinta Al-Qur’an. Aamiin 🤍',
    '',
    "Wassalamu'alaikum warahmatullahi wabarakatuh",
  ].join('\n')
}

/**
 * Pesan untuk grup wali satu sesi. Dikirim bersama PDF-nya, jadi isinya
 * ringkasan yang bisa dibaca tanpa membuka lampiran — bukan salinan tabel.
 */
export function teksWaLaporanOrtu(l: LaporanOrtu, opsi: OpsiPesan): string {
  const baris: string[] = [
    "Assalamu'alaikum warahmatullahi wabarakatuh 🌿",
    '',
    `Ayah/Bunda yang dirahmati Allah, berikut laporan capaian pembelajaran Al-Qur'an Ananda di *${namaSesiPesan(l)}* pada *${l.periode.label}*.`,
    '',
    '📊 *Ringkasan*',
    ...barisRingkasan(l),
  ]
  if (opsi.rincian && l.anak.length > 0) baris.push('', '📖 *Capaian per Ananda*', ...barisRincian(l))

  if (opsi.pesan.trim()) baris.push('', opsi.pesan.trim())
  baris.push(
    '',
    opsi.tautan
      ? `Laporan lengkap: ${opsi.tautan}`
      : 'Laporan lengkap terlampir dalam PDF.',
    "Mohon dukungan Ayah/Bunda untuk menyimak muroja'ah Ananda di rumah. 🤲",
    '',
    'Jazakumullahu khairan.',
    "Wassalamu'alaikum warahmatullahi wabarakatuh",
    '',
    l.guru.nama,
    `${l.sesi.nama} · Rumah Qur'an LHI`,
  )
  return baris.join('\n')
}

const namaSesiPesan = (l: LaporanOrtu) => l.sesi.ekstra ? `ekstra ${l.sesi.nama}` : l.sesi.nama

/** Butir ringkasan sesi ("• Ananda yang setor: …") — dipakai template dasar & {ringkasan}. */
function barisRingkasan(l: LaporanOrtu): string[] {
  const r = l.ringkas
  const baris: string[] = []
  if (l.hariPertemuan > 1) baris.push(`• Pertemuan: ${l.hariPertemuan} hari`)
  baris.push(`• Ananda yang setor: ${r.anakSetor} dari ${r.jumlahAnak} anak`)
  if (r.tahsinLulus > 0) baris.push(`• Tahsin: ${r.tahsinLulus} halaman lulus`)
  if (r.ziyadahHalaman > 0 || r.murojaah > 0) {
    baris.push(`• Tahfidz: ${[
      r.ziyadahHalaman > 0 ? `${angka1(r.ziyadahHalaman)} halaman hafalan baru` : null,
      r.murojaah > 0 ? `${angka1(r.murojaahHalaman)} halaman muroja'ah` : null,
    ].filter(Boolean).join(' · ')}`)
  }
  if (r.ujian > 0) baris.push(`• Ujian selesai: ${r.ujian}`)
  return baris
}

/** Rincian satu blok per anak — dipakai template dasar & {rincian}. */
function barisRincian(l: LaporanOrtu): string[] {
  const baris: string[] = []
  l.anak.forEach((a, i) => {
    const hadir = a.hariSetor === 0
      ? 'belum setor'
      : l.hariPertemuan > 1 ? `setor ${a.hariSetor}/${l.hariPertemuan} hari` : 'setor'
    baris.push(`${i + 1}. *${a.nama}* — ${hadir}`)
    // Anak yang sudah Lulus Tahsin: baris tahsin hanya bila periode ini ada setorannya.
    if (a.tahsin.posisi && (!a.tahsin.selesai || a.tahsin.setoran > 0)) {
      const ket = teksTahsinPeriode(a.tahsin)
      baris.push(`   Tahsin: ${a.tahsin.posisi}${ket ? ` (${ket})` : ''}`)
    }
    const t = a.tahfidz
    if (t.terakhir) baris.push(`   Tahfidz: ${t.terakhir}`)
    const rincianTf = [
      t.ziyadahAyat > 0 ? `ziyadah ${tambahHafalan(t.ziyadahHalaman, t.ziyadahAyat)}` : null,
      t.murojaah > 0 ? `muroja'ah ${teksMurojaah(t)}` : null,
      t.totalHalaman > 0 ? `total hafalan ${labelTotalHafalan(t)}` : null,
    ].filter(Boolean)
    if (rincianTf.length > 0) baris.push(`   ${t.terakhir ? '' : 'Tahfidz: '}${rincianTf.join(' · ')}`)
    for (const u of a.ujian) baris.push(`   🎉 ${u}`)
  })
  return baris
}

// ─── Template WhatsApp milik guru (0124) ─────────────────────────────────────

/** Maksimal template sendiri per guru, selain template dasar. Sama dengan CHECK slot di 0124. */
export const MAKS_TEMPLATE_WA = 3

export interface TemplateWa { slot: number; nama: string; isi: string }

/** Penanda yang diisi aplikasi — urutan ini juga urutan tombol sisip di penyunting. */
export const PENANDA_TEMPLATE: { kode: string; label: string }[] = [
  { kode: '{sesi}', label: 'Nama sesi' },
  { kode: '{periode}', label: 'Periode' },
  { kode: '{ringkasan}', label: 'Ringkasan' },
  { kode: '{rincian}', label: 'Rincian per anak' },
  { kode: '{tautan}', label: 'Tautan laporan' },
  { kode: '{guru}', label: 'Nama guru' },
  { kode: '{jumlah_anak}', label: 'Jumlah anak' },
  { kode: '{anak_setor}', label: 'Jumlah anak setor' },
]

/** Isi awal template baru — titik berangkat yang langsung terpakai, bukan kotak kosong. */
export const TEMPLATE_CONTOH = [
  "Assalamu'alaikum warahmatullahi wabarakatuh",
  '',
  'Ayah/Bunda, berikut capaian ngaji Ananda di *{sesi}* pada *{periode}*:',
  '',
  '{rincian}',
  '',
  'Laporan lengkap: {tautan}',
  '',
  'Jazakumullahu khairan.',
  '{guru}',
].join('\n')

/**
 * Isi penanda di template guru dengan data laporan. Penanda yang tidak
 * dikenal dibiarkan apa adanya — guru melihatnya di pratinjau dan bisa
 * memperbaikinya, alih-alih teksnya hilang diam-diam.
 */
export function isiTemplateWa(isi: string, l: LaporanOrtu, tautan: string): string {
  const nilai: Record<string, string> = {
    '{sesi}': namaSesiPesan(l),
    '{periode}': l.periode.label,
    '{ringkasan}': barisRingkasan(l).join('\n'),
    '{rincian}': barisRincian(l).join('\n'),
    '{tautan}': tautan,
    '{guru}': l.guru.nama,
    '{jumlah_anak}': String(l.ringkas.jumlahAnak),
    '{anak_setor}': String(l.ringkas.anakSetor),
  }
  return isi.replace(/\{[a-z_]+\}/g, k => nilai[k] ?? k).trim()
}
