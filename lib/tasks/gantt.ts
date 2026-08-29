import type { Task, TaskSubtask, TaskStatus, SubtaskStatus } from '@/types'

/**
 * Perhitungan garis waktu (Gantt) untuk tugas & rinciannya.
 *
 * Semua di sini murni: tidak menyentuh database, tidak membaca sesi. Lapisan
 * data (lib/data/gantt.ts) yang mengambil baris, modul ini yang memutuskan
 * batang mulai di mana dan berakhir di mana.
 *
 * SEMUA TANGGAL ADALAH 'YYYY-MM-DD' TANPA ZONA WAKTU
 *
 * Kolom tanggal di Postgres bertipe `date` dan tidak punya jam. Kalau string
 * itu dilempar ke `new Date('2026-08-29')`, JavaScript membacanya sebagai UTC
 * tengah malam lalu menampilkannya di zona lokal — di WIB (UTC+7) hasilnya
 * tetap 29 Agustus, tapi di zona barat Greenwich ia mundur jadi 28 Agustus dan
 * seluruh batang bergeser satu hari. Karena itu tanggal di modul ini diurai
 * sendiri per komponen (lihat parseDay) dan tidak pernah lewat Date.parse.
 */

// ─── Aritmetika tanggal ──────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000

/** 'YYYY-MM-DD' → Date pada tengah hari lokal (aman dari pergeseran DST). */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Date → 'YYYY-MM-DD' menurut kalender lokal. */
export function formatDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Timestamp apa pun (termasuk created_at yang berjam) → 'YYYY-MM-DD'. */
export function toDay(value: string): string {
  return value.slice(0, 10)
}

export function today(): string {
  return formatDay(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = parseDay(iso)
  d.setDate(d.getDate() + n)
  return formatDay(d)
}

/** Selisih hari b − a. Positif kalau b sesudah a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / MS_PER_DAY)
}

const minDay = (a: string | null, b: string | null) =>
  a === null ? b : b === null ? a : a < b ? a : b
const maxDay = (a: string | null, b: string | null) =>
  a === null ? b : b === null ? a : a > b ? a : b

// ─── Rentang satu batang ─────────────────────────────────────────────────────

export interface DayRange {
  start: string
  end: string
  /** true = tidak ada satu pun tanggal asli; rentangnya ditebak dari created_at. */
  inferred: boolean
}

/**
 * Rentang batang sebuah rincian.
 *
 * Rincian boleh hanya punya tenggat — itu kasus paling umum: orang mengetik
 * langkah lalu memberinya deadline, tanpa memikirkan kapan mulainya. Batang
 * satu hari di tanggal tenggat lebih jujur daripada menarik garis panjang dari
 * tanggal yang tidak pernah ditentukan siapa pun.
 */
export function subtaskRange(sub: TaskSubtask): DayRange | null {
  if (!sub.start_date && !sub.due_date) return null
  const start = sub.start_date ?? sub.due_date!
  const end = sub.due_date ?? sub.start_date!
  return { start, end: end < start ? start : end, inferred: false }
}

/**
 * Rentang batang tugas induk — ini aturan rollup-nya.
 *
 * Induk membentang selebar seluruh rincian yang dikandungnya, karena tugas
 * belum benar-benar selesai selama masih ada langkah yang tenggatnya lewat dari
 * tenggat induk. Kalau rincian melewati due_date induk, batang induk ikut
 * memanjang — itulah sinyal visual bahwa rencananya sudah tidak muat.
 *
 * Tanggal induk sendiri tetap dihormati sebagai batas terluar yang lain: tugas
 * yang dijadwalkan mulai 1 Oktober tidak ditarik mundur hanya karena satu
 * rinciannya belum bertanggal.
 *
 * Kalau tidak ada tanggal sama sekali (tugas lama, dibuat sebelum migrasi 0041),
 * batangnya ditempatkan pada tanggal tugas dibuat dan ditandai `inferred` supaya
 * UI bisa menggambarnya putus-putus — pembaca berhak tahu itu tebakan.
 */
