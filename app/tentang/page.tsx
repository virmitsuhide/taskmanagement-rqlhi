import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditAbout } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { Button } from '@/components/ui/button'
import { ArrowRight, BookOpen, FileText, MessageSquareQuote, Pencil, Users } from 'lucide-react'
import type { AboutRq } from '@/types'
import { MISI_RQ, VISI_RQ } from '@/lib/rq/identitas'

/**
 * Tentang RQ — satu halaman bergulir (dulu tiga tab).
 *
 * Visi, misi, dan sejarah tetap dibaca dari about_rq (disunting Humas di
 * /humas/tentang); Tiga Penjagaan dan struktur ditulis tetap karena itu
 * identitas lembaga, bukan isi yang berganti tiap semester. Tautan lama
 * /tentang?tab=… tetap terbuka — parameternya diabaikan, isinya ada semua.
 */

async function getAbout(): Promise<AboutRq | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from('about_rq').select('*').eq('id', 1).maybeSingle()
    return (data as AboutRq | null) ?? null
  } catch {
    return null
  }
}

/** Misi disimpan sebagai teks bebas; tiap baris jadi satu poin, nomor lama dibuang. */
function poinMisi(teks: string | undefined): string[] {
  return (teks ?? '')
    .split(/\r?\n/)
    .map(b => b.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean)
}

const PENJAGAAN = [
  {
    judul: 'Lafadznya', ikon: BookOpen,
    isi: 'Bacaan pokok riwayat Hafs thariq Asy-Syathibiyyah, dikembangkan ke qiro’at ‘asyarah sughra dan kubra, riwayat Nafi’iyyah, hingga keilmuan bacaan para sahabat.',
  },
  {
    judul: 'Tulisannya', ikon: FileText,
    isi: 'Ilmu rasm — mulai dari imla’i dan khat naskhi, hingga kaidah rasm Utsmani Abu ‘Amr Ad-Dani dan Abu Dawud bin Sulaiman, serta perkembangan rasm mushaf.',
  },
  {
    judul: 'Maknanya', ikon: MessageSquareQuote,
    isi: 'Pembelajaran Bahasa Arab Al-Qur’an, agar yang dibaca dan dihafal juga dipahami dan diamalkan.',
  },
]

const STRUKTUR: { judul: string; peran: string[] }[] = [
  { judul: 'Manajemen', peran: ['Kurikulum', 'SDM', 'Bendahara'] },
  { judul: 'Koordinator program', peran: ['Koordinator SD', 'Koordinator SMP', 'Koordinator Ekstra'] },
  { judul: 'Divisi pendukung', peran: ['Humas', 'Divisi Training', 'New Squad'] },
]

const BAGIAN = [
  { id: 'visi-misi', label: 'Visi & misi' },
  { id: 'tiga-penjagaan', label: 'Tiga penjagaan' },
  { id: 'sejarah', label: 'Sejarah' },
  { id: 'struktur', label: 'Struktur' },
]

