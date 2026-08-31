'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle, CheckCircle2, Gavel, PenLine, Scale, ShieldQuestion, Trash2,
} from 'lucide-react'
import { ttdGuruAction } from '@/app/actions/kpi-rapor'
import { ajukanBandingAction, eskalasiBandingAction } from '@/app/actions/kpi-banding'
import {
  BANDING_STATUS_LABELS, BANDING_TONE, SEBAB_LABELS, bolehBanding, bolehEskalasi,
  bolehTtdGuru, sisaHari, MASA_BANDING_HARI_KERJA,
} from '@/lib/kpi/alur'
import { ttdStyle } from '@/lib/kpi/tanda-tangan'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { KpiBanding, KpiRaporStatus, KpiSelesaiSebab, SignatureFocus } from '@/types'

interface BarisIndikatorRingkas {
  indikator: number
  nama: string
  nilai: number
  capaian: string
  target: string
}

interface Props {
  kpiId: string
  status: KpiRaporStatus
  versi: number
  sudahTtd: boolean
  bandingBatas: string | null
  selesaiSebab: KpiSelesaiSebab | null
  baris: BarisIndikatorRingkas[]
  banding: KpiBanding[]
  ttdSaya: string | null
  ttdFokus: SignatureFocus
}

/**
 * Yang bisa dilakukan guru terhadap rapornya: menandatangani, menyanggah, atau
 * menaikkan sanggahannya ke Kepala RQ.
 *
 * Dua tombol utamanya saling meniadakan dan itu dinyatakan terang-terangan di
 * layar. Guru yang menandatangani lebih dulu lalu menyadari ada yang keliru
 * akan mendapati tombol bandingnya hilang; lebih baik ia tahu sebelum menekan
 * daripada sesudah.
 */