export function taskRange(task: Task, subs: TaskSubtask[] = []): DayRange {
  let start = task.start_date ?? null
  let end = task.due_date ?? null

  for (const s of subs) {
    const r = subtaskRange(s)
    if (!r) continue
    start = minDay(start, r.start)
    end = maxDay(end, r.end)
  }

  if (start === null && end === null) {
    const created = toDay(task.created_at)
    return { start: created, end: created, inferred: true }
  }

  const s = (start ?? end)!
  const e = (end ?? start)!
  return { start: s, end: e < s ? s : e, inferred: false }
}

// ─── Kemajuan ────────────────────────────────────────────────────────────────

export interface Progress {
  done: number
  total: number
  percent: number
  /** true = angkanya dari status tugas induk, bukan dari hitungan rincian. */
  fromStatus: boolean
}

/** Perkiraan kemajuan untuk tugas tanpa rincian — dibaca dari kolom kanbannya. */
const STATUS_PERCENT: Record<TaskStatus, number> = {
  todo: 0,
  returned: 10,
  problem: 25,
  in_progress: 50,
  submitted: 90,
  done: 100,
}

/**
 * Kemajuan sebuah tugas.
 *
 * Kalau ada rincian, angkanya dihitung dari sana: rincian yang sedang berjalan
 * dihargai setengah, supaya tugas dengan tiga langkah yang semuanya sedang
 * dikerjakan tidak terbaca 0%. Kalau tidak ada rincian sama sekali, kemajuan
 * diturunkan dari status kanban — satu-satunya sinyal yang tersedia.
 */
export function taskProgress(task: Task, subs: TaskSubtask[] = []): Progress {
  if (subs.length === 0) {
    return { done: 0, total: 0, percent: STATUS_PERCENT[task.status] ?? 0, fromStatus: true }
  }
  const done = subs.filter(s => s.status === 'done').length
  const running = subs.filter(s => s.status === 'in_progress').length
  const percent = Math.round(((done + running * 0.5) / subs.length) * 100)
  return { done, total: subs.length, percent, fromStatus: false }
}

// ─── Skala & sumbu waktu ─────────────────────────────────────────────────────

export type GanttScale = 'hari' | 'minggu' | 'bulan'

export const GANTT_SCALES: { key: GanttScale; label: string }[] = [
  { key: 'hari', label: 'Harian' },
  { key: 'minggu', label: 'Mingguan' },
  { key: 'bulan', label: 'Bulanan' },
]

export function parseScale(value: string | undefined): GanttScale {
  return value === 'minggu' || value === 'bulan' ? value : 'hari'
}

/** Lebar satu hari dalam piksel per skala — dipakai header & batang bersama. */
const PX_PER_DAY: Record<GanttScale, number> = {
  hari: 34,
  minggu: 13,
  bulan: 4.2,
}

/** Bantalan kiri/kanan (hari) supaya batang tidak menempel di tepi kanvas. */
const PADDING_DAYS: Record<GanttScale, number> = {
  hari: 2,
  minggu: 5,
  bulan: 12,
}

export interface GanttTick {
  key: string
  label: string
  /** Label kecil di atas label utama, mis. nama hari pada skala harian. */
  sub?: string
  widthPx: number
  /** Sabtu/Ahad — dipakai mengarsir kolom akhir pekan pada skala harian. */
  weekend?: boolean
  /** Tick yang memuat hari ini. */
  isToday?: boolean
}

export interface Timeline {
  scale: GanttScale
  start: string
  end: string
  totalDays: number
  widthPx: number
  pxPerDay: number
  ticks: GanttTick[]
  /** Posisi garis "hari ini" dalam px; null kalau di luar rentang. */
  todayPx: number | null
}