export default async function TentangPage() {
  const [session, about] = await Promise.all([getSession(), getAbout()])
  const canEdit = !!session && canEditAbout(session.role)
  // Isian Humas diutamakan; selama kosong, identitas resmi RQ yang tampil.
  const visi = about?.vision?.trim() || VISI_RQ
  const misiTeks = about?.mission?.trim() || ''
  const misi = misiTeks ? poinMisi(misiTeks) : MISI_RQ

  return (
    <div className="bg-background">
      <PublicHeader />

      {/* ── Pembuka ── */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 pt-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:px-8 md:pt-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Tentang Rumah Qur&apos;an LHI</p>
          <h1 className="mt-3 font-heading text-[clamp(40px,6vw,72px)] font-normal leading-[1.02] tracking-[-0.02em]">
            Membumikan Al-Qur&apos;an,<br />
            <span className="italic text-primary">menyemai peradaban.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            Rumah Qur&apos;an adalah unit pembinaan Al-Qur&apos;an di Sekolah Islam Terpadu Lukman Hakim Internasional —
            mendampingi santri dari PAUD hingga SMA, dan para guru yang mengajar mereka.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          {canEdit && (
            <Button asChild size="sm" variant="outline">
              <Link href="/humas/tentang"><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit konten</Link>
            </Button>
          )}
        </div>
      </section>

      {/* ── Navigasi bagian ── */}
      <nav aria-label="Bagian halaman" className="sticky top-0 z-20 mt-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden">
          {BAGIAN.map(b => (
            <a key={b.id} href={`#${b.id}`} className="whitespace-nowrap py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
              {b.label}
            </a>
          ))}
          <Link href="/profil-guru" className="whitespace-nowrap py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            Para pengajar
          </Link>
        </div>
      </nav>

      {/* ── Visi & misi ── */}
      <section id="visi-misi" className="mx-auto grid max-w-6xl scroll-mt-16 gap-10 px-4 py-14 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16 md:px-8 md:py-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Visi</p>
          <p className="mt-4 font-heading text-[26px] leading-snug text-foreground md:text-[32px]">
            &ldquo;{visi}&rdquo;
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Misi</p>
          {misi.length > 1 ? (
            <ol className="mt-3">
              {misi.map((m, i) => (
                <li key={i} className="flex gap-4 border-t py-5">
                  <span className="w-8 shrink-0 font-heading text-3xl leading-none text-accent-warm">{i + 1}</span>
                  <span className="text-[15.5px] leading-relaxed">{m}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 whitespace-pre-wrap text-[15.5px] leading-relaxed">{misiTeks}</p>
          )}
        </div>
      </section>

      {/* ── Tiga penjagaan ── */}
      <section id="tiga-penjagaan" className="scroll-mt-16 bg-[#0E3531] text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#9DBBB3]">Tiga penjagaan</p>
          <h2 className="mt-3 max-w-3xl font-heading text-3xl font-normal leading-tight md:text-5xl">
            Al-Qur&rsquo;an diturunkan dalam tiga bentuk — <span className="italic text-[#F1C48E]">dan ketiganya kami jaga.</span>
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PENJAGAAN.map(({ judul, isi, ikon: Ikon }, i) => (
              <div key={judul} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><Ikon className="h-5 w-5" /></span>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9DBBB3]">Penjagaan {i + 1}</span>
                <h3 className="font-heading text-3xl font-normal">{judul}</h3>
                <p className="text-[14.5px] leading-relaxed text-[#E6EFEC]">{isi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sejarah ── */}
      <section id="sejarah" className="mx-auto grid max-w-6xl scroll-mt-16 gap-8 px-4 py-14 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16 md:px-8 md:py-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Sejarah</p>
          <h2 className="mt-3 font-heading text-3xl font-normal leading-tight md:text-[40px]">Perjalanan Rumah Qur&apos;an</h2>
        </div>
        {about?.history ? (
          <div className="whitespace-pre-wrap text-[15.5px] leading-[1.8] text-foreground/90">{about.history}</div>
        ) : (
          <p className="text-sm italic text-muted-foreground">Sejarah belum diisi.</p>
        )}
      </section>

      {/* ── Struktur ── */}
      <section id="struktur" className="mx-auto max-w-6xl scroll-mt-16 px-4 pb-14 md:px-8 md:pb-20">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Struktur</p>
        <h2 className="mt-3 font-heading text-3xl font-normal leading-tight md:text-[40px]">Yang menjaga pembinaan tetap berjalan</h2>
        <div className="mt-8 flex justify-center">
          <div className="rounded-2xl border-2 border-primary/30 bg-card px-8 py-4 text-center">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Pimpinan</p>
            <p className="mt-0.5 font-heading text-xl">Kepala Rumah Qur&apos;an</p>
          </div>
        </div>
        <div className="mt-8 space-y-6">
          {STRUKTUR.map(s => (
            <div key={s.judul}>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{s.judul}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {s.peran.map(p => (
                  <div key={p} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-wash text-primary"><Users className="h-4 w-4" /></span>
                    <span className="text-sm font-semibold">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Seluruh divisi dan koordinator berada langsung di bawah koordinasi Kepala RQ.
        </p>
      </section>

      {/* ── Ajakan ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-8 md:pb-20">
        <div className="flex flex-col gap-5 rounded-3xl bg-accent-warm-wash p-6 md:flex-row md:items-center md:p-10">
          <div className="flex-1">
            <p className="font-heading text-2xl md:text-3xl">Kenali para pengajar kami</p>
            <p className="mt-1 text-sm text-muted-foreground">Profil guru dan keahlian para pendamping santri Rumah Qur&apos;an.</p>
          </div>
          <Button asChild size="lg">
            <Link href="/profil-guru">Lihat profil guru <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
