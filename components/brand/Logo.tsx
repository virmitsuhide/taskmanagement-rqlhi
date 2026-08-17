import Image from 'next/image'
import logoFull from '@/public/logo.png'
import logoMark from '@/public/logo-mark.png'
import { cn } from '@/lib/utils'

/**
 * Logo resmi Rumah Qur'an LHI.
 *
 * - `mark`  : emblem saja (kubah + pohon + kitab) di atas cakram putih.
 *             Dipakai untuk slot kecil — header, sidebar, favicon-like badge.
 * - `full`  : emblem + wordmark "Rumah Qur'an LHI · Membangun Generasi Qurani".
 *             Hanya untuk slot besar (>= 96px) supaya teksnya terbaca.
 *
 * Keduanya berkanvas persegi dengan cakram putih, jadi aman di latar gelap
 * maupun terang tanpa perlu varian warna terpisah.
 */

const VARIANTS = {
  mark: { src: logoMark, defaultAlt: "Logo Rumah Qur'an LHI" },
  full: { src: logoFull, defaultAlt: "Rumah Qur'an LHI — Membangun Generasi Qurani" },
} as const

interface Props {
  variant?: keyof typeof VARIANTS
  /** Sisi kanvas dalam px (logo selalu persegi). */
  size?: number
  /**
   * Kosongkan (`alt=""`) bila nama lembaga sudah ditulis sebagai teks di
   * sebelah logo — supaya screen reader tidak membacanya dua kali.
   */
  alt?: string
  className?: string
  priority?: boolean
}

export function Logo({ variant = 'mark', size = 40, alt, className, priority }: Props) {
  const { src, defaultAlt } = VARIANTS[variant]

  return (
    <Image
      src={src}
      alt={alt ?? defaultAlt}
      width={size}
      height={size}
      priority={priority}
      className={cn('shrink-0 rounded-full object-contain', className)}
    />
  )
}
