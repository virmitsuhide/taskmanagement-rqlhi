'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import { logoutTeacherAction } from '@/app/actions/teacher-auth'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '@/lib/utils'

/**
 * Navigasi Portal Guru — sidebar di layar lebar, laci di layar sempit.
 *
 * KENAPA PINDAH DARI HEADER
 *
 * Menunya tumbuh jadi sembilan, dan dua di antaranya hanya muncul untuk
 * sebagian guru sehingga panjang barisnya berubah dari orang ke orang. Deretan
 * mendatar sepanjang itu memaksa nama menu dipendekkan sampai ambigu dan tetap
 * tidak muat di laptop 13 inci. Kolom tegak punya ruang tak terbatas ke bawah,
 * dan yang lebih penting: ia bisa DIKELOMPOKKAN. Sembilan tautan sejajar harus
 * dibaca satu per satu; sembilan tautan dalam tiga kelompok bernama bisa
 * dipindai sekali lihat.
 *
 * KENAPA KOMPONEN INI MEMBUNGKUS ISI HALAMAN
 *
 * Bilah atas untuk layar sempit harus berada DI DALAM kolom isi supaya ia
 * menempel di atas saat halaman digulung. Kalau ia bersebelahan dengan sidebar
 * sebagai sesama anak flex-row, di layar sempit ia akan berdiri sebagai kolom
 * sendiri di samping isinya. Karena keadaan buka-tutup laci dipegang komponen
 * ini, membungkus `children` lebih sederhana daripada memecahnya jadi dua
 * komponen yang harus berbagi state lewat context.
 *
 * KENAPA `active` TIDAK LAGI DIOPER TIAP HALAMAN
 *
 * Dulu tiap halaman menuliskan sendiri `active="siswa"` — tiga belas tempat
 * yang harus ingat menyebutkan nilainya dengan benar, dan halaman gukar memang
 * lupa sehingga menunya tidak pernah menyala. Sekarang diturunkan dari
 * pathname: halaman baru menyalakan menu yang tepat tanpa mengingat apa pun.
 */

export interface TeacherNavItem {
  label: string
  href: string
  icon: React.ReactNode
  /**
   * Menyala hanya pada alamat yang sama persis, bukan pada anak-anaknya.
   * Dipakai beranda portal: '/guru' adalah awalan SETIAP alamat portal, jadi
   * tanpa ini ia menyala di halaman mana pun yang tidak punya menunya sendiri.
   */
  exact?: boolean
  /**
   * Angka kecil di ujung kanan menu — jumlah yang menunggu perhatian.
   * 0 atau tidak diisi berarti tidak ada lencana sama sekali; lencana bertulis
   * "0" memberi tahu bahwa tidak ada yang perlu dikerjakan, dan itu justru
   * membuat orang berhenti membaca lencananya.
   */
  badge?: number
}

export interface TeacherNavGroup {
  /** Null = kelompok tanpa judul (dipakai kelompok pertama). */
  title: string | null
  items: TeacherNavItem[]
}

interface Props {
  /** Lonceng pengumuman — dioper dari server supaya datanya ikut ter-render. */
  bell?: React.ReactNode
  fullName: string
  groups: TeacherNavGroup[]
  children: React.ReactNode
}

/**
 * Menu mana yang menyala untuk sebuah pathname.
 *
 * Dipilih tautan dengan href TERPANJANG yang cocok, bukan yang pertama cocok:
 * '/guru/siswa/<id>' harus menyalakan "Siswa Saya", bukan beranda.
 *
 * Itu saja belum cukup. Menu yang hanya dimiliki sebagian guru (Pengajuan
 * Ujian, Pembinaan Gukar) tidak ada di daftar milik guru lain — dan ketika
 * mereka membuka alamatnya, tak satu pun tautan cocok kecuali '/guru', yang
 * lalu menyalakan beranda di halaman yang jelas bukan beranda. Karena itu
 * beranda ditandai `exact`.
 */
function hrefAktif(pathname: string, groups: TeacherNavGroup[]): string | null {
  let terbaik: string | null = null
  for (const g of groups) {
    for (const { href, exact } of g.items) {
      const cocok = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
      if (cocok && (terbaik === null || href.length > terbaik.length)) terbaik = href
    }
  }
  return terbaik
}

