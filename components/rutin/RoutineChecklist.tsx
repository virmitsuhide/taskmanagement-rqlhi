'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Check, ChevronDown, ChevronUp, Pencil, Trash2, X, CircleCheckBig, CircleAlert, Hourglass, LogOut, Users,
} from 'lucide-react'
import {
  deleteRoutineTaskAction, keluarTugasRutinBersamaAction, moveRoutineTaskAction,
  setRoutineOutcomeAction, updateRoutineTaskAction,
} from '@/app/actions/rutin'
import { DeskripsiMention } from '@/components/rutin/DeskripsiMention'
import type { PengurusMention } from '@/lib/rutin/bersama'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { CADENCES, CADENCE_LABELS, CADENCE_PERIOD_LABELS, labelPeriode } from '@/lib/rutin/periode'
import { MAX_ALASAN } from '@/lib/rutin/status'
import type { RoutineGroup } from '@/lib/data/rutin'
import type { RoutineOutcome, RoutineTaskState } from '@/types'

/**
 * Checklist tugas rutin untuk periode yang sedang berjalan.
 *
 * TIGA KEADAAN, BUKAN DUA
 *
 * Sebuah tugas rutin bisa belum dilaporkan, terlaksana, atau tidak terlaksana.
 * Keadaan ketiga itu yang membuat kotak centang tunggal tidak lagi memadai:
 * kotak kosong akan berarti dua hal sekaligus — "belum sempat saya buka" dan
 * "sudah saya pastikan tidak jalan" — dan kepala RQ tidak bisa membedakan
 * keduanya justru pada bagian yang paling ingin ia ketahui.
 *
 * Karena itu barisnya memakai dua tombol yang berdiri sendiri, bukan satu
 * kotak yang berputar tiga keadaan. Kontrol yang berputar memaksa orang
 * mengetuk berkali-kali sambil menebak urutannya, dan tidak punya cara
 * menunjukkan keadaan mana yang sedang aktif sebelum diketuk.
 *
 * OPTIMISTIK HANYA UNTUK 'TERLAKSANA'
 *
 * Melapor terlaksana adalah gerakan beruntun — orang menandai tiga hal
 * sekaligus tanpa menunggu — jadi tampilannya berubah lebih dulu dan server
 * menyusul. 'Tidak terlaksana' tidak bisa begitu: alasannya wajib, jadi
 * formnya harus muncul dan disimpan dulu sebelum ada yang bisa ditampilkan.
 */

interface Props {
  groups: RoutineGroup[]
  /** Pengurus yang bisa disebut dengan @ saat menyunting — tanpa pemirsa. */
  pengurus: PengurusMention[]
}

export function RoutineChecklist({ groups, pengurus }: Props) {
  return (
    <div className="space-y-5">
      {groups.map(group => (
        <GroupSection key={group.cadence} group={group} pengurus={pengurus} />
      ))}
    </div>
  )
}

