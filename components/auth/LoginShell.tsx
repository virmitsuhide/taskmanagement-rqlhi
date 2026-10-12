'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Info, KeyRound, UserRound } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Kerangka tampilan halaman masuk (pengurus, guru, karyawan) — desain Teduh.
 *
 * Murni presentasional: aksi server, state error, dan status pending tetap
 * dimiliki tiap halaman. Desktop: panel teal berisi hadits di kiri dengan
 * gambar di bagian bawahnya, formulir di kanan. HP: blok hadits di atas
 * (gambar yang sama sebagai latar redup), formulir di bawah. Gambarnya per
 * pintu masuk lewat prop `gambar` — lihat GAMBAR di bawah.
 */

/** Gambar panel per pintu masuk: pengurus = fajar, guru = halaqah, karyawan = mushaf. */
const GAMBAR = {
  fajar: {
    src: '/images/login-santri-fajar.webp',
    alt: 'Seorang santri membawa kitab memandang pegunungan saat matahari terbit',
    posisi: 'object-[60%_center]',
    posisiHp: 'object-[60%_40%]',
  },
  halaqah: {
    src: '/images/login-halaqah.webp',
    alt: 'Seorang ustadz membimbing anak-anak membaca Al-Qur’an di halaqah',
    posisi: 'object-[35%_center]',
    posisiHp: 'object-[40%_30%]',
  },
  mushaf: {
    src: '/images/login-mushaf-tasbih.webp',
    alt: 'Mushaf bersampul hijau keemasan dengan tasbih di atasnya, diterangi cahaya jendela',
    posisi: 'object-center',
    posisiHp: 'object-[50%_60%]',
  },
} as const
export type GambarMasuk = keyof typeof GAMBAR

const HADITS = 'Sebaik-baik kalian adalah yang mempelajari Al-Qur’an dan mengajarkannya.'

export function LoginShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  gambar = 'fajar',
}: {
  gambar?: GambarMasuk
  eyebrow: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const g = GAMBAR[gambar]
  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Panel hadits — desktop */}
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#0E3531] text-white md:flex md:flex-col md:p-12 lg:p-14">
        {/* Gambar mengisi ~62% bawah panel; gradasi teal menyatukannya dengan blok kutipan. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%]">
          <Image src={g.src} alt={g.alt} fill priority sizes="50vw" className={cn('object-cover', g.posisi)} />
          <div aria-hidden className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-[#0E3531] via-[#0E3531]/70 to-transparent" />
        </div>
        <Merek />
        <figure className="relative mt-[clamp(2.5rem,7vh,5rem)] max-w-md">
          <blockquote className="font-heading text-[32px] italic leading-[1.35] lg:text-[36px]">
            &ldquo;{HADITS}&rdquo;
          </blockquote>
          <figcaption className="mt-5 text-xs text-white/75">HR. Bukhari</figcaption>
        </figure>
      </aside>

      {/* Blok hadits — HP: gambar yang sama sebagai latar, diredupkan supaya teks terbaca. */}
      <header className="relative overflow-hidden bg-[#0E3531] px-6 pb-6 pt-10 text-white md:hidden">
        <Image src={g.src} alt="" fill priority sizes="100vw" className={cn('object-cover', g.posisiHp)} />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#0E3531]/90 via-[#0E3531]/80 to-[#0E3531]/60" />
        <div className="relative">
          <Merek kecil />
          <blockquote className="mt-4 font-heading text-xl italic leading-snug">
            &ldquo;{HADITS}&rdquo;
          </blockquote>
          <p className="mt-2 text-[11px] text-white/75">HR. Bukhari</p>
        </div>
      </header>

      <main className="flex items-start justify-center px-6 py-7 md:items-center md:px-10 md:py-12">
        <div className="w-full max-w-[400px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-warm">{eyebrow}</p>
          <h1 className="mt-1.5 font-heading text-[28px] leading-[1.15] md:text-[34px]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}

          <div className="mt-5">{children}</div>

          {footer && <div className="mt-6 border-t pt-5">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

function Merek({ kecil }: { kecil?: boolean }) {
  return (
    <Link href="/" className="relative inline-flex items-center gap-3">
      <span className={cn('inline-flex items-center justify-center rounded-xl bg-white/10 p-1', kecil ? 'h-9 w-9' : 'h-11 w-11')}>
        <Logo variant="mark" size={kecil ? 28 : 36} alt="" priority />
      </span>
      <span className="leading-tight">
        <span className={cn('block font-heading', kecil ? 'text-lg' : 'text-xl')}>Rumah Qur&rsquo;an</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">LHI</span>
      </span>
    </Link>
  )
}

/** Kolom username + kata sandi (dengan tombol Tampilkan yang murni di peramban). */
export function LoginFields({
  disabled,
  usernamePlaceholder,
}: {
  disabled?: boolean
  usernamePlaceholder?: string
}) {
  const [lihat, setLihat] = useState(false)
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="username" className="font-bold">Username</Label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="username"
            name="username"
            type="text"
            placeholder={usernamePlaceholder}
            autoComplete="username"
            required
            disabled={disabled}
            className="h-12 rounded-xl pl-10 text-base"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="font-bold">Kata sandi</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={lihat ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={disabled}
            className="h-12 rounded-xl pl-10 pr-24 text-base"
          />
          <button
            type="button"
            onClick={() => setLihat(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary-wash"
            aria-pressed={lihat}
            aria-controls="password"
          >
            {lihat ? 'Sembunyikan' : 'Tampilkan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LoginError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-destructive-wash px-4 py-3 text-sm font-medium text-destructive">
      {message}
    </p>
  )
}

export function LoginSubmit({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? 'Memuat...' : <>Masuk <ArrowUpRight className="h-4 w-4" /></>}
    </button>
  )
}

export function LoginHelp() {
  return (
    <p className="flex items-start gap-2.5 px-1 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-warm" />
      <span>Lupa sandi? Minta admin atau pengurus yang mengelola akun untuk mereset.</span>
    </p>
  )
}

/** Baris tautan silang ("Bukan guru? Masuk sebagai …") + kembali ke beranda. */
export function LoginLinks({
  label,
  links,
}: {
  label: string
  links: { href: string; label: string }[]
}) {
  return (
    <div className="space-y-4 text-center md:text-left">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2 md:justify-start">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-xs font-bold hover:bg-muted"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <p>
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← Kembali ke beranda
        </Link>
      </p>
    </div>
  )
}