export function AksiRapor(props: Props) {
  const { kpiId, status, sudahTtd, bandingBatas, selesaiSebab, banding } = props
  const router = useRouter()
  const [pending, start] = useTransition()
  const [galat, setGalat] = useState<string | null>(null)
  const [formBanding, setFormBanding] = useState(false)

  const sisa = sisaHari(bandingBatas)
  const bisaTtd = bolehTtdGuru(status, sudahTtd)
  const bisaBanding = bolehBanding(status, sudahTtd, bandingBatas)
  const terakhir = banding[banding.length - 1]
  const bisaEskalasi = terakhir && !sudahTtd && bolehEskalasi(terakhir)

  const tandatangani = () =>
    start(async () => {
      const hasil = await ttdGuruAction(kpiId)
      if ('error' in hasil) setGalat(hasil.error)
      else router.refresh()
    })

  return (
    <div className="mt-5 space-y-4">
      {galat && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-wash px-3.5 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{galat}</span>
        </div>
      )}

      {/* ── Keadaan sekarang ──────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4">
        {sudahTtd ? (
          <p className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              <b className="font-semibold">Anda sudah menandatangani rapor ini.</b>{' '}
              <span className="text-muted-foreground">
                Tanda tangan Anda tercatat pada dokumen dan tidak bisa dibatalkan.
              </span>
            </span>
          </p>
        ) : status === 'banding' ? (
          <p className="flex items-start gap-2 text-sm">
            <Scale className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              <b className="font-semibold">Banding Anda sedang ditimbang.</b>{' '}
              <span className="text-muted-foreground">
                Rapor ini dibekukan sampai ada putusan — tenggatnya tidak berjalan selama itu.
              </span>
            </span>
          </p>
        ) : status === 'selesai' ? (
          <p className="flex items-start gap-2 text-sm">
            <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <b className="font-semibold">Rapor ini sudah final.</b>{' '}
              <span className="text-muted-foreground">
                {selesaiSebab ? SEBAB_LABELS[selesaiSebab] : ''}. Anda masih boleh
                membubuhkan tanda tangan sebagai tanda menerima, tapi masa banding sudah lewat.
              </span>
            </span>
          </p>
        ) : (
          <p className="text-sm">
            <b className="font-semibold">Rapor ini menunggu tanggapan Anda.</b>{' '}
            <span className="text-muted-foreground">
              Tandatangani bila Anda setuju, atau ajukan banding bila ada yang perlu diluruskan.
              {sisa !== null && sisa >= 0 && (
                <> Sisa waktu <b className="text-foreground">{sisa} hari</b> ({MASA_BANDING_HARI_KERJA} hari kerja sejak rapor terbit).</>
              )}
            </span>
          </p>
        )}

        {(bisaTtd || bisaBanding) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {bisaTtd && (
              <TombolTtd
                pending={pending}
                onKlik={tandatangani}
                punyaGambar={Boolean(props.ttdSaya)}
                src={props.ttdSaya}
                fokus={props.ttdFokus}
                masihBisaBanding={bisaBanding}
              />
            )}
            {bisaBanding && !formBanding && (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => setFormBanding(true)}>
                <Gavel className="mr-1 h-4 w-4" />Ajukan Banding
              </Button>
            )}
          </div>
        )}
      </div>

      {formBanding && bisaBanding && (
        <FormBanding
          kpiId={kpiId}
          baris={props.baris}
          onBatal={() => setFormBanding(false)}
        />
      )}

      {banding.length > 0 && (
        <RiwayatBanding
          banding={banding}
          baris={props.baris}
          bisaEskalasi={Boolean(bisaEskalasi)}
        />
      )}
    </div>
  )
}

/**
 * Tombol tanda tangan, dengan pratinjau gambar bila ada.
 *
 * Gambar tanda tangan tidak diwajibkan: yang mengikat adalah kehendak guru,
 * dicatat lewat sesi yang hanya bisa dibuka olehnya. Mewajibkan gambar akan
 * menahan persetujuan seseorang yang kebetulan belum sempat memotret tanda
 * tangannya — dan menahan persetujuan bukan tujuan fitur ini.
 */
function TombolTtd({
  pending, onKlik, punyaGambar, src, fokus, masihBisaBanding,
}: {
  pending: boolean
  onKlik: () => void
  punyaGambar: boolean
  src: string | null
  fokus: SignatureFocus
  masihBisaBanding: boolean
}) {
  const [konfirmasi, setKonfirmasi] = useState(false)

  if (!konfirmasi) {
    return (
      <Button size="sm" disabled={pending} onClick={() => setKonfirmasi(true)}>
        <PenLine className="mr-1 h-4 w-4" />Setuju & Tandatangani
      </Button>
    )
  }

  return (
    <div className="w-full rounded-lg border border-primary/40 bg-primary-wash/40 p-3.5">
      <p className="text-sm font-semibold">Tandatangani rapor ini?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {masihBisaBanding
          ? 'Menandatangani berarti Anda menerima seluruh isinya, dan hak banding atas rapor ini gugur.'
          : 'Tanda tangan Anda akan tercatat pada dokumen ini.'}
      </p>

      {punyaGambar && src ? (
        <div className="mt-2.5 w-[180px] rounded-md border bg-card px-3 pb-1.5 pt-1">
          <div className="h-10 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Tanda tangan Anda" className="h-full w-full" style={ttdStyle(fokus)} />
          </div>
          <p className="border-t pt-1 text-center text-[9px] text-muted-foreground">
            gambar tanda tangan Anda
          </p>
        </div>
      ) : (
        <p className="mt-2.5 text-xs text-muted-foreground">
          Anda belum mengunggah gambar tanda tangan. Rapor akan bertuliskan{' '}
          <i>&ldquo;Ditandatangani secara elektronik&rdquo;</i> beserta tanggalnya — sah,
          dan boleh dilengkapi gambar lain kali lewat{' '}
          <Link href="/guru/profil" className="underline underline-offset-2">Profil Saya</Link>.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={pending} onClick={onKlik}>
          Ya, tandatangani
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setKonfirmasi(false)}>
          Batal
        </Button>
      </div>
    </div>
  )
}

/**
 * Formulir banding: pilih indikator, sebut nilai yang menurut Anda benar,
 * tuliskan alasannya.
 *
 * Bentuk inilah inti mekanismenya. Kotak keluhan bebas menghasilkan sanggahan
 * yang tidak bisa diperiksa siapa pun dan berujung pada penolakan yang sudah
 * bisa ditebak; sanggahan yang menunjuk satu indikator dengan angka tandingan
 * bisa dicek terhadap sumbernya dalam beberapa menit.
 */
function FormBanding({
  kpiId, baris, onBatal,
}: {
  kpiId: string
  baris: BarisIndikatorRingkas[]
  onBatal: () => void
}) {
  const router = useRouter()
  const [dipilih, setDipilih] = useState<number[]>([])
  const [state, formAction, pending] = useActionState(ajukanBandingAction, null)

  // Disegarkan lewat efek, bukan di badan render. Memanggil router.refresh()
  // saat merender akan menjadwalkan penyegaran pada setiap render — termasuk
  // render yang dipicu penyegaran sebelumnya — dan halamannya berputar terus.
  useEffect(() => {
    if (state && 'success' in state) router.refresh()
  }, [state, router])

  const tambah = (i: number) => setDipilih(d => (d.includes(i) ? d : [...d, i]))
  const buang = (i: number) => setDipilih(d => d.filter(x => x !== i))
  const tersisa = baris.filter(b => !dipilih.includes(b.indikator))

  return (
    <form action={formAction} className="rounded-lg border bg-card p-4">
      <input type="hidden" name="kpi_id" value={kpiId} />

      <h2 className="text-sm font-semibold">Ajukan banding</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Pilih indikator yang Anda sanggah, lalu sebutkan nilai yang menurut Anda benar
        beserta alasannya. Banding diperiksa SDM terhadap catatan sumbernya; bila ditolak,
        Anda masih bisa menaikkannya ke Kepala RQ.
      </p>

      {state && 'error' in state && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-md bg-destructive-wash px-2.5 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        {dipilih.map(i => {
          const b = baris.find(x => x.indikator === i)!
          return (
            <div key={i} className="rounded-md border p-3">
              <input type="hidden" name="item_indikator" value={i} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{b.nama}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Tercatat: <b className="text-foreground">{b.capaian}</b> → nilai{' '}
                    <b className="text-foreground tabular-nums">{b.nilai}</b> · target {b.target}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => buang(i)}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  aria-label={`Batalkan sanggahan ${b.nama}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-[130px_1fr]">
                <label className="text-xs">
                  <span className="mb-1 block text-muted-foreground">Nilai seharusnya</span>
                  <input
                    type="number"
                    name="item_nilai"
                    min={0}
                    max={100}
                    step="0.1"
                    defaultValue={b.nilai}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-muted-foreground">Alasan &amp; bukti</span>
                  <textarea
                    name="item_alasan"
                    rows={2}
                    required
                    placeholder="Mis. Tanggal 12 & 19 saya izin lisan kepada koordinator, bukan lewat WA."
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            </div>
          )
        })}
      </div>

      {tersisa.length > 0 && (
        <label className="mt-3 block text-xs">
          <span className="mb-1 block text-muted-foreground">
            {dipilih.length === 0 ? 'Pilih indikator yang disanggah' : 'Tambah indikator lain'}
          </span>
          <select
            value=""
            onChange={e => e.target.value !== '' && tambah(Number(e.target.value))}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">— pilih indikator —</option>
            {tersisa.map(b => (
              <option key={b.indikator} value={b.indikator}>
                {b.nama} (nilai {b.nilai})
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-3.5 flex gap-2">
        <Button type="submit" size="sm" disabled={pending || dipilih.length === 0}>
          Kirim Banding
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onBatal}>
          Batal
        </Button>
      </div>
    </form>
  )
}

/** Riwayat banding atas rapor ini, beserta putusan dan jalur eskalasinya. */
function RiwayatBanding({
  banding, baris, bisaEskalasi,
}: {
  banding: KpiBanding[]
  baris: BarisIndikatorRingkas[]
  bisaEskalasi: boolean
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(eskalasiBandingAction, null)
  const [buka, setBuka] = useState(false)
  const terakhir = banding[banding.length - 1]

  useEffect(() => {
    if (state && 'success' in state) router.refresh()
  }, [state, router])

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-2.5 text-sm font-semibold">Riwayat banding</h2>

      <ol className="space-y-3">
        {banding.map(b => (
          <li key={b.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                Tingkat {b.tingkat} — {b.tingkat === 1 ? 'diperiksa SDM' : 'diputus Kepala RQ'}
              </span>
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', BANDING_TONE[b.status])}>
                {BANDING_STATUS_LABELS[b.status]}
              </span>
            </div>

            <ul className="mt-2 space-y-1 text-xs">
              {b.items.map((it, i) => (
                <li key={i} className="text-muted-foreground">
                  <b className="text-foreground">
                    {baris.find(x => x.indikator === it.indikator)?.nama ?? `Indikator ${it.indikator + 1}`}
                  </b>
                  {': '}
                  <span className="tabular-nums">{it.nilaiTercatat} → {it.nilaiDiklaim}</span>
                  {' · '}{it.alasan}
                </li>
              ))}
            </ul>

            {b.eskalasi_alasan && (
              <p className="mt-2 rounded bg-muted/60 px-2 py-1.5 text-xs">
                <span className="text-muted-foreground">Keberatan Anda atas putusan tingkat 1: </span>
                {b.eskalasi_alasan}
              </p>
            )}

            {b.putusan_alasan && (
              <p className="mt-2 border-l-2 border-primary pl-2.5 text-xs">
                <span className="font-medium">Putusan: </span>
                {b.putusan_alasan}
              </p>
            )}
          </li>
        ))}
      </ol>

      {bisaEskalasi && terakhir && (
        <div className="mt-3 border-t pt-3">
          {!buka ? (
            <>
              <p className="text-xs text-muted-foreground">
                Belum sependapat dengan putusan di atas? Perkara yang sama bisa dinaikkan sekali
                ke Kepala RQ, dan putusannya final.
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setBuka(true)}>
                <Scale className="mr-1 h-4 w-4" />Naikkan ke Kepala RQ
              </Button>
            </>
          ) : (
            <form action={formAction}>
              <input type="hidden" name="banding_id" value={terakhir.id} />
              <p className="text-xs text-muted-foreground">
                Butir yang Anda sanggah tetap sama dan tidak bisa diubah — yang naik adalah
                perkara yang sama, bukan perkara baru. Tuliskan keberatan Anda atas putusannya.
              </p>
              {state && 'error' in state && (
                <p className="mt-2 text-xs text-destructive">{state.error}</p>
              )}
              <textarea
                name="alasan"
                rows={3}
                required
                placeholder="Mis. Bukti izin lisan sudah saya sampaikan, tapi putusan hanya merujuk catatan WA."
                className="mt-2 w-full rounded-md border bg-background px-2.5 py-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>Kirim ke Kepala RQ</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setBuka(false)}>Batal</Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
