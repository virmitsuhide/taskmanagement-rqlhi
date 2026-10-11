/**
 * Suasana — palet warna pilihan tiap akun (halaman Tampilan).
 *
 * Mode terang/gelap tetap diurus next-themes seperti biasa. Di atasnya, tiap
 * akun memilih DUA hal: suasana untuk mode terang (teduh, fajar, …) dan apa
 * yang terjadi saat perangkat gelap (Tilawah Malam, Senja, atau tetap terang).
 *
 * Cara kerjanya murni token CSS: skrip kecil di <head> (SKRIP_SUASANA) membaca
 * cookie `rq-suasana` sebelum halaman dilukis lalu memasang
 *   html[data-suasana-terang="fajar"]  → dipakai selama <html> TIDAK .dark
 *   html[data-suasana-gelap="senja"]   → dipakai selama <html> .dark
 *   html[data-ukuran="besar"]          → ukuran huruf akar
 * Karena dua atribut itu dipasang bersamaan dan CSS-nya bergantung pada kelas
 * .dark, menekan tombol mode terang/gelap langsung berganti suasana tanpa
 * perlu JavaScript tambahan. Teduh & Tilawah Malam adalah :root & .dark di
 * app/globals.css — tanpa cookie (pengunjung publik) semuanya tetap Teduh.
 *
 * Nilai token di bawah adalah DOKUMENTASI blok `@media screen` di
 * app/globals.css (bagian "Suasana") dan sumber warna pratinjau kartu di
 * halaman Tampilan. Semua pasangan teks/latar ≥ 4.5:1. Kalau mengubah satu
 * warna, ubah keduanya.
 */

export const SUASANA_TERANG = ['teduh', 'fajar', 'samudra', 'zaitun', 'mushaf', 'kontras'] as const
export const SUASANA_GELAP = ['malam', 'senja'] as const
/** Pilihan "saat perangkat gelap": salah satu suasana gelap, atau tetap terang. */
export const PILIHAN_GELAP = ['malam', 'senja', 'terang'] as const
export const UKURAN_TEKS = ['kecil', 'biasa', 'besar'] as const

export type SuasanaTerang = (typeof SUASANA_TERANG)[number]
export type SuasanaGelap = (typeof SUASANA_GELAP)[number]
export type PilihanGelap = (typeof PILIHAN_GELAP)[number]
export type UkuranTeks = (typeof UKURAN_TEKS)[number]
export type Suasana = SuasanaTerang | SuasanaGelap

export interface PrefTampilan {
  terang: SuasanaTerang
  gelap: PilihanGelap
  ukuran: UkuranTeks
}

export const PREF_BAWAAN: PrefTampilan = { terang: 'teduh', gelap: 'malam', ukuran: 'biasa' }

export const COOKIE_SUASANA = 'rq-suasana'
/** Setahun — preferensi tampilan, bukan sesi. */
export const UMUR_COOKIE_SUASANA = 60 * 60 * 24 * 365
/** Penanda bahwa mode 'light' dipasang oleh "tetap terang", bukan oleh pengguna. */
export const KUNCI_PAKSA_TERANG = 'rq-suasana-paksa'

export const LABEL_UKURAN: Record<UkuranTeks, string> = { kecil: 'Kecil', biasa: 'Biasa', besar: 'Besar' }

function pilih<T extends string>(daftar: readonly T[], nilai: unknown, bawaan: T): T {
  return typeof nilai === 'string' && (daftar as readonly string[]).includes(nilai) ? (nilai as T) : bawaan
}

/** Bersihkan masukan apa pun (cookie, baris DB, argumen action) menjadi PrefTampilan sah. */
export function normalisasiPref(p: { terang?: unknown; gelap?: unknown; ukuran?: unknown } | null | undefined): PrefTampilan {
  return {
    terang: pilih(SUASANA_TERANG, p?.terang, PREF_BAWAAN.terang),
    gelap: pilih(PILIHAN_GELAP, p?.gelap, PREF_BAWAAN.gelap),
    ukuran: pilih(UKURAN_TEKS, p?.ukuran, PREF_BAWAAN.ukuran),
  }
}