function GroupSection({ group, pengurus }: { group: RoutineGroup; pengurus: PengurusMention[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  /** Tugas yang form alasannya sedang terbuka. */
  const [alasanId, setAlasanId] = useState<string | null>(null)

  // Laporan yang sudah diketuk tapi belum dikonfirmasi server.
  const [optimistic, setOptimistic] = useState<Record<string, RoutineOutcome | null>>({})

  const items = group.items.map(i =>
    i.task.id in optimistic ? { ...i, outcome: optimistic[i.task.id], reason: null } : i,
  )
  const done = items.filter(i => i.outcome === 'terlaksana').length
  const missed = items.filter(i => i.outcome === 'tidak_terlaksana').length
  const total = items.length
  const persen = (n: number) => (total === 0 ? 0 : (n / total) * 100)

  function lupakanOptimistik(taskId: string) {
    setOptimistic(o => {
      const salin = { ...o }
      delete salin[taskId]
      return salin
    })
  }

  /** Jalur cepat: terlaksana ⇄ belum. Tidak dipakai untuk 'tidak terlaksana'. */
  function lapor(item: RoutineTaskState, next: RoutineOutcome | null) {
    // Tugas bersama tidak dianggap tercentang begitu diketuk: laporannya
    // menunggu konfirmasi rekan, dan tampilan optimistik akan berbohong soal itu.
    const bersama = item.bersama && (item.bersama.anggota.some(a => a.status === 'diterima') || !item.bersama.sayaPemilik)
    if (!(bersama && next === 'terlaksana')) setOptimistic(o => ({ ...o, [item.task.id]: next }))
    startTransition(async () => {
      const res = await setRoutineOutcomeAction(item.task.id, next)
      if (res?.error) {
        lupakanOptimistik(item.task.id)
        toast.error(res.error)
        return
      }
      router.refresh()
    })
  }

  function run(fn: () => Promise<{ error?: string } | void>, sukses?: string) {
    startTransition(async () => {
      const res = await fn()
      if (res && 'error' in res && res.error) {
        toast.error(res.error)
        return
      }
      if (sukses) toast.success(sukses)
      router.refresh()
    })
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b bg-muted/40 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-sm font-semibold">{CADENCE_LABELS[group.cadence]}</h2>
          <span className="text-[11px] text-muted-foreground">
            {CADENCE_PERIOD_LABELS[group.cadence]} · {labelPeriode(group.cadence)}
          </span>
          {total > 0 && (
            <span className="ml-auto flex items-center gap-1.5">
              {missed > 0 && (
                <span className="rounded-full bg-destructive-wash px-2 py-0.5 text-[11px] font-medium tabular-nums text-destructive">
                  {missed} tidak terlaksana
                </span>
              )}
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {done}/{total} terlaksana
              </span>
            </span>
          )}
        </div>
        {/*
          Bilah bertumpuk, bukan satu bilah kemajuan. Tugas yang tidak
          terlaksana sudah selesai diurus — ia tidak lagi "sisa pekerjaan" —
          tapi juga bukan keberhasilan. Menampilkannya sebagai potongan merah
          di bilah yang sama membuat ketiga keadaan itu terbaca sekaligus.
        */}
        {total > 0 && (
          <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className={`h-full transition-[width] ${done === total ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${persen(done)}%` }}
            />
            <div
              className="h-full bg-destructive/60 transition-[width]"
              style={{ width: `${persen(missed)}%` }}
            />
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="px-5 py-8 text-center text-xs italic text-muted-foreground">
          Belum ada tugas {CADENCE_LABELS[group.cadence].toLowerCase()}. Tambahkan lewat
          kotak &ldquo;Tambah Tugas Rutin&rdquo; di atas.
        </p>
      ) : done === total ? (
        <div className="flex items-center gap-2 border-b border-success/20 bg-success-wash px-5 py-2.5 text-sm text-success">
          <CircleCheckBig className="h-4 w-4 shrink-0" />
          Semua tugas {CADENCE_LABELS[group.cadence].toLowerCase()} sudah dikerjakan
          {LANJUTAN_PERIODE[group.cadence]}.
        </div>
      ) : null}

      <div className="divide-y">
        {items.map((item, i) =>
          editingId === item.task.id ? (
            <EditRow
              key={item.task.id}
              item={item}
              pengurus={pengurus}
              onDone={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <ChecklistRow
              key={item.task.id}
              item={item}
              pending={pending}
              isFirst={i === 0}
              isLast={i === items.length - 1}
              alasanTerbuka={alasanId === item.task.id}
              onLapor={next => {
                // Menuju "tidak terlaksana" selalu lewat form alasannya —
                // tidak ada jalan pintas yang bisa menghasilkan laporan
                // tanpa sebab.
                if (next === 'tidak_terlaksana') setAlasanId(item.task.id)
                else {
                  setAlasanId(null)
                  lapor(item, next)
                }
              }}
              onSimpanAlasan={alasan =>
                new Promise<string | null>(resolve => {
                  startTransition(async () => {
                    const res = await setRoutineOutcomeAction(
                      item.task.id, 'tidak_terlaksana', alasan,
                    )
                    if (res?.error) {
                      resolve(res.error)
                      return
                    }
                    lupakanOptimistik(item.task.id)
                    setAlasanId(null)
                    router.refresh()
                    resolve(null)
                  })
                })
              }
              onBatalAlasan={() => setAlasanId(null)}
              onEdit={() => setEditingId(item.task.id)}
              onKeluar={async () => {
                const ok = await confirm({
                  title: 'Keluar dari tugas bersama?',
                  description: `"${item.task.description}" hilang dari checklist Anda. Pemiliknya tetap melanjutkan tugas ini.`,
                  confirmText: 'Keluar',
                })
                if (!ok) return
                run(() => keluarTugasRutinBersamaAction(item.task.id), 'Anda keluar dari tugas bersama.')
              }}
              onMove={dir => run(() => moveRoutineTaskAction(item.task.id, dir))}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Hapus tugas rutin "${item.task.description}"?`,
                  description: 'Riwayat laporannya ikut terhapus.',
                  confirmText: 'Hapus tugas rutin',
                })
                if (!ok) return
                run(() => deleteRoutineTaskAction(item.task.id), 'Tugas rutin dihapus.')
              }}
            />
          ),
        )}
      </div>
    </section>
  )
}

/**
 * Sejajarkan blok alasan dengan deskripsi tugasnya, bukan dengan tepi kartu —
 * alasan adalah keterangan bagi tugas itu, dan lekukannya yang menyatakan
 * begitu. Di layar sempit lekukan itu dilepas: 4,5rem dari lebar 360px terlalu
 * mahal untuk teks yang justru perlu dibaca.
 */
const INDENT = 'sm:ml-[4.5rem]'

const LANJUTAN_PERIODE: Record<RoutineGroup['cadence'], string> = {
  pekanan: ' pekan ini',
  bulanan: ' bulan ini',
  semesteran: ' semester ini',
  tahunan: ' tahun ajaran ini',
}

function ChecklistRow({
  item, pending, isFirst, isLast, alasanTerbuka,
  onLapor, onSimpanAlasan, onBatalAlasan, onEdit, onMove, onDelete, onKeluar,
}: {
  item: RoutineTaskState
  pending: boolean
  isFirst: boolean
  isLast: boolean
  alasanTerbuka: boolean
  onLapor: (next: RoutineOutcome | null) => void
  onSimpanAlasan: (alasan: string) => Promise<string | null>
  onBatalAlasan: () => void
  onEdit: () => void
  onMove: (dir: 'up' | 'down') => void
  onDelete: () => void
  onKeluar: () => void
}) {
  const terlaksana = item.outcome === 'terlaksana'
  const gagal = item.outcome === 'tidak_terlaksana'
  const b = item.bersama
  const sayaPemilik = !b || b.sayaPemilik
  const menungguLaporanSaya = b?.laporan?.saya === 'pelapor' && b.laporan.konfirmasi === 'menunggu'

  return (
    <div className="group px-5 py-3">
      <div className="flex items-start gap-3">
        <StatusToggle
          taskId={item.task.id}
          outcome={item.outcome}
          tertunda={menungguLaporanSaya}
          disabled={pending}
          onLapor={onLapor}
        />

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm leading-snug ${
              terlaksana ? 'text-muted-foreground line-through decoration-1' : ''
            } ${gagal ? 'text-muted-foreground' : ''}`}
          >
            {item.task.description}
          </p>
          {item.outcome && item.checkedAt && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {terlaksana ? 'Terlaksana' : 'Dilaporkan tidak terlaksana'}{' '}
              {waktuSingkat(item.checkedAt)}
            </p>
          )}
          {b && <KeteranganBersama b={b} />}
        </div>

        {/* Menyunting, mengurutkan, dan menghapus milik pembuat tugas; rekan
            pada tugas bersama hanya bisa keluar. */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
          {sayaPemilik ? (
            <>
              <IconBtn label="Naikkan" onClick={() => onMove('up')} disabled={isFirst || pending}>
                <ChevronUp className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn label="Turunkan" onClick={() => onMove('down')} disabled={isLast || pending}>
                <ChevronDown className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn label="Sunting" onClick={onEdit} disabled={pending}>
                <Pencil className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn label="Hapus" onClick={onDelete} disabled={pending} danger>
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </>
          ) : (
            <IconBtn label="Keluar dari tugas bersama" onClick={onKeluar} disabled={pending} danger>
              <LogOut className="h-3.5 w-3.5" />
            </IconBtn>
          )}
        </div>
      </div>

      {alasanTerbuka ? (
        <FormAlasan
          taskId={item.task.id}
          awal={item.reason ?? ''}
          onSimpan={onSimpanAlasan}
          onBatal={onBatalAlasan}
        />
      ) : gagal && item.reason ? (
        <div className={`${INDENT} mt-2 rounded-lg border border-destructive/20 bg-destructive-wash px-3 py-2`}>
          <p className="flex items-start gap-1.5 text-xs leading-snug text-destructive">
            <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 whitespace-pre-wrap break-words">{item.reason}</span>
          </p>
          {/* Alasan yang tidak bisa diralat memaksa orang membatalkan seluruh
              laporannya hanya untuk membetulkan satu kalimat. */}
          <button
            type="button"
            onClick={() => onLapor('tidak_terlaksana')}
            className="mt-1 text-[11px] font-medium text-destructive underline underline-offset-2 hover:no-underline"
          >
            Ubah alasan
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Dua tombol berdampingan: terlaksana dan tidak terlaksana.
 *
 * Mengetuk tombol yang sedang aktif membatalkannya — kembali ke "belum
 * dilaporkan". Itu satu-satunya jalan keluar dari laporan yang salah ketuk,
 * dan menaruhnya di tombol yang sama membuatnya bisa ditemukan tanpa menu.
 */
function StatusToggle({
  taskId, outcome, tertunda, disabled, onLapor,
}: {
  taskId: string
  outcome: RoutineOutcome | null
  /** Laporan terlaksana pemirsa pada tugas bersama yang masih menunggu konfirmasi rekan. */
  tertunda?: boolean
  disabled?: boolean
  onLapor: (next: RoutineOutcome | null) => void
}) {
  const dasar =
    'flex h-7 w-7 items-center justify-center rounded-md border transition disabled:opacity-40'

  return (
    <div
      role="group"
      aria-label="Status pelaksanaan"
      className="mt-px flex shrink-0 items-center gap-1"
    >
      <button
        type="button"
        id={`rutin-ya-${taskId}`}
        aria-pressed={outcome === 'terlaksana' || tertunda}
        disabled={disabled}
        onClick={() => onLapor(outcome === 'terlaksana' || tertunda ? null : 'terlaksana')}
        title={tertunda ? 'Menunggu konfirmasi rekan — ketuk untuk membatalkan' : outcome === 'terlaksana' ? 'Batalkan laporan' : 'Tandai terlaksana'}
        className={`${dasar} ${
          outcome === 'terlaksana'
            ? 'border-success bg-success text-white'
            : tertunda
              ? 'border-warning bg-warning-wash text-warning'
              : 'border-input text-muted-foreground hover:border-success/60 hover:text-success'
        }`}
      >
        {tertunda ? <Hourglass className="h-3.5 w-3.5" /> : <Check className="h-4 w-4" />}
        <span className="sr-only">Terlaksana</span>
      </button>
      <button
        type="button"
        aria-pressed={outcome === 'tidak_terlaksana'}
        disabled={disabled}
        onClick={() => onLapor(outcome === 'tidak_terlaksana' ? null : 'tidak_terlaksana')}
        title={
          outcome === 'tidak_terlaksana' ? 'Batalkan laporan' : 'Tandai tidak terlaksana'
        }
        className={`${dasar} ${
          outcome === 'tidak_terlaksana'
            ? 'border-destructive bg-destructive text-white'
            : 'border-input text-muted-foreground hover:border-destructive/60 hover:text-destructive'
        }`}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Tidak terlaksana</span>
      </button>
    </div>
  )
}

/**
 * Isian alasan tidak terlaksana.
 *
 * Muncul di tempat, bukan sebagai dialog. Alasannya pendek dan sering ditulis
 * berurutan untuk beberapa tugas sekaligus; dialog yang harus dibuka-tutup
 * tiap baris menambah dua ketukan pada pekerjaan yang sudah terasa seperti
 * mengaku kalah.
 */
function FormAlasan({
  taskId, awal, onSimpan, onBatal,
}: {
  taskId: string
  awal: string
  onSimpan: (alasan: string) => Promise<string | null>
  onBatal: () => void
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const [alasan, setAlasan] = useState(awal)
  const [error, setError] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)

  useEffect(() => { areaRef.current?.focus() }, [])

  async function simpan() {
    const isi = alasan.trim()
    if (!isi) {
      setError('Tulis dulu alasan kenapa tugas ini tidak terlaksana.')
      areaRef.current?.focus()
      return
    }
    setMenyimpan(true)
    const pesan = await onSimpan(isi)
    setMenyimpan(false)
    if (pesan) setError(pesan)
  }

  return (
    <div className={`${INDENT} mt-2.5 rounded-lg border border-destructive/25 bg-destructive-wash/60 p-3`}>
      <Label htmlFor={`alasan-${taskId}`} className="text-xs text-destructive">
        Kenapa tidak terlaksana?
      </Label>
      <Textarea
        ref={areaRef}
        id={`alasan-${taskId}`}
        rows={2}
        maxLength={MAX_ALASAN}
        value={alasan}
        disabled={menyimpan}
        onChange={e => { setAlasan(e.target.value); setError(null) }}
        // Ctrl/⌘+Enter menyimpan; Enter sendiri tetap membuat baris baru
        // karena alasan sering ditulis lebih dari satu kalimat.
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); simpan() }
          if (e.key === 'Escape') onBatal()
        }}
        className="mt-1.5 bg-background"
        placeholder="mis. Wali murid belum bisa dihubungi sampai akhir pekan"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Alasan ini terbaca kepala RQ di papan tugas rutin. Tulis sebabnya, bukan
        permintaan maafnya.
      </p>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={simpan}
          disabled={menyimpan}
        >
          {menyimpan ? 'Menyimpan…' : 'Simpan alasan'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onBatal} disabled={menyimpan}>
          Batal
        </Button>
      </div>
    </div>
  )
}

function IconBtn({
  label, onClick, disabled, danger, children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`rounded p-1.5 transition hover:bg-accent disabled:opacity-30 ${
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground'
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

/**
 * Sunting di tempat.
 *
 * Menambah tugas punya halamannya sendiri — di sana orang sedang memikirkan
 * pekerjaan baru. Menyunting terjadi sambil membaca daftar ("kalimatnya kurang
 * jelas", "ini harusnya bulanan"), dan melempar orang ke halaman lain hanya
 * untuk mengubah satu kalimat memutus alur membacanya.
 */
function EditRow({
  item, pengurus, onDone, onCancel,
}: {
  item: RoutineTaskState
  pengurus: PengurusMention[]
  onDone: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const [state, action, isPending] = useActionState(
    updateRoutineTaskAction,
    null as { error?: string; success?: boolean } | null,
  )

  useEffect(() => { areaRef.current?.focus() }, [])

  useEffect(() => {
    if (!state?.success) return
    router.refresh()
    onDone()
    // Hanya `state` yang boleh memicu; onDone & router stabil selama baris ini hidup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form action={action} className="space-y-3 bg-muted/30 px-5 py-4">
      <input type="hidden" name="task_id" value={item.task.id} />

      <div className="space-y-1.5">
        <Label htmlFor={`edit-${item.task.id}`} className="text-xs">Deskripsi</Label>
        <DeskripsiMention
          ref={areaRef}
          id={`edit-${item.task.id}`}
          name="description"
          rows={2}
          required
          maxLength={300}
          defaultValue={item.task.description}
          pengurus={pengurus}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {CADENCES.map(c => (
          <label key={c} className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="radio"
              name="cadence"
              value={c}
              defaultChecked={item.task.cadence === c}
              className="accent-primary"
            />
            {CADENCE_LABELS[c]}
          </label>
        ))}
      </div>

      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <Check className="mr-1 h-3.5 w-3.5" />
          {isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          <X className="mr-1 h-3.5 w-3.5" />Batal
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Memindah irama tidak menghapus riwayat laporannya.
        </span>
      </div>
    </form>
  )
}

/**
 * Siapa saja yang ikut, dan di mana laporan terlaksananya tertahan.
 *
 * Kalimatnya disusun dari sudut pemirsa — pelapor, rekan yang belum
 * memutuskan, atau yang menolak — karena tindakan yang ia perlukan berbeda.
 */
function KeteranganBersama({ b }: { b: NonNullable<RoutineTaskState['bersama']> }) {
  const diterima = b.anggota.filter(a => a.status === 'diterima').map(a => a.label)
  const menunggu = b.anggota.filter(a => a.status === 'menunggu').map(a => a.label)
  const menolak = b.anggota.filter(a => a.status === 'ditolak').map(a => a.label)
  const l = b.laporan

  let pesan: { teks: string; kelas: string } | null = null
  if (l?.konfirmasi === 'menunggu') {
    pesan = l.saya === 'pelapor'
      ? { teks: `Anda menandai terlaksana — menunggu konfirmasi ${l.rekan.join(', ')}.`, kelas: 'text-warning' }
      : l.saya === 'perlu_konfirmasi'
        ? { teks: `${l.pelapor.label} menandai terlaksana — konfirmasi di kartu atas.`, kelas: 'text-warning' }
        : { teks: `Anda sudah menyetujui laporan ${l.pelapor.label} — menunggu ${l.rekan.join(', ')}.`, kelas: 'text-muted-foreground' }
  } else if (l?.konfirmasi === 'ditolak') {
    pesan = l.saya === 'pelapor'
      ? { teks: `${l.rekan.join(', ')} belum menyetujui laporan terlaksana Anda. Bicarakan, lalu laporkan ulang.`, kelas: 'text-destructive' }
      : l.saya === 'menolak'
        ? { teks: `Anda menandai belum selesai — ${l.pelapor.label} bisa melaporkan ulang.`, kelas: 'text-muted-foreground' }
        : { teks: `${l.rekan.join(', ')} belum menyetujui laporan ${l.pelapor.label}.`, kelas: 'text-destructive' }
  }

  return (
    <>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <Users className="h-3 w-3" />
        {b.sayaPemilik ? (
          <>
            {diterima.length > 0 && <span>Bersama {diterima.join(', ')}</span>}
            {menunggu.length > 0 && <span className="rounded-full bg-muted px-1.5">menunggu jawaban {menunggu.join(', ')}</span>}
            {menolak.length > 0 && <span className="rounded-full bg-destructive-wash px-1.5 text-destructive">{menolak.join(', ')} menolak</span>}
          </>
        ) : (
          <span>Tugas bersama dari {b.pemilik.label}</span>
        )}
      </p>
      {pesan && <p className={`mt-0.5 text-[11px] font-medium ${pesan.kelas}`}>{pesan.teks}</p>}
    </>
  )
}

/** "hari ini 14.20" / "Sen, 31 Agu 14.20" — cukup untuk menandai kapan dilaporkan. */
function waktuSingkat(iso: string): string {
  const d = new Date(iso)
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const hariIni = new Date().toDateString() === d.toDateString()
  if (hariIni) return `hari ini ${jam}`
  return `${d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} ${jam}`
}
