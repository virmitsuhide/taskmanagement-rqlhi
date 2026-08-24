import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Inisial dua huruf dari sebuah nama, untuk avatar.
 *
 * Gelar akademik ikut terbawa di data guru ("Afifah Nurlaila, S.E."), jadi
 * koma dan isinya dibuang dulu — tanpa itu inisialnya jadi "AS", bukan "AN".
 */
export function initials(name: string): string {
  return name
    .split(',')[0]
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}
