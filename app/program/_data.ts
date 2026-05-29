import type { LucideIcon } from 'lucide-react'
import { BookOpen, Layers, GraduationCap, Zap, Users, Briefcase, Star } from 'lucide-react'

export interface ProgramDef {
  slug: string
  title: string
  description: string
  icon: LucideIcon
  accent: string
  iconColor: string
  iconBg: string
}

export const PROGRAMS: ProgramDef[] = [
  {
    slug: 'tahsin-ummi',
    title: 'Tahsin Metode UMMI',
    description: "Program tahsin Al-Qur'an menggunakan metode UMMI yang terstruktur dan terarah untuk semua usia",
    icon: BookOpen,
    accent: 'bg-emerald-500',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
  },
  {
    slug: 'tahsin-syajaroh',
    title: 'Tahsin Metode Syajaroh',
    description: "Program tahsin Al-Qur'an dengan pendekatan metode Syajaroh yang holistik dan komprehensif",
    icon: Layers,
    accent: 'bg-teal-500',
    iconColor: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-50 dark:bg-teal-950/50',
  },
  {
    slug: 'labschool',
    title: "Qur'anic Labschool",
    description: "Program unggulan berbasis Al-Qur'an untuk jenjang SD dan SMP dengan kurikulum terintegrasi",
    icon: GraduationCap,
    accent: 'bg-blue-500',
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-950/50',
  },
  {
    slug: 'ekstra-rq',
    title: 'Ekstra RQ',
    description: "Kegiatan ekstrakurikuler berbasis Rumah Qur'an untuk pengembangan potensi dan bakat diri",
    icon: Zap,
    accent: 'bg-violet-500',
    iconColor: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-50 dark:bg-violet-950/50',
  },
  {
    slug: 'pembinaan-guru',
    title: 'Pembinaan Guru SIT LHI',
    description: 'Program pembinaan dan pengembangan kompetensi tenaga pengajar SIT LHI',
    icon: Users,
    accent: 'bg-amber-500',
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/50',
  },
  {
    slug: 'karyawan',
    title: 'Pembinaan Karyawan SIT LHI',
    description: 'Program pengembangan dan pemberdayaan karyawan SIT LHI',
    icon: Briefcase,
    accent: 'bg-sky-500',
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-50 dark:bg-sky-950/50',
  },
  {
    slug: 'guru-quran',
    title: "Pembinaan Guru Qur'an",
    description: "Program khusus peningkatan kualitas dan kapasitas Guru Qur'an Rumah Qur'an LHI",
    icon: Star,
    accent: 'bg-rose-500',
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-50 dark:bg-rose-950/50',
  },
]

export function findProgram(slug: string): ProgramDef | undefined {
  return PROGRAMS.find(p => p.slug === slug)
}
