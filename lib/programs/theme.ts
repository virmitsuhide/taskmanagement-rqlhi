import {
  BookOpen, Layers, GraduationCap, Zap, Users, Briefcase, Star,
  Heart, Mic, Palette, Trophy, Sparkles, Compass, HandHeart,
  type LucideIcon,
} from 'lucide-react'
import type { ProgramAccent } from '@/types'

/**
 * Ikon & warna program disimpan di DB sebagai kunci, lalu dipetakan ke kelas
 * Tailwind di sini.
 *
 * Alasannya: Tailwind memindai kode sumber untuk menentukan kelas mana yang
 * ikut di-bundle. Kelas yang dirakit saat runtime (`bg-${warna}-500`) tidak
 * pernah terlihat olehnya dan akan hilang dari CSS akhir. Menuliskannya utuh
 * di peta ini membuat semuanya ikut ter-bundle.
 */

export const PROGRAM_ICONS: Record<string, LucideIcon> = {
  BookOpen, Layers, GraduationCap, Zap, Users, Briefcase, Star,
  Heart, Mic, Palette, Trophy, Sparkles, Compass, HandHeart,
}

export const PROGRAM_ICON_KEYS = Object.keys(PROGRAM_ICONS)

export function programIcon(key: string): LucideIcon {
  return PROGRAM_ICONS[key] ?? BookOpen
}

interface AccentClasses {
  label: string
  /** Garis tipis di atas kartu */
  bar: string
  iconBg: string
  iconColor: string
  /** Gradasi latar saat program belum punya foto */
  gradient: string
  /** Titik warna untuk pemilih di form */
  dot: string
}

export const PROGRAM_ACCENTS: Record<ProgramAccent, AccentClasses> = {
  emerald: {
    label: 'Emerald',
    bar: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    dot: 'bg-emerald-500',
  },
  teal: {
    label: 'Teal',
    bar: 'bg-teal-500',
    iconBg: 'bg-teal-50 dark:bg-teal-950/50',
    iconColor: 'text-teal-600 dark:text-teal-400',
    gradient: 'from-teal-500/20 to-teal-500/5',
    dot: 'bg-teal-500',
  },
  blue: {
    label: 'Biru',
    bar: 'bg-blue-500',
    iconBg: 'bg-blue-50 dark:bg-blue-950/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-500/20 to-blue-500/5',
    dot: 'bg-blue-500',
  },
  violet: {
    label: 'Violet',
    bar: 'bg-violet-500',
    iconBg: 'bg-violet-50 dark:bg-violet-950/50',
    iconColor: 'text-violet-600 dark:text-violet-400',
    gradient: 'from-violet-500/20 to-violet-500/5',
    dot: 'bg-violet-500',
  },
  amber: {
    label: 'Amber',
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-50 dark:bg-amber-950/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
    gradient: 'from-amber-500/20 to-amber-500/5',
    dot: 'bg-amber-500',
  },
  sky: {
    label: 'Langit',
    bar: 'bg-sky-500',
    iconBg: 'bg-sky-50 dark:bg-sky-950/50',
    iconColor: 'text-sky-600 dark:text-sky-400',
    gradient: 'from-sky-500/20 to-sky-500/5',
    dot: 'bg-sky-500',
  },
  rose: {
    label: 'Rose',
    bar: 'bg-rose-500',
    iconBg: 'bg-rose-50 dark:bg-rose-950/50',
    iconColor: 'text-rose-600 dark:text-rose-400',
    gradient: 'from-rose-500/20 to-rose-500/5',
    dot: 'bg-rose-500',
  },
}

export const PROGRAM_ACCENT_KEYS = Object.keys(PROGRAM_ACCENTS) as ProgramAccent[]

export function programAccent(key: string): AccentClasses {
  return PROGRAM_ACCENTS[key as ProgramAccent] ?? PROGRAM_ACCENTS.emerald
}

/** Ubah judul jadi slug URL: "Tahsin Metode UMMI" → "tahsin-metode-ummi". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
