'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createPublicPostAction, updatePublicPostAction } from '@/app/actions/public-posts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Markdown } from '@/components/ui/markdown'
import { Eye, EyeOff, ImagePlus, X } from 'lucide-react'
import { PilihBerkas } from '@/components/rapor/kontrol'
import { gantiDenganFotoKompres } from '@/lib/profil/kompres-foto'
import { POST_ICONS, POST_ICON_ORDER, DEFAULT_POST_ICON, postIconOf } from '@/lib/home/post-icons'
import { labelTanggalPost } from '@/lib/home/post-tanggal'
import type { PublicPost, PublicPostType } from '@/types'

const CONTENT_PLACEHOLDER =
  'Isi pengumuman atau tugas yang akan tampil di beranda publik...\n\nGunakan **tebal**, *miring*, ~~coret~~, daftar, dan emoji 😊'

/**
 * Formulir post beranda — membuat post baru, atau menyunting `post` bila
 * diberikan (semua isian terisi dari post itu, termasuk flyernya).
 */
export function PublicPostForm({ post }: { post?: PublicPost } = {}) {
  const [state, action, isPending] = useActionState(
    post ? updatePublicPostAction.bind(null, post.id) : createPublicPostAction,
    null,
  )
  const [content, setContent] = useState(post?.content ?? '')
  const [preview, setPreview] = useState(false)
  // Dikendalikan agar label kolom tanggal ikut berganti: tenggat untuk tugas,
  // waktu pelaksanaan untuk pengumuman.
  const [jenis, setJenis] = useState<PublicPostType>(post?.type ?? 'pengumuman')

  return (
    <form action={action} className="space-y-5">
      {/* ── Jenis & sasaran ──────────────────────────────────────────── */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Jenis & Sasaran</CardTitle>
          <CardDescription>Menentukan di bagian mana post ini muncul di beranda.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type">Jenis Post</Label>
              <Select name="type" value={jenis} onValueChange={v => setJenis(v as PublicPostType)} required>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pengumuman">Pengumuman</SelectItem>
                  <SelectItem value="tugas_guru">Tugas Guru</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target">Target</Label>
              <Select name="target" defaultValue={post?.target ?? 'all'} required>
                <SelectTrigger id="target" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="sd">SD</SelectItem>
                  <SelectItem value="smp">SMP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Isi post ─────────────────────────────────────────────────── */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Isi Post</CardTitle>
          <CardDescription>
            Judul yang tampil di beranda; isi lengkapnya terbuka saat judul diklik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Judul</Label>
            <Input id="title" name="title" required defaultValue={post?.title} placeholder="Judul pengumuman atau tugas..." />
            <p className="text-xs text-muted-foreground">
              Ini yang terbaca lebih dulu di beranda — buat ringkas dan jelas.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="content">Isi</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setPreview(p => !p)}
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                {preview ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                {preview ? 'Tutup pratinjau' : 'Pratinjau'}
              </Button>
            </div>

            <RichTextEditor
              name="content"
              value={content}
              onChange={setContent}
              rows={8}
              required
              placeholder={CONTENT_PLACEHOLDER}
            />

            {preview && (
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pratinjau tampilan publik
                </p>
                {content.trim() ? (
                  <Markdown content={content} className="text-sm" />
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada isi.</p>
                )}
              </div>
            )}
          </div>

          {/*
            Pemilih ikon. Memakai radio asli, bukan tombol + state: nilainya
            ikut terkirim lewat FormData tanpa hidden input, dan navigasi panah
            serta pembacaan layar sudah benar tanpa perlu ditiru ulang.

            Radionya ditumpuk tepat di atas kotak yang terlihat (`inset-0`),
            bukan disembunyikan dengan `sr-only`. `sr-only` memakai
            `position:absolute`, jadi radio itu mendarat entah di mana — dan
            begitu diklik, peramban menggulir layar ke posisi radio yang
            tersembunyi itu, bukan ke kotak yang barusan ditekan. Dengan
            ditumpuk, "menggulir ke elemen fokus" jadi tidak memindahkan apa pun
            karena elemennya memang sudah ada di depan mata.

            Konsekuensinya kotak yang terlihat harus `pointer-events-none`
            supaya klik tembus ke radio di atasnya — karena itu efek tunjuknya
            memakai `peer-hover`, bukan `hover` pada kotak itu sendiri.
          */}
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none">Ikon di Beranda</legend>
            <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
              {POST_ICON_ORDER.map(value => {
                const meta = POST_ICONS[value]
                const Icon = meta.icon
                return (
                  <label key={value} className="relative block cursor-pointer" title={meta.hint}>
                    <input
                      type="radio"
                      name="icon"
                      value={value}
                      defaultChecked={value === (post ? postIconOf(post) : DEFAULT_POST_ICON)}
                      className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-lg opacity-0"
                    />
                    <span className="pointer-events-none flex flex-col items-center gap-1.5 rounded-lg border bg-background px-2 py-3 text-muted-foreground transition-colors peer-hover:bg-muted/50 peer-checked:border-primary peer-checked:bg-primary-wash peer-checked:text-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                      <Icon className="h-5 w-5" />
                      <span className="text-[11px] font-medium">{meta.label}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Gambar di sebelah kiri judul. Warnanya tetap mengikuti Status Prioritas di bawah.
            </p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="priority">Status Prioritas</Label>
              <Select name="priority" defaultValue={post?.priority ?? 'info'} required>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="penting">Penting</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="pengingat">Pengingat</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Menentukan penanda yang tampil di papan pengumuman beranda.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due_date">{labelTanggalPost(jenis)} (opsional)</Label>
              <Input id="due_date" name="due_date" type="date" defaultValue={post?.due_date ?? undefined} className="dark:[color-scheme:dark]" />
              <p className="text-xs text-muted-foreground">
                {jenis === 'tugas_guru'
                  ? 'Batas waktu tugas dikumpulkan. Ikut tampil di kalender agenda beranda.'
                  : 'Hari kegiatan berlangsung. Ikut tampil di kalender agenda beranda.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Gambar / flyer ────────────────────────────────────────────── */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Gambar / Flyer <span className="font-normal text-muted-foreground">(opsional)</span></CardTitle>
          <CardDescription>Tampil sebagai thumbnail di daftar pengumuman beranda, dan utuh di halaman pengumumannya.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <PilihGambar gambarLama={post?.image_url ?? null} />
        </CardContent>
      </Card>

      {/* ── Aksi ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {state?.error && (
          <p className="border-b bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="p-4">
          <Button type="submit" disabled={isPending} className="w-full">
            {post ? (isPending ? 'Menyimpan...' : 'Simpan perubahan') : isPending ? 'Memposting...' : 'Publikasikan'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/**
 * Pemilih flyer dengan pratinjau. Gambar diperkecil di peramban lebih dulu
 * (sisi terpanjang 1600 px — tulisan flyer tetap terbaca) supaya foto kamera
 * HP tidak melewati batas ukuran kiriman server action.
 */
function PilihGambar({ gambarLama = null }: { gambarLama?: string | null }) {
  const [pratinjau, setPratinjau] = useState<string | null>(null)
  // Flyer yang sudah terpasang: tetap, kecuali diganti berkas baru atau dilepas.
  const [lepasLama, setLepasLama] = useState(false)
  const lamaTampil = gambarLama && !lepasLama && !pratinjau
  const [memproses, setMemproses] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => () => { if (pratinjau && pratinjau !== gambarLama) URL.revokeObjectURL(pratinjau) }, [pratinjau, gambarLama])

  async function pilih(berkas: File | null, input: HTMLInputElement) {
    inputRef.current = input
    if (!berkas) { setPratinjau(null); return }
    setMemproses(true)
    const kecil = await gantiDenganFotoKompres(input, 1600)
    setMemproses(false)
    setPratinjau(kecil ? URL.createObjectURL(kecil) : null)
  }

  function hapus() {
    if (inputRef.current) inputRef.current.value = ''
    setPratinjau(null)
  }

  return (
    <div className="space-y-3">
      {/* Terkirim hanya bila flyer lama dilepas tanpa pengganti. */}
      {gambarLama && lepasLama && !pratinjau && <input type="hidden" name="hapus_gambar" value="1" />}
      {lamaTampil && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gambarLama} alt="Gambar saat ini" className="max-h-72 rounded-lg border object-contain" />
          <Button type="button" size="sm" variant="secondary" onClick={() => setLepasLama(true)}
            className="absolute right-2 top-2 h-7 px-2 text-xs shadow">
            <X className="mr-1 h-3 w-3" /> Lepas
          </Button>
        </div>
      )}
      {gambarLama && lepasLama && !pratinjau && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          Gambar lama akan dilepas saat disimpan.
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setLepasLama(false)}>Batalkan</button>
        </p>
      )}
      <PilihBerkas
        id="gambar"
        name="gambar"
        accept="image/jpeg,image/png,image/webp"
        onPilih={pilih}
        ikon={<ImagePlus className="size-4" />}
        judul={memproses ? 'Memperkecil gambar…' : pratinjau || lamaTampil ? 'Ganti gambar' : 'Pilih gambar atau flyer'}
        keterangan="JPG, PNG, atau WebP"
      />
      {pratinjau && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pratinjau} alt="Pratinjau gambar" className="max-h-72 rounded-lg border object-contain" />
          <Button type="button" size="sm" variant="secondary" onClick={hapus}
            className="absolute right-2 top-2 h-7 px-2 text-xs shadow">
            <X className="mr-1 h-3 w-3" /> Hapus
          </Button>
        </div>
      )}
    </div>
  )
}
