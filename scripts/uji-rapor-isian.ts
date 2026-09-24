/**
 * Uji isian merah & halaman template rapor — lib/rapor/docx.ts + medan.ts.
 * Murni, tanpa basis data. Jalankan: npm run uji:rapor-isian
 *
 * XML-nya ditulis ulang dari template ATS SMP 2026/2027 (berkas aslinya di
 * luar repo): deskripsi di kotak teks, isian merah EE0000 di tengah kalimat,
 * hitam lembut 1F1F1F, dan satu Ctrl+Enter sebelum halaman Riyadhoh.
 */
import { bacaDocument, potonganParagraf, warnaMerah } from '../lib/rapor/docx'
import { awalIsianBawaan, cariSlot, ikutHuruf, isiAwalIsian, pemetaanAwal, slotIsianGuru } from '../lib/rapor/medan'

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}

const run = (teks: string, warna?: string) =>
  `<w:r>${warna ? `<w:rPr><w:color w:val="${warna}"/></w:rPr>` : ''}<w:t xml:space="preserve">${teks}</w:t></w:r>`
const p = (...runs: string[]) => `<w:p>${runs.join('')}</w:p>`

console.log('\n## Warna')
periksa(warnaMerah('EE0000') && warnaMerah('FF0000') && warnaMerah('C00000'), 'EE0000, FF0000, C00000 = merah')
periksa(!warnaMerah('1F1F1F') && !warnaMerah('000000') && !warnaMerah('auto') && !warnaMerah(undefined), 'hitam lembut & auto bukan merah')

console.log('\n## Potongan')
const kalimat = p(
  run('Ananda'), run(' berusaha hadir ', 'EE0000'), run('dalam mendengarkan '), run('ustadz', 'EE0000'), run('. Capaian '),
  run('Surat Al-', 'EE0000'), run('Qiyamah ayat 34', 'EE0000'), run('.', '1F1F1F'),
)
const pot = potonganParagraf(kalimat)!
periksa(pot.filter(x => x.merah).map(x => x.teks).join('|') === 'berusaha hadir|ustadz|Surat Al-Qiyamah ayat 34',
  'run merah bersebelahan digabung, spasi tepi dibuang dari isian')
periksa(pot[0].teks === 'Ananda ' && pot[2].teks === ' dalam mendengarkan ', 'spasi tepi pindah ke kalimat hitam')
periksa(potonganParagraf(p(run('Nama'), run(' : '))) === undefined, 'paragraf tanpa merah → tanpa potongan')
periksa(potonganParagraf(p(run('Bayu', 'EE0000'))) === undefined, 'paragraf seluruhnya merah → tanpa potongan (jalur slot biasa)')

console.log('\n## Dokumen utuh')
const xml = `<w:document><w:body>
  ${p(run('LAPORAN PERKEMBANGAN TENGAH SEMESTER I'))}
  <w:p><w:r><w:t>Nama</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>: </w:t></w:r>${run('Bayu Izzan', 'EE0000')}</w:p>
  <w:p><w:r><w:drawing><wps:txbx><w:txbxContent>
    ${p(run('DESKRIPSI PERKEMBANGAN AL-QUR’AN'))}
    ${kalimat}
  </w:txbxContent></wps:txbx></w:drawing></w:r></w:p>
  <w:p><w:r><w:br w:type="page"/></w:r></w:p>
  ${p(run('LAPORAN PERKEMBANGAN TENGAH SEMESTER I'))}
  ${p(run("RIYADHOH AL-QUR'AN SMP ISLAM TERPADU LHI"))}
  ${p(run('Ayah/Bunda, Ananda '), run('sholih', 'EE0000'), run(' telah menempuh riyadhoh.'))}
</w:body></w:document>`
const blok = bacaDocument(xml)
const iHal = blok.findIndex(b => b.jenis === 'halaman')
periksa(blok.filter(b => b.jenis === 'halaman').length === 1 && iHal > 0, 'Ctrl+Enter menjadi satu penanda halaman')
const kotak = blok.find(b => b.jenis === 'kotak')
periksa(kotak?.jenis === 'kotak' && !kotak.potongan?.[0] && !!kotak.potongan?.[1], 'kotak: judul tanpa potongan, deskripsi berpotongan')

const slot = cariSlot(blok)
const peta = pemetaanAwal(slot)
const isian = slot.filter(s => s.konteks)
periksa(isian.map(s => s.id).join(',') === `k${blok.indexOf(kotak!)}.1.m0,k${blok.indexOf(kotak!)}.1.m1,k${blok.indexOf(kotak!)}.1.m2,p${blok.length - 1}.m0`,
  'id isian merah per posisi: kotak.paragraf.m-ke, paragraf.m-ke')
periksa(!slot.some(s => s.id === `k${blok.indexOf(kotak!)}`), 'kotak berisian merah tidak lagi menjadi satu slot deskripsi utuh')
periksa(peta[isian[1].id] === 'sapaan_pengampu' && peta[isian[3].id] === 'sapaan_siswa', '"ustadz" & "sholih" dikenali sebagai sapaan')
periksa(peta[isian[0].id] === 'isian_guru' && peta[isian[2].id] === 'isian_guru', 'isian lain diisi guru')
periksa(peta[`h${iHal}`] === 'halaman_riyadhoh', 'halaman berjudul Riyadhoh otomatis hanya untuk pesertanya')
periksa(slot.find(s => s.prefiks === ': ')?.tebakan === 'nama_siswa', 'baris identitas merah tetap lewat jalur label (nama siswa)')
periksa(isian[0].konteks?.sebelum === 'Ananda' && isian[0].konteks?.sesudah === 'dalam mendengarkan', 'konteks = kalimat hitam yang mengapit')
periksa(slotIsianGuru(blok, peta).length === 2, 'slotIsianGuru hanya isian yang diisi guru')

console.log('\n## Isi awal')
periksa(awalIsianBawaan({ contoh: 'Sangat baik' }) === 'contoh', 'frasa umum → contoh template')
periksa(awalIsianBawaan({ contoh: 'Surat Al-Qiyamah ayat 34' }) === 'kosong', 'contoh berangka (data anak lain) → kosong')
periksa(isiAwalIsian({ contoh: 'x' }, 'capaian_tahfidz', { capaian_tahfidz: 'QS. An-Naba ayat 1' }) === 'QS. An-Naba ayat 1', 'isi awal dari data')
periksa(ikutHuruf('ustadz', 'Ustadzah') === 'ustadzah' && ikutHuruf('Ustadz', 'ustadzah') === 'Ustadzah', 'huruf besar/kecil ikut template')

console.log(gagal ? `\n${gagal} gagal` : '\nSemua lulus')
process.exit(gagal ? 1 : 0)