/** Cookie berbentuk "terang|gelap|ukuran", mis. "fajar|senja|besar". */
export function bacaCookieSuasana(raw: string | null | undefined): PrefTampilan {
  if (!raw) return PREF_BAWAAN
  let isi = raw
  try { isi = decodeURIComponent(raw) } catch { /* biarkan apa adanya */ }
  const [terang, gelap, ukuran] = isi.split('|')
  return normalisasiPref({ terang, gelap, ukuran })
}

export function tulisCookieSuasana(p: PrefTampilan): string {
  return `${p.terang}|${p.gelap}|${p.ukuran}`
}

/**
 * Skrip <head> — dijalankan sebelum lukisan pertama, sebelum skrip next-themes.
 * Hanya memasang atribut untuk nilai yang BUKAN bawaan, jadi tanpa cookie
 * halaman persis seperti sebelum fitur ini ada.
 *
 * "Tetap terang": bila mode masih mengikuti perangkat ('system' atau belum
 * pernah dipilih), mode dipaku ke 'light' lewat kunci localStorage milik
 * next-themes. Pilihan manual lewat tombol mode tetap dihormati.
 */
export const SKRIP_SUASANA = `(function(){try{var m=document.cookie.match(/(?:^|; )${COOKIE_SUASANA}=([^;]*)/);if(!m)return;var p=decodeURIComponent(m[1]).split('|'),d=document.documentElement;if(${JSON.stringify(SUASANA_TERANG.filter(s => s !== 'teduh'))}.indexOf(p[0])>-1)d.setAttribute('data-suasana-terang',p[0]);if(${JSON.stringify(SUASANA_GELAP.filter(s => s !== 'malam'))}.indexOf(p[1])>-1)d.setAttribute('data-suasana-gelap',p[1]);if(p[2]==='kecil'||p[2]==='besar')d.setAttribute('data-ukuran',p[2]);if(p[1]==='terang'){var s=localStorage.getItem('theme');if(!s||s==='system'){localStorage.setItem('theme','light');localStorage.setItem('${KUNCI_PAKSA_TERANG}','1')}}}catch(e){}})()`

/**
 * Terapkan seketika di peramban (dipakai halaman Tampilan): pasang atribut di
 * <html> dan tulis cookie, supaya halaman berikutnya sudah benar sejak awal.
 */