const HARI = ['Ahad', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Susun sumbu waktu yang memuat semua rentang, plus hari ini.
 *
 * Hari ini selalu ikut dimasukkan walau tidak ada tugas di sekitarnya: Gantt
 * yang tidak menampilkan "sekarang" tidak bisa menjawab pertanyaan yang membuat
 * orang membukanya — mana yang telat, mana yang jalan minggu ini.
 */
export function buildTimeline(ranges: DayRange[], scale: GanttScale): Timeline {
  const now = today()
  let min: string | null = now
  let max: string | null = now
  for (const r of ranges) {
    min = minDay(min, r.start)
    max = maxDay(max, r.end)
  }

  const pad = PADDING_DAYS[scale]
  let start = addDays(min!, -pad)
  let end = addDays(max!, pad)

  // Skala mingguan/bulanan dirapikan ke awal minggu (Senin) / awal bulan,
  // supaya label kolomnya jatuh di batas yang wajar dibaca.
  if (scale === 'minggu') {
    const d = parseDay(start)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    start = formatDay(d)
  } else if (scale === 'bulan') {
    const d = parseDay(start)
    start = formatDay(new Date(d.getFullYear(), d.getMonth(), 1, 12))
    const e = parseDay(end)
    end = formatDay(new Date(e.getFullYear(), e.getMonth() + 1, 0, 12))
  }

  const totalDays = Math.max(1, daysBetween(start, end) + 1)
  const pxPerDay = PX_PER_DAY[scale]

  const ticks: GanttTick[] = []
  if (scale === 'hari') {
    for (let i = 0; i < totalDays; i++) {
      const iso = addDays(start, i)
      const d = parseDay(iso)
      const dow = d.getDay()
      ticks.push({
        key: iso,
        label: String(d.getDate()),
        sub: d.getDate() === 1 || i === 0 ? BULAN[d.getMonth()] : HARI[dow].slice(0, 1),
        widthPx: pxPerDay,
        weekend: dow === 0 || dow === 6,
        isToday: iso === now,
      })
    }
  } else if (scale === 'minggu') {
    for (let i = 0; i < totalDays; i += 7) {
      const iso = addDays(start, i)
      const span = Math.min(7, totalDays - i)
      const d = parseDay(iso)
      ticks.push({
        key: iso,
        label: `${d.getDate()} ${BULAN[d.getMonth()]}`,
        widthPx: span * pxPerDay,
        isToday: now >= iso && now < addDays(iso, span),
      })
    }
  } else {
    let cursor = start
    while (cursor <= end) {
      const d = parseDay(cursor)
      const lastOfMonth = formatDay(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))
      const tickEnd = lastOfMonth > end ? end : lastOfMonth
      const span = daysBetween(cursor, tickEnd) + 1
      ticks.push({
        key: cursor,
        label: `${BULAN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        widthPx: span * pxPerDay,
        isToday: now >= cursor && now <= tickEnd,
      })
      cursor = addDays(tickEnd, 1)
    }
  }

  const todayOffset = daysBetween(start, now)
  const todayPx =
    todayOffset >= 0 && todayOffset < totalDays ? (todayOffset + 0.5) * pxPerDay : null

  return {
    scale,
    start,
    end,
    totalDays,
    widthPx: totalDays * pxPerDay,
    pxPerDay,
    ticks,
    todayPx,
  }
}

/** Posisi & lebar satu batang di atas sumbu waktu, dalam piksel. */
export function barMetrics(range: DayRange, timeline: Timeline): { leftPx: number; widthPx: number } {
  const offset = daysBetween(timeline.start, range.start)
  const span = daysBetween(range.start, range.end) + 1
  return {
    leftPx: offset * timeline.pxPerDay,
    // Batang satu hari pada skala bulanan cuma ~4px — dipaksa minimal 6px agar
    // tetap terlihat dan tetap bisa disentuh.
    widthPx: Math.max(6, span * timeline.pxPerDay),
  }
}

// ─── Label ───────────────────────────────────────────────────────────────────

export const SUBTASK_STATUS_LABELS: Record<SubtaskStatus, string> = {
  todo: 'Belum mulai',
  in_progress: 'Dikerjakan',
  done: 'Selesai',
}

/** Tanggal singkat untuk tooltip & daftar, mis. "29 Agu 2026". */
export function shortDate(iso: string): string {
  const d = parseDay(iso)
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

/** Rentang untuk tooltip: "3 Okt 2026 – 12 Okt 2026", atau satu tanggal saja. */
export function rangeLabel(r: DayRange): string {
  if (r.start === r.end) return shortDate(r.start)
  return `${shortDate(r.start)} – ${shortDate(r.end)}`
}

/** Sisa hari menuju tenggat; negatif = terlambat. Null kalau tak bertenggat. */
export function daysLeft(due: string | null): number | null {
  return due === null ? null : daysBetween(today(), due)
}