export function TeacherNav({ fullName, groups, bell, children }: Props) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const aktif = hrefAktif(pathname, groups)
  const judulAktif = groups.flatMap(g => g.items).find(i => i.href === aktif)?.label ?? null

  // Halaman di belakang laci tidak boleh ikut tergulung saat laci terbuka.
  useEffect(() => {
    if (!drawerOpen) return
    const asal = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = asal }
  }, [drawerOpen])

  const isiNav = (
    <>
      <div className="px-3 py-4">
        <Link
          href="/guru"
          className="flex items-center gap-2 text-base font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          <Logo size={30} alt="" />
          <span>RQ <span style={{ color: 'var(--primary)' }}>LHI</span></span>
        </Link>
        <span
          className="mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px]"
          style={{ borderColor: 'var(--border)', background: 'var(--primary-wash)', color: 'var(--primary)' }}
        >
          Portal Guru
        </span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-4">
        {groups.map((g, gi) => (
          <div key={g.title ?? `g${gi}`}>
            {g.title && (
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {g.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {g.items.map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    // Laci ditutup di sini, bukan dengan mengintai pathname:
                    // menutup sebagai tanggapan atas ketukan adalah sebab yang
                    // sebenarnya, dan tidak memicu render ulang berantai.
                    onClick={() => setDrawerOpen(false)}
                    aria-current={aktif === item.href ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                      aktif === item.href
                        ? 'bg-accent font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                                      >
                    <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
                    {item.label}
                    {item.badge ? (
                      <span className="ml-auto min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-primary-foreground">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border)' }}>
        <p className="mb-2 truncate text-sm font-medium" title={fullName}>{fullName}</p>
        <form action={logoutTeacherAction}>
          <Button type="submit" variant="outline" size="sm" className="w-full justify-start">
            <LogOut className="mr-2 h-4 w-4" />Keluar
          </Button>
        </form>
      </div>
    </>
  )

  return (
    // Saat dicetak, tinggi tetap & gulungan internal dilepas — tanpa itu
    // browser hanya mencetak sepotong yang muat di kotak setinggi layar.
    <div className="flex min-h-screen md:h-screen md:overflow-hidden print:block print:h-auto print:overflow-visible">
      <a
        href="#isi-utama"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md"
      >
        Lewati ke konten utama
      </a>

      {/* Sidebar tetap — layar lebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex print:hidden">
        {isiNav}
      </aside>

      {/* Kolom isi; bilah atas mobile ikut di dalamnya supaya bisa melekat */}
      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">
        {/*
          Bilah atas Portal Guru — sengaja sebentuk dengan DashboardHeader milik
          pengurus: tinggi h-14, garis bawah, latar tembus dengan backdrop blur.
          Bedanya judulnya diturunkan dari menu yang sedang aktif, bukan dioper
          tiap halaman: portal guru punya dua belas halaman yang semuanya sudah
          menulis judulnya sendiri di badan, dan menyuruh tiap halaman mengoper
          judul untuk kedua kalinya hanya menambah tempat untuk lupa.
        */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 print:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu"
            aria-expanded={drawerOpen}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            href="/guru"
            className="flex min-w-0 items-center gap-2 text-base font-extrabold tracking-tight md:hidden"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            <Logo size={26} alt="" />
            <span className="truncate">RQ <span style={{ color: 'var(--primary)' }}>LHI</span></span>
          </Link>

          <p className="hidden min-w-0 flex-1 truncate px-1 text-sm font-medium md:block">
            {judulAktif ?? 'Portal Guru'}
          </p>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">
              {fullName}
            </span>
            {bell}
            <ThemeToggle />
          </div>
        </header>

        <main
          id="isi-utama"
          tabIndex={-1}
          className="flex-1 outline-none md:overflow-y-auto print:overflow-visible"
        >
          {children}
        </main>
      </div>

      {/* Laci — layar sempit */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden print:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div
            className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r bg-sidebar text-sidebar-foreground shadow-xl"
            
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Tutup menu"
              className="absolute right-2 top-3 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            {isiNav}
          </div>
        </div>
      )}
    </div>
  )
}