export function terapkanPrefDiPeramban(p: PrefTampilan) {
  if (typeof document === 'undefined') return
  const d = document.documentElement
  if (p.terang === 'teduh') d.removeAttribute('data-suasana-terang')
  else d.setAttribute('data-suasana-terang', p.terang)
  if (p.gelap === 'senja') d.setAttribute('data-suasana-gelap', p.gelap)
  else d.removeAttribute('data-suasana-gelap')
  if (p.ukuran === 'biasa') d.removeAttribute('data-ukuran')
  else d.setAttribute('data-ukuran', p.ukuran)
  const aman = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${COOKIE_SUASANA}=${encodeURIComponent(tulisCookieSuasana(p))}; path=/; max-age=${UMUR_COOKIE_SUASANA}; samesite=lax${aman}`
}

/** Warna pratinjau kartu (field palet desain). */
export interface WarnaSuasana {
  bg: string; fg: string; card: string; muted: string; border: string; soft: string
  primary: string; pfg: string; pwash: string; warm: string; wwash: string
  info: string; iwash: string; danger: string; dwash: string
  side: string; sidefg: string; sidemute: string; sideacc: string
  seri: [string, string]
}

export interface InfoSuasana {
  nama: string
  sub: string
  mode: 'terang' | 'gelap'
  warna: WarnaSuasana
  /** Token CSS di app/globals.css. null = nilai :root (Teduh) / .dark (Tilawah Malam). */
  token: Record<string, string> | null
}

export const SUASANA: Record<Suasana, InfoSuasana> = {
  teduh: {
    nama: "Teduh",
    sub: "Kertas hangat, teal daun-kitab",
    mode: 'terang',
    warna: {"bg": "#F5F2EA", "fg": "#17211F", "card": "#FFFFFF", "muted": "#56625F", "border": "#E4DFD3", "soft": "#EEEAE0", "primary": "#1E5A51", "pfg": "#FFFFFF", "pwash": "#E2EEEA", "warm": "#A9500A", "wwash": "#FBEBDC", "info": "#2E5A8F", "iwash": "#E5EDF7", "danger": "#A8261D", "dwash": "#FAE6E3", "side": "#0E3531", "sidefg": "#E6EFEC", "sidemute": "#9DB8B1", "sideacc": "#21504A", "seri": ["#256B60", "#BC5A0B"]},
    token: null,
  },
  fajar: {
    nama: "Fajar",
    sub: "Langit subuh: krem merah muda, bata, emas",
    mode: 'terang',
    warna: {"bg": "#FAF3EE", "fg": "#26181A", "card": "#FFFFFF", "muted": "#6A5557", "border": "#EEDFD7", "soft": "#F3E7E0", "primary": "#8E3B2A", "pfg": "#FFFFFF", "pwash": "#F6E3DC", "warm": "#8A5F00", "wwash": "#F7ECD2", "info": "#3D5A88", "iwash": "#E6ECF5", "danger": "#A3262A", "dwash": "#F9E2E1", "side": "#3A1A17", "sidefg": "#F6E9E4", "sidemute": "#C2A49C", "sideacc": "#5A2C25", "seri": ["#8E3B2A", "#B07A1C"]},
    token: {
      '--background': '#FAF3EE',
      '--foreground': '#26181A',
      '--card': '#FFFFFF',
      '--card-foreground': '#26181A',
      '--popover': '#FFFFFF',
      '--popover-foreground': '#26181A',
      '--primary': '#8E3B2A',
      '--primary-foreground': '#FFFFFF',
      '--secondary': '#F3E7E0',
      '--muted': '#F3E7E0',
      '--muted-foreground': '#6A5557',
      '--accent': '#F6E3DC',
      '--secondary-foreground': '#6A2C20',
      '--accent-foreground': '#6A2C20',
      '--destructive': '#A3262A',
      '--destructive-foreground': '#FFFFFF',
      '--destructive-wash': '#F9E2E1',
      '--success': '#1E6B4E',
      '--success-foreground': '#FFFFFF',
      '--success-wash': '#E1F0E8',
      '--warning': '#8A5F00',
      '--warning-foreground': '#FFFFFF',
      '--warning-wash': '#F7ECD2',
      '--info': '#3D5A88',
      '--info-foreground': '#FFFFFF',
      '--info-wash': '#E6ECF5',
      '--border': '#EEDFD7',
      '--input': '#E2D4CC',
      '--ring': '#8E3B2A',
      '--chart-1': '#8E3B2A',
      '--chart-2': '#BB897F',
      '--chart-3': '#63291D',
      '--chart-4': '#DDC4BF',
      '--chart-5': '#471E15',
      '--primary-wash': '#F6E3DC',
      '--accent-warm': '#8A5F00',
      '--accent-warm-wash': '#F7ECD2',
      '--seri-1': '#8E3B2A',
      '--seri-2': '#B07A1C',
      '--sidebar': '#3A1A17',
      '--sidebar-foreground': '#F6E9E4',
      '--sidebar-primary': '#FFFFFF',
      '--sidebar-primary-foreground': '#3A1A17',
      '--sidebar-accent': '#5A2C25',
      '--sidebar-accent-foreground': '#FFFFFF',
      '--sidebar-border': 'rgb(255 255 255 / 0.10)',
      '--sidebar-ring': '#BB897F',
    },
  },
  samudra: {
    nama: "Samudra",
    sub: "Biru laut tenang, pasir, karang",
    mode: 'terang',
    warna: {"bg": "#F1F4F6", "fg": "#14202B", "card": "#FFFFFF", "muted": "#4F5E6B", "border": "#DCE3E9", "soft": "#E7ECF0", "primary": "#1D4F7A", "pfg": "#FFFFFF", "pwash": "#E1EBF4", "warm": "#B04A12", "wwash": "#FAE7DA", "info": "#24607A", "iwash": "#E0EEF3", "danger": "#A62B26", "dwash": "#F8E3E2", "side": "#0E2236", "sidefg": "#E4ECF3", "sidemute": "#93A8BC", "sideacc": "#1E3C5A", "seri": ["#1D4F7A", "#B04A12"]},
    token: {
      '--background': '#F1F4F6',
      '--foreground': '#14202B',
      '--card': '#FFFFFF',
      '--card-foreground': '#14202B',
      '--popover': '#FFFFFF',
      '--popover-foreground': '#14202B',
      '--primary': '#1D4F7A',
      '--primary-foreground': '#FFFFFF',
      '--secondary': '#E7ECF0',
      '--muted': '#E7ECF0',
      '--muted-foreground': '#4F5E6B',
      '--accent': '#E1EBF4',
      '--secondary-foreground': '#163B5C',
      '--accent-foreground': '#163B5C',
      '--destructive': '#A62B26',
      '--destructive-foreground': '#FFFFFF',
      '--destructive-wash': '#F8E3E2',
      '--success': '#1E6B4E',
      '--success-foreground': '#FFFFFF',
      '--success-wash': '#E1F0E8',
      '--warning': '#B04A12',
      '--warning-foreground': '#FFFFFF',
      '--warning-wash': '#FAE7DA',
      '--info': '#24607A',
      '--info-foreground': '#FFFFFF',
      '--info-wash': '#E0EEF3',
      '--border': '#DCE3E9',
      '--input': '#D1D8DD',
      '--ring': '#1D4F7A',
      '--chart-1': '#1D4F7A',
      '--chart-2': '#7795AF',
      '--chart-3': '#143755',
      '--chart-4': '#BBCAD7',
      '--chart-5': '#0E283D',
      '--primary-wash': '#E1EBF4',
      '--accent-warm': '#B04A12',
      '--accent-warm-wash': '#FAE7DA',
      '--seri-1': '#1D4F7A',
      '--seri-2': '#B04A12',
      '--sidebar': '#0E2236',
      '--sidebar-foreground': '#E4ECF3',
      '--sidebar-primary': '#FFFFFF',
      '--sidebar-primary-foreground': '#0E2236',
      '--sidebar-accent': '#1E3C5A',
      '--sidebar-accent-foreground': '#FFFFFF',
      '--sidebar-border': 'rgb(255 255 255 / 0.10)',
      '--sidebar-ring': '#7795AF',
    },
  },
  zaitun: {
    nama: "Zaitun",
    sub: "Hijau zaitun, gandum, madu",
    mode: 'terang',
    warna: {"bg": "#F4F2E8", "fg": "#1E2016", "card": "#FFFFFF", "muted": "#5A5C4A", "border": "#E2DFCF", "soft": "#EBE8DA", "primary": "#4B5A1E", "pfg": "#FFFFFF", "pwash": "#E9EDD9", "warm": "#94570B", "wwash": "#F6E8D0", "info": "#355E86", "iwash": "#E3EBF4", "danger": "#A1311F", "dwash": "#F7E3DE", "side": "#232A10", "sidefg": "#EEF0E2", "sidemute": "#ADB38F", "sideacc": "#3A4520", "seri": ["#4B5A1E", "#94570B"]},
    token: {
      '--background': '#F4F2E8',
      '--foreground': '#1E2016',
      '--card': '#FFFFFF',
      '--card-foreground': '#1E2016',
      '--popover': '#FFFFFF',
      '--popover-foreground': '#1E2016',
      '--primary': '#4B5A1E',
      '--primary-foreground': '#FFFFFF',
      '--secondary': '#EBE8DA',
      '--muted': '#EBE8DA',
      '--muted-foreground': '#5A5C4A',
      '--accent': '#E9EDD9',
      '--secondary-foreground': '#384416',
      '--accent-foreground': '#384416',
      '--destructive': '#A1311F',
      '--destructive-foreground': '#FFFFFF',
      '--destructive-wash': '#F7E3DE',
      '--success': '#1E6B4E',
      '--success-foreground': '#FFFFFF',
      '--success-wash': '#E1F0E8',
      '--warning': '#94570B',
      '--warning-foreground': '#FFFFFF',
      '--warning-wash': '#F6E8D0',
      '--info': '#355E86',
      '--info-foreground': '#FFFFFF',
      '--info-wash': '#E3EBF4',
      '--border': '#E2DFCF',
      '--input': '#D7D4C5',
      '--ring': '#4B5A1E',
      '--chart-1': '#4B5A1E',
      '--chart-2': '#939C78',
      '--chart-3': '#343F15',
      '--chart-4': '#C9CEBC',
      '--chart-5': '#262D0F',
      '--primary-wash': '#E9EDD9',
      '--accent-warm': '#94570B',
      '--accent-warm-wash': '#F6E8D0',
      '--seri-1': '#4B5A1E',
      '--seri-2': '#94570B',
      '--sidebar': '#232A10',
      '--sidebar-foreground': '#EEF0E2',
      '--sidebar-primary': '#FFFFFF',
      '--sidebar-primary-foreground': '#232A10',
      '--sidebar-accent': '#3A4520',
      '--sidebar-accent-foreground': '#FFFFFF',
      '--sidebar-border': 'rgb(255 255 255 / 0.10)',
      '--sidebar-ring': '#939C78',
    },
  },
  mushaf: {
    nama: "Mushaf",
    sub: "Kertas mushaf lama, marun, tinta emas",
    mode: 'terang',
    warna: {"bg": "#F5EEDD", "fg": "#22180F", "card": "#FFFCF5", "muted": "#5F5243", "border": "#E6DAC0", "soft": "#EEE4CD", "primary": "#7A1F2B", "pfg": "#FFFFFF", "pwash": "#F3E1DD", "warm": "#7D5A06", "wwash": "#F2E6C4", "info": "#2F5480", "iwash": "#E4EAF2", "danger": "#9B2A1C", "dwash": "#F6E0D8", "side": "#2E0F14", "sidefg": "#F5E9D8", "sidemute": "#C4A98E", "sideacc": "#4E1D24", "seri": ["#7A1F2B", "#A07A1A"]},
    token: {
      '--background': '#F5EEDD',
      '--foreground': '#22180F',
      '--card': '#FFFCF5',
      '--card-foreground': '#22180F',
      '--popover': '#FFFCF5',
      '--popover-foreground': '#22180F',
      '--primary': '#7A1F2B',
      '--primary-foreground': '#FFFFFF',
      '--secondary': '#EEE4CD',
      '--muted': '#EEE4CD',
      '--muted-foreground': '#5F5243',
      '--accent': '#F3E1DD',
      '--secondary-foreground': '#5C1720',
      '--accent-foreground': '#5C1720',
      '--destructive': '#9B2A1C',
      '--destructive-foreground': '#FFFFFF',
      '--destructive-wash': '#F6E0D8',
      '--success': '#1E6B4E',
      '--success-foreground': '#FFFFFF',
      '--success-wash': '#E1F0E8',
      '--warning': '#7D5A06',
      '--warning-foreground': '#FFFFFF',
      '--warning-wash': '#F2E6C4',
      '--info': '#2F5480',
      '--info-foreground': '#FFFFFF',
      '--info-wash': '#E4EAF2',
      '--border': '#E6DAC0',
      '--input': '#DACFB6',
      '--ring': '#7A1F2B',
      '--chart-1': '#7A1F2B',
      '--chart-2': '#AF7980',
      '--chart-3': '#55161E',
      '--chart-4': '#D7BCBF',
      '--chart-5': '#3D1016',
      '--primary-wash': '#F3E1DD',
      '--accent-warm': '#7D5A06',
      '--accent-warm-wash': '#F2E6C4',
      '--seri-1': '#7A1F2B',
      '--seri-2': '#A07A1A',
      '--sidebar': '#2E0F14',
      '--sidebar-foreground': '#F5E9D8',
      '--sidebar-primary': '#FFFFFF',
      '--sidebar-primary-foreground': '#2E0F14',
      '--sidebar-accent': '#4E1D24',
      '--sidebar-accent-foreground': '#FFFFFF',
      '--sidebar-border': 'rgb(255 255 255 / 0.10)',
      '--sidebar-ring': '#AF7980',
    },
  },
  kontras: {
    nama: "Kontras Tinggi",
    sub: "Untuk penglihatan rendah & layar terik",
    mode: 'terang',
    warna: {"bg": "#FFFFFF", "fg": "#000000", "card": "#FFFFFF", "muted": "#2B2B2B", "border": "#1A1A1A", "soft": "#F0F0F0", "primary": "#003D35", "pfg": "#FFFFFF", "pwash": "#DDEFEA", "warm": "#7A2E00", "wwash": "#FBE7D6", "info": "#00336B", "iwash": "#E1EBF7", "danger": "#8A0000", "dwash": "#FBE0E0", "side": "#000000", "sidefg": "#FFFFFF", "sidemute": "#D0D0D0", "sideacc": "#003D35", "seri": ["#003D35", "#A34100"]},
    token: {
      '--background': '#FFFFFF',
      '--foreground': '#000000',
      '--card': '#FFFFFF',
      '--card-foreground': '#000000',
      '--popover': '#FFFFFF',
      '--popover-foreground': '#000000',
      '--primary': '#003D35',
      '--primary-foreground': '#FFFFFF',
      '--secondary': '#F0F0F0',
      '--muted': '#F0F0F0',
      '--muted-foreground': '#2B2B2B',
      '--accent': '#DDEFEA',
      '--secondary-foreground': '#002E28',
      '--accent-foreground': '#002E28',
      '--destructive': '#8A0000',
      '--destructive-foreground': '#FFFFFF',
      '--destructive-wash': '#FBE0E0',
      '--success': '#00552F',
      '--success-foreground': '#FFFFFF',
      '--success-wash': '#DDF0E5',
      '--warning': '#7A2E00',
      '--warning-foreground': '#FFFFFF',
      '--warning-wash': '#FBE7D6',
      '--info': '#00336B',
      '--info-foreground': '#FFFFFF',
      '--info-wash': '#E1EBF7',
      '--border': '#1A1A1A',
      '--input': '#000000',
      '--ring': '#003D35',
      '--chart-1': '#003D35',
      '--chart-2': '#668B86',
      '--chart-3': '#002B25',
      '--chart-4': '#B2C5C2',
      '--chart-5': '#001E1A',
      '--primary-wash': '#DDEFEA',
      '--accent-warm': '#7A2E00',
      '--accent-warm-wash': '#FBE7D6',
      '--seri-1': '#003D35',
      '--seri-2': '#A34100',
      '--sidebar': '#000000',
      '--sidebar-foreground': '#FFFFFF',
      '--sidebar-primary': '#FFFFFF',
      '--sidebar-primary-foreground': '#000000',
      '--sidebar-accent': '#003D35',
      '--sidebar-accent-foreground': '#FFFFFF',
      '--sidebar-border': 'rgb(255 255 255 / 0.20)',
      '--sidebar-ring': '#668B86',
    },
  },
  malam: {
    nama: "Tilawah Malam",
    sub: "Teal malam, tinta mint, emas",
    mode: 'gelap',
    warna: {"bg": "#0E1917", "fg": "#ECEFEA", "card": "#15221F", "muted": "#A3B2AD", "border": "#25332F", "soft": "#1D2B28", "primary": "#6FBFAE", "pfg": "#0B2A27", "pwash": "#1F3A35", "warm": "#E3A93C", "wwash": "#372812", "info": "#8DB4E8", "iwash": "#1A2940", "danger": "#F08A7E", "dwash": "#3A1D1A", "side": "#0A2320", "sidefg": "#E6EFEC", "sidemute": "#8FA9A2", "sideacc": "#1C3F39", "seri": ["#5FBFAE", "#E3A93C"]},
    token: null,
  },
  senja: {
    nama: "Senja",
    sub: "Gelap hangat: coklat kurma, jingga lembut",
    mode: 'gelap',
    warna: {"bg": "#17120F", "fg": "#F1E9E2", "card": "#211A16", "muted": "#B9A89B", "border": "#33291F", "soft": "#2A211B", "primary": "#E9A57A", "pfg": "#2A1408", "pwash": "#3A271C", "warm": "#E6C46B", "wwash": "#3A3018", "info": "#94B6E3", "iwash": "#1C2638", "danger": "#F0897D", "dwash": "#3B1C18", "side": "#100B09", "sidefg": "#EFE3D9", "sidemute": "#A08E80", "sideacc": "#2E221B", "seri": ["#E9A57A", "#E6C46B"]},
    token: {
      '--background': '#17120F',
      '--foreground': '#F1E9E2',
      '--card': '#211A16',
      '--card-foreground': '#F1E9E2',
      '--popover': '#211A16',
      '--popover-foreground': '#F1E9E2',
      '--primary': '#E9A57A',
      '--primary-foreground': '#2A1408',
      '--secondary': '#2A211B',
      '--muted': '#2A211B',
      '--muted-foreground': '#B9A89B',
      '--accent': '#3A271C',
      '--secondary-foreground': '#F1E9E2',
      '--accent-foreground': '#F1E9E2',
      '--destructive': '#F0897D',
      '--destructive-foreground': '#301B19',
      '--destructive-wash': '#3B1C18',
      '--success': '#7CCB9E',
      '--success-foreground': '#0E2418',
      '--success-wash': '#173026',
      '--warning': '#E6C46B',
      '--warning-foreground': '#231D10',
      '--warning-wash': '#3A3018',
      '--info': '#94B6E3',
      '--info-foreground': '#161B22',
      '--info-wash': '#1C2638',
      '--border': '#33291F',
      '--input': '#433A31',
      '--ring': '#E9A57A',
      '--chart-1': '#E9A57A',
      '--chart-2': '#AF7C5C',
      '--chart-3': '#F2C9AF',
      '--chart-4': '#694A37',
      '--chart-5': '#F8E4D7',
      '--primary-wash': '#3A271C',
      '--accent-warm': '#E6C46B',
      '--accent-warm-wash': '#3A3018',
      '--seri-1': '#E9A57A',
      '--seri-2': '#E6C46B',
      '--sidebar': '#100B09',
      '--sidebar-foreground': '#EFE3D9',
      '--sidebar-primary': '#E9A57A',
      '--sidebar-primary-foreground': '#2A1408',
      '--sidebar-accent': '#2E221B',
      '--sidebar-accent-foreground': '#FFFFFF',
      '--sidebar-border': 'rgb(255 255 255 / 0.08)',
      '--sidebar-ring': '#E9A57A',
    },
  },
}
