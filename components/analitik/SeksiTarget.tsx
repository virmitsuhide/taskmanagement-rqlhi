import Link from 'next/link'
import { AlertTriangle, ListChecks, Target } from 'lucide-react'
import { targetSemua } from '@/lib/data/analitik-cache'
import type { RingkasStatus, StatusSiswa } from '@/lib/data/target-tahfidz'
import { LABEL_ALASAN, RENCANA, TOLERANSI_PEKAN, type AlasanTanpaTarget, type KodeRencana } from '@/lib/rq/target-tahfidz'
import { Panel, ActionRow } from '@/components/dashboard/kit'
import { Seksi, Kunci, type InfoSeksi } from './seksi'
import type { Jenjang } from '@/types'

/** Unit tempat sebuah rencana berlaku — untuk menyaring menurut filter unit. */
const UNIT_RENCANA: Record<KodeRencana, Jenjang[]> = {
  sd_clil: ['sd'],
  sd_quls: ['sd', 'sd_juara'],
  smp_internal: ['smp'],
  smp_eksternal: ['smp'],
}

const STATUS: { kunci: StatusSiswa; label: string; warna: string; wash: string }[] = [
  { kunci: 'di_bawah', label: 'Di bawah', warna: 'var(--destructive)', wash: 'var(--destructive-wash)' },
  { kunci: 'sesuai', label: 'Sesuai', warna: 'var(--success)', wash: 'var(--success-wash)' },
  { kunci: 'di_atas', label: 'Melampaui', warna: 'var(--info)', wash: 'var(--info-wash)' },
  { kunci: 'belum_terukur', label: 'Belum terukur', warna: 'var(--muted-foreground)', wash: 'var(--muted)' },
]

const RINCIAN = '/dashboard/analitik/target-tahfidz'

/**
 * Seksi 3 — posisi hafalan siswa terhadap target program hari ini.
 *
 * Ringkasan per rencana dan per kelas saja. Daftar nama per kelas, tabel
 * target akhir bulan, dan kalender pekan efektif tetap di halaman rincian:
 * ketiganya alat kerja koordinator, bukan bacaan pimpinan.
 */
