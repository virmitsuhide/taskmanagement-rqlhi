import type { RaporData } from '@/lib/data/rapor'

const JENJANG_LABELS: Record<string, string> = { paud: 'PAUD', sd: 'SD', smp: 'SMP', sma: 'SMA' }

function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  const full = Math.round(value)
  return (
    <span style={{ color: '#b8860b', letterSpacing: 1 }}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)} <span className="text-muted-foreground text-xs">({value})</span>
    </span>
  )
}

/**
 * Dokumen rapor A4-ready. Dipakai di view guru maupun view publik wali.
 * Print-friendly: pakai warna eksplisit (bukan token tema) agar konsisten saat dicetak.
 */
export function RaporDocument({ data }: { data: RaporData }) {
  const { student, tahsin, tahfidz, period, attendance, teacherName } = data

  return (
    <div
      className="mx-auto bg-white text-[#1a1a1a]"
      style={{ maxWidth: 720, fontFamily: "var(--font-lora), Georgia, serif" }}
    >
      <div className="p-6 md:p-9 border rounded-xl print:border-0" style={{ borderColor: '#e7e3da' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4" style={{ borderBottom: '2px solid #b8860b' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold"
              style={{ background: '#b8860b', fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif" }}
            >
              RQ
            </div>
            <div>
              <h1 className="text-xl font-extrabold leading-tight" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif" }}>
                Rapor Tahsin &amp; Tahfidz
              </h1>
              <p className="text-xs text-muted-foreground">Rumah Qur&apos;an LHI · {period.monthLabel}</p>
            </div>
          </div>
        </div>

        {/* Identitas */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mt-4 p-3 rounded-lg" style={{ background: '#fdf6e3' }}>
          <Field k="Nama" v={student.full_name} />
          <Field k="NIS" v={student.nis ?? '—'} />
          <Field k="Jenjang/Kelas" v={`${JENJANG_LABELS[student.jenjang] ?? student.jenjang}${student.kelas ? ` · ${student.kelas}` : ''}`} />
          <Field k="Halaqoh" v={student.halaqoh_name ?? '—'} />
          <Field k="Guru" v={teacherName ?? '—'} />
          <Field k="Kehadiran" v={`${attendance.activeDays} hari aktif setor`} />
        </div>

        {/* Tahsin */}
        <Section title="📖 Capaian Tahsin">
          <Row k="Posisi Saat Ini" v={tahsin.currentMethod && tahsin.currentJilid ? `${tahsin.currentMethod} ${tahsin.currentJilid} · hal. ${tahsin.currentPage ?? '—'}` : 'Belum ada data'} />
          <Row k="Setoran Bulan Ini" v={`${tahsin.setoranCount}x (${tahsin.lulusCount} lulus)`} />
          <Row k="Makhraj" v={<Stars value={tahsin.avgMakhraj} />} />
          <Row k="Tajwid" v={<Stars value={tahsin.avgTajwid} />} />
          <Row k="Kelancaran" v={<Stars value={tahsin.avgKelancaran} />} />
          {tahsin.promotions.length > 0 && (
            <Row k="Kenaikan Jilid" v={
              <span style={{ color: '#15803d', fontWeight: 600 }}>
                {tahsin.promotions.map(p => `${p.from ?? '?'} → ${p.to}`).join(', ')}
              </span>
            } />
          )}
        </Section>

        {/* Tahfidz */}
        <Section title="✨ Capaian Tahfidz">
          <Row k="Hafalan Saat Ini" v={tahfidz.currentJuz ? `Juz ${tahfidz.currentJuz} (${tahfidz.currentJuzPercent}%)` : 'Belum ada hafalan'} />
          <Row k="Hafalan Baru Bulan Ini" v={`${tahfidz.ayatBaru} ayat`} />
          <Row k="Total Ayat Dihafal" v={`${tahfidz.totalAyatHafal} ayat`} />
          <Row k="Muroja'ah Bulan Ini" v={`${tahfidz.murojaahCount}x`} />
          <Row k="Kelancaran" v={<Stars value={tahfidz.avgKelancaran} />} />
          {tahfidz.juzMutqinCount > 0 && (
            <Row k="Juz Mutqin" v={<span style={{ color: '#15803d', fontWeight: 600 }}>{tahfidz.juzMutqinCount} juz</span>} />
          )}
          {tahfidz.promotions.length > 0 && (
            <Row k="Juz Selesai Bulan Ini" v={
              <span style={{ color: '#15803d', fontWeight: 600 }}>
                {tahfidz.promotions.map(p => `Juz ${p.juz}`).join(', ')}
              </span>
            } />
          )}
        </Section>

        {/* Catatan */}
        {tahsin.lastNote && (
          <Section title="💬 Catatan Guru">
            <p className="text-sm italic">&ldquo;{tahsin.lastNote}&rdquo;</p>
          </Section>
        )}

        {/* Footer tanda tangan */}
        <div className="flex justify-between mt-8 text-xs">
          <div>
            <p className="text-muted-foreground">Mengetahui,</p>
            <p className="mt-10 font-medium">Kepala RQ LHI</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Yogyakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="mt-10 font-medium">{teacherName ?? 'Wali Halaqoh'}</p>
            <p className="text-muted-foreground">Wali Halaqoh {student.halaqoh_name ?? ''}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="text-muted-foreground">{k}:</span>
      <span className="font-medium">{v}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2
        className="text-sm font-bold pb-1.5 mb-2"
        style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: '#b8860b', borderBottom: '1px solid #e7e3da' }}
      >
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm py-0.5">
      <span className="text-muted-foreground shrink-0">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  )
}
