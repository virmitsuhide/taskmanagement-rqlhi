import { ListChecks } from 'lucide-react'
import {
  drillTahfidzUnit, drillTahsinSemua, kelengkapanBulan, targetSemua,
} from '@/lib/data/analitik-cache'
import { Panel, ActionRow } from '@/components/dashboard/kit'
import type { Jenjang } from '@/types'

/**
 * Daftar isi "yang harus dikerjakan" di ujung kanan pola Z seksi Ringkasan.
 *
 * Panel ini TIDAK menampilkan rincian apa pun — hanya jumlah dan tautan ke
 * seksi di bawah tempat rinciannya berada. Dengan begitu satu informasi
 * hanya punya satu tempat, dan pimpinan tetap bisa melihat seluruh pekerjaan
 * rumah bulan ini tanpa menggulir halaman.
 */
export async function PanelTindakLanjut({ jenjang, fokus, bulan, className }: {
  jenjang: Jenjang | null
  fokus: 'semua' | 'tahsin' | 'tahfidz'
  bulan: string
  className?: string
}) {
  const [drill, drillTahfidz, target, kelengkapan] = await Promise.all([
    drillTahsinSemua(), drillTahfidzUnit(jenjang ?? 'semua'), targetSemua(), kelengkapanBulan(bulan),
  ])

  const drillBelum = drill.filter(u => !jenjang || u.jenjang === jenjang).reduce((n, u) => n + u.belumDiajukan, 0)
  const bawahTarget = target.siswa.filter(s => s.status === 'di_bawah' && (!jenjang || s.jenjang === jenjang)).length
  const halaqohKosong = kelengkapan.rows.filter(r => r.totalSiswa > 0 && r.terisi === 0 && (!jenjang || r.jenjang === jenjang)).length

  return (
    <Panel className={className} title="Perlu Tindak Lanjut" icon={<ListChecks className="h-4 w-4" />}
      sub="Ringkasan pekerjaan dari seksi di bawah — klik untuk melompat.">
      <div className="-mx-2">
        {fokus !== 'tahfidz' && (
          <ActionRow count={drillBelum} tone="destructive" href="#drill-tahsin" label="siswa drill tahsin belum diajukan ujian" />
        )}
        {fokus !== 'tahsin' && (
          <>
            <ActionRow count={drillTahfidz.sedang.length} href="#drill-tahfidz" label="juz tuntas ziyadah, menunggu diajukan ujian" />
            <ActionRow count={bawahTarget} tone="destructive" href="#target" label="siswa tertinggal dari target tahfidz" />
          </>
        )}
        <ActionRow count={halaqohKosong} href="#kelengkapan" label="halaqoh belum mengisi capaian bulan ini" />
      </div>
    </Panel>
  )
}