export async function SeksiTarget({ info, jenjang }: { info: InfoSeksi; jenjang: Jenjang | null }) {
  const data = await targetSemua()
  const rencana = data.perRencana.filter(r =>
    r.ringkas.total > 0 && (!jenjang || UNIT_RENCANA[r.kode].includes(jenjang)))
  const siswa = data.siswa.filter(s => !jenjang || s.jenjang === jenjang)

  const jumlah = (k: StatusSiswa) => rencana.reduce((n, r) => n + r.ringkas[k], 0)
  const bawah = jumlah('di_bawah')
  const terukur = bawah + jumlah('sesuai') + jumlah('di_atas')
  const perluDiujikan = rencana.reduce((n, r) => n + r.ringkas.perluDiujikan, 0)
  const alasan = new Map<AlasanTanpaTarget, number>()
  for (const s of siswa) if (s.alasan) alasan.set(s.alasan, (alasan.get(s.alasan) ?? 0) + 1)

  const persenBawah = terukur > 0 ? Math.round((bawah / terukur) * 100) : null
  const pekanLewat = Math.round(data.progres.fraksi * 100)

  return (
    <Seksi
      info={info}
      judul="Target Tahfidz"
      pertanyaan="Apakah hafalan siswa sesuai target programnya?"
      catatan={`semester ${data.progres.semester === 1 ? 'ganjil' : 'genap'}, ${pekanLewat}% pekan efektif sudah lewat`}
      kunci={
        <>
          <Kunci label="Terukur" nilai={terukur.toLocaleString('id-ID')} />
          <Kunci label="Sesuai / di atas"
            nilai={terukur > 0 ? `${100 - (persenBawah ?? 0)}%` : '—'}
            nada={persenBawah === null ? 'netral' : persenBawah < 20 ? 'baik' : persenBawah < 40 ? 'waspada' : 'bahaya'} />
          <Kunci label="Di bawah target" nilai={bawah.toLocaleString('id-ID')} nada={bawah > 0 ? 'bahaya' : 'baik'} />
        </>
      }
    >
      {data.kalender.sumber === 'bawaan' && (
        <p className="flex items-start gap-2 rounded-lg p-3 text-xs" style={{ background: 'var(--warning-wash)' }}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--warning)' }} />
          Kalender pekan efektif masih perkiraan — target ikut perkiraan sampai kalendernya disimpan di halaman rincian.
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Panel
          className="lg:col-span-8"
          title="Posisi vs Target per Program"
          icon={<Target className="h-4 w-4" />}
          sub={`"Di bawah" = tertinggal lebih dari ${TOLERANSI_PEKAN} pekan materi. Klik kelas untuk daftar siswanya.`}
          action={{ href: RINCIAN, label: 'Rincian' }}
        >
          {rencana.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada siswa yang masuk rencana target pada cakupan ini.</p>
          ) : (
            <div className="space-y-5">
              {rencana.map(r => (
                <div key={r.kode}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium">{RENCANA[r.kode].label}</p>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {(r.ringkas.total - r.ringkas.belum_terukur - r.ringkas.tanpa_target).toLocaleString('id-ID')} terukur dari {r.ringkas.total.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <BarStatus ringkas={r.ringkas} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.perTingkat.filter(t => t.ringkas.total > 0).map(t => (
                      <Link key={t.tingkat} href={`${RINCIAN}?rencana=${r.kode}&kelas=${t.tingkat}`}
                        className="rounded-full border px-2.5 py-1 text-[11px] tabular-nums transition-colors hover:bg-muted/40">
                        Kelas {t.tingkat}
                        {t.ringkas.di_bawah > 0
                          ? <span className="text-destructive"> · {t.ringkas.di_bawah} di bawah</span>
                          : <span className="text-muted-foreground"> · aman</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="lg:col-span-4" title="Yang Perlu Dikerjakan" icon={<ListChecks className="h-4 w-4" />}>
          <div className="-mx-2">
            <ActionRow count={bawah} tone="destructive" href={RINCIAN} label="siswa tertinggal dari target — dampingi atau tambah setoran" />
            <ActionRow count={perluDiujikan} href={RINCIAN} label="siswa sudah tuntas juz rencananya, perlu diujikan" />
            <ActionRow count={jumlah('belum_terukur')} tone="muted" href="#kelengkapan" label="siswa belum terukur — belum ada setoran/ujian tercatat" />
          </div>
          {alasan.size > 0 && (
            <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">
              Tidak dibandingkan dengan target: {[...alasan].map(([a, n]) => `${LABEL_ALASAN[a]} (${n})`).join(' · ')}.
            </p>
          )}
        </Panel>
      </div>
    </Seksi>
  )
}

function BarStatus({ ringkas }: { ringkas: RingkasStatus }) {
  const total = ringkas.total - ringkas.tanpa_target
  if (total === 0) return null
  return (
    <>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" role="img"
        aria-label={STATUS.map(s => `${ringkas[s.kunci]} ${s.label.toLowerCase()}`).join(', ')}>
        {STATUS.map(s => ringkas[s.kunci] > 0 && (
          <div key={s.kunci} title={`${s.label}: ${ringkas[s.kunci]}`}
            style={{ width: `${(ringkas[s.kunci] / total) * 100}%`, background: s.kunci === 'belum_terukur' ? 'transparent' : s.warna }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {STATUS.map(s => (
          <span key={s.kunci} className="rounded-full px-2 py-0.5 text-[11px] tabular-nums" style={{ background: s.wash, color: s.warna }}>
            {ringkas[s.kunci].toLocaleString('id-ID')} {s.label.toLowerCase()}
          </span>
        ))}
      </div>
    </>
  )
}
