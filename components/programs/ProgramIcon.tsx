import { createElement } from 'react'
import { programIcon } from '@/lib/programs/theme'

interface Props {
  /** Kunci ikon dari DB, mis. 'BookOpen'. Kunci tak dikenal jatuh ke default. */
  icon: string
  className?: string
}

/**
 * Merender ikon program dari kunci yang tersimpan di DB.
 *
 * Pemilihan komponennya dilakukan lewat `createElement`, bukan
 * `const Icon = programIcon(k)` lalu `<Icon />`. Keduanya berjalan sama, tapi
 * bentuk yang kedua terbaca oleh aturan react-hooks/static-components sebagai
 * "membuat komponen saat render" — pola yang biasanya menandakan bug remount.
 * Membungkusnya di sini membuat pemanggilnya cukup memakai satu komponen tetap.
 */
export function ProgramIcon({ icon, className }: Props) {
  return createElement(programIcon(icon), { className })
}
