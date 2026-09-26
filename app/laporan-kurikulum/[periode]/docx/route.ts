import { getSession } from '@/lib/auth/session'
import { canViewLaporanKurikulum } from '@/lib/auth/permissions'
import { getEdisi, getEdisiSebelum, namaPeriode, periodeSah } from '@/lib/data/laporan-kurikulum'
import { susunLaporan } from '@/lib/laporan-kurikulum/susun'
import { buatDocx } from '@/lib/laporan-kurikulum/docx'

/** Unduh Bab 02 sebagai .docx — isi sama persis dengan pratinjau. */
export async function GET(_req: Request, { params }: { params: Promise<{ periode: string }> }) {
  const session = await getSession()
  if (!session || !canViewLaporanKurikulum(session.role)) return new Response('Tidak memiliki izin.', { status: 403 })

  const { periode } = await params
  if (!periodeSah(periode)) return new Response('Periode tidak sah.', { status: 400 })
  const [edisi, lalu] = await Promise.all([getEdisi(periode), getEdisiSebelum(periode)])
  if (!edisi) return new Response('Laporan tidak ditemukan.', { status: 404 })

  const buf = await buatDocx(susunLaporan(edisi.data, edisi.narasi, lalu?.data ?? null))
  const nama = `Bab02_Kurikulum_${namaPeriode(periode).replace(' ', '_')}${edisi.status === 'disetujui' ? '' : '_DRAF'}.docx`
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${nama}"`,
      'Cache-Control': 'no-store',
    },
  })
}
