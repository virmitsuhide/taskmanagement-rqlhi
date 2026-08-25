'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, MessageCircle, Pencil, Search, X } from 'lucide-react'
import { simpanWaliPhoneAction } from '@/app/actions/wali-phone'
import { cn, initials } from '@/lib/utils'
import type { TeacherStudentRow } from '@/lib/data/teacher'

interface Props {
  students: TeacherStudentRow[]
}

const DAY_MS = 1000 * 60 * 60 * 24

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr); const today = new Date()
  today.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / DAY_MS)
}

function lastLabel(dateStr: string | null): { text: string; tone: 'ok' | 'warn' | 'danger' | 'none' } {
  const d = daysAgo(dateStr)
  if (d === null) return { text: 'Belum pernah setor', tone: 'none' }
  if (d === 0) return { text: 'Setor hari ini', tone: 'ok' }
  if (d === 1) return { text: 'Setor kemarin', tone: 'ok' }
  if (d <= 3) return { text: `${d} hari lalu`, tone: 'warn' }
  return { text: `${d} hari lalu`, tone: 'danger' }
}

const TONE: Record<string, string> = {
  ok: 'bg-success-wash text-success',
  warn: 'bg-warning-wash text-warning',
  danger: 'bg-destructive-wash text-destructive',
  none: 'bg-muted text-muted-foreground',
}

type Kelompok = 'halaqoh' | 'sesi' | 'kelas' | 'tahsin' | 'tahfidz'

const KELOMPOK: { key: Kelompok; label: string }[] = [
  { key: 'halaqoh', label: 'Halaqoh' },
  { key: 'sesi', label: 'Sesi' },
  { key: 'kelas', label: 'Kelas' },
  { key: 'tahsin', label: 'Capaian Tahsin' },
  { key: 'tahfidz', label: 'Capaian Tahfidz' },
]

/**
 * Kunci pengelompokan sekaligus label judulnya.
 *
 * Capaian tahsin memakai "Metode Jilid", bukan halaman — halaman berubah tiap
 * pekan, dan mengelompokkan per halaman menghasilkan puluhan kelompok berisi
 * satu anak. Jilid berpindah beberapa bulan sekali, jadi kelompoknya bertahan
 * cukup lama untuk berguna.
 */
function kunci(s: TeacherStudentRow, by: Kelompok): string {
  switch (by) {
    case 'halaqoh': return s.halaqoh_name ?? 'Tanpa Halaqoh'
    case 'sesi': return s.sesi ? `Sesi ${s.sesi}` : 'Tanpa Sesi'
    case 'kelas': return s.kelas ? `Kelas ${s.kelas}` : 'Tanpa Kelas'
    case 'tahsin':
      if (!s.current_method_name) return 'Murni Tahfidz'
      return s.current_jilid_label
        ? `${s.current_method_name} ${s.current_jilid_label}`
        : `${s.current_method_name} — jilid belum diisi`
    case 'tahfidz':
      return s.last_tahfidz_surat ? `Terakhir: ${s.last_tahfidz_surat}` : 'Belum ada setoran tahfidz'
  }
}

export function StudentBrowser({ students }: Props) {
  const [by, setBy] = useState<Kelompok>('halaqoh')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  // Nomor yang baru disimpan ditimpakan di atas data server supaya barisnya
  // langsung berubah tanpa memuat ulang seluruh halaman.
  const [phones, setPhones] = useState<Record<string, string | null>>({})

  const phoneOf = (s: TeacherStudentRow) => (s.id in phones ? phones[s.id] : s.wali_phone)

  const groups = useMemo(() => {
    const kata = q.trim().toLowerCase()
    const cocok = kata
      ? students.filter(s =>
          s.full_name.toLowerCase().includes(kata) ||
          (s.kelas ?? '').toLowerCase().includes(kata))
      : students

    const m = new Map<string, TeacherStudentRow[]>()
    for (const s of cocok) {
      const k = kunci(s, by)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(s)
    }
    // Judul diurutkan dengan localeCompare bernumeric supaya "Kelas 10" jatuh
    // sesudah "Kelas 9", bukan sesudah "Kelas 1".
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id', { numeric: true }))
  }, [students, by, q])

  const tampil = groups.reduce((t, [, list]) => t + list.length, 0)

  async function simpan(studentId: string) {
    setSaving(true)
    const res = await simpanWaliPhoneAction(studentId, draft)
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    setPhones(p => ({ ...p, [studentId]: res.phone ?? null }))
    setEditing(null)
    setDraft('')
    toast.success('Nomor wali tersimpan')
  }

  return (
    <>
      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cari nama siswa atau kelas…"
            className="h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-xs text-muted-foreground">Kelompokkan:</span>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {KELOMPOK.map(k => (
              <button
                key={k.key}
                type="button"
                onClick={() => setBy(k.key)}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  by === k.key ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground tabular-nums">
          {tampil} siswa dalam {groups.length} kelompok
          {q && ` · disaring dari ${students.length}`}
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white py-10 text-center">
          <p className="text-sm text-muted-foreground">Tidak ada siswa yang cocok.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([judul, list]) => (
            <section key={judul}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {judul}
                <span className="text-xs font-normal text-muted-foreground">({list.length} siswa)</span>
              </h2>
              <div className="divide-y rounded-xl border bg-white">
                {list.map(s => {
                  const last = lastLabel(s.last_setoran_date)
                  const phone = phoneOf(s)
                  const sedangEdit = editing === s.id
                  return (
                    <div key={s.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/guru/siswa/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                            {initials(s.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{s.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.current_method_name
                                ? `${s.current_method_name}${s.current_jilid_label ? ' ' + s.current_jilid_label : ''}${s.current_jilid_page ? ' · hal. ' + s.current_jilid_page : ''}`
                                : 'Murni tahfidz'}
                              {s.kelas ? ` · Kelas ${s.kelas}` : ''}
                              {s.sesi ? ` · Sesi ${s.sesi}` : ''}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground/80">
                              Tahfidz: {s.last_tahfidz_surat ? `${s.last_tahfidz_surat} · ${s.tahfidz_count}x setor` : 'belum ada setoran'}
                            </p>
                          </div>
                        </Link>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px]', TONE[last.tone])}>
                          {last.text}
                        </span>
                      </div>

                      {/* Baris nomor wali — laporan WhatsApp bergantung pada ini */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
                        {sedangEdit ? (
                          <>
                            <input
                              autoFocus
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              placeholder="08xx / +62xx — kosongkan untuk menghapus"
                              className="h-8 w-56 rounded-md border bg-white px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                            />
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => simpan(s.id)}
                              className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                            >
                              <Check className="mr-1 h-3.5 w-3.5" />Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditing(null); setDraft('') }}
                              className="inline-flex h-8 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground">
                              Wali{s.wali_name ? ` (${s.wali_name})` : ''}:{' '}
                              {phone
                                ? <span className="font-mono text-foreground">{phone}</span>
                                : <span className="italic">belum ada nomor</span>}
                            </span>
                            <button
                              type="button"
                              onClick={() => { setEditing(s.id); setDraft(phone ?? '') }}
                              className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Pencil className="mr-1 h-3 w-3" />{phone ? 'Ubah' : 'Isi nomor'}
                            </button>
                            {phone && (
                              <a
                                href={`https://wa.me/${phone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] text-success transition-colors hover:bg-success-wash"
                              >
                                <MessageCircle className="mr-1 h-3 w-3" />WhatsApp
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
