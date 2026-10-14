import { cn } from '@/lib/utils'

/**
 * Avatar ilustrasi guru: ustadz berpeci, ustadzah berkerudung. Gender belum
 * diketahui → siluet polos, bukan tebakan.
 *
 * SVG inline dengan token warna (bukan gambar), supaya ikut tema gelap dan
 * tetap tercetak tanpa memuat berkas apa pun.
 */
export function AvatarGuru({ gender, className, label }: {
  gender: 'L' | 'P' | null
  className?: string
  /** Nama untuk pembaca layar. */
  label?: string
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={label ? `${gender === 'P' ? 'Ustadzah' : gender === 'L' ? 'Ustadz' : 'Guru'} ${label}` : undefined}
      className={cn('size-12 shrink-0 rounded-full', className)}
    >
      <circle cx="32" cy="32" r="32" fill="var(--primary-wash)" />
      <clipPath id="avatar-guru-bulat"><circle cx="32" cy="32" r="32" /></clipPath>
      <g clipPath="url(#avatar-guru-bulat)">
        {gender === 'P' ? (
          <>
            {/* Kerudung: menutup kepala dan jatuh melebar ke bahu. */}
            <path d="M32 11c-11 0-18 8.5-18 19.5 0 6 2 10.5 4.5 13.5L8 64h48L45.5 44c2.5-3 4.5-7.5 4.5-13.5C50 19.5 43 11 32 11z" fill="var(--primary)" />
            <ellipse cx="32" cy="31" rx="10" ry="11.5" fill="var(--card)" />
            <circle cx="28" cy="30" r="1.3" fill="var(--foreground)" />
            <circle cx="36" cy="30" r="1.3" fill="var(--foreground)" />
            <path d="M28.5 35.5q3.5 2.5 7 0" stroke="var(--foreground)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* Bahu & baju. */}
            <path d="M12 64c0-11 9-17 20-17s20 6 20 17z" fill="var(--primary)" />
            <rect x="28" y="40" width="8" height="8" rx="2" fill="var(--card)" />
            <circle cx="32" cy="31" r="11" fill="var(--card)" />
            <circle cx="28" cy="31" r="1.3" fill="var(--foreground)" />
            <circle cx="36" cy="31" r="1.3" fill="var(--foreground)" />
            <path d="M28.5 36q3.5 2.5 7 0" stroke="var(--foreground)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            {gender === 'L' && (
              // Peci: songkok hitam di atas kepala.
              <path d="M21 24.5c0-5 4.9-8 11-8s11 3 11 8v1.5H21z" fill="var(--foreground)" />
            )}
          </>
        )}
      </g>
    </svg>
  )
}
