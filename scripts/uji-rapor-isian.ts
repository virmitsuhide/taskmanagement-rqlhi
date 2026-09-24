/**
 * Uji isian merah & halaman template rapor — lib/rapor/docx.ts + medan.ts.
 * Murni, tanpa basis data. Jalankan: npm run uji:rapor-isian
 *
 * XML-nya ditulis ulang dari template ATS SMP 2026/2027 (berkas aslinya di
 * luar repo): deskripsi di kotak teks, isian merah EE0000 di tengah kalimat,
 * hitam lembut 1F1F1F, dan satu Ctrl+Enter sebelum halaman Riyadhoh.
 */
import { bacaDocument, kertasDari, potonganParagraf, warnaMerah } from '../lib/rapor/docx'
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
periksa(isian.map(s => s.id).join(',') === `k${blok.indexOf(kotak!)}.1.m0,k${blok.indexOf(kotak!)}.1.m1,k${blok.indexOf(kotak!)}.1.m2,p${blok.findLastIndex(b => b.jenis === 'paragraf')}.m0`,
  'id isian merah per posisi: kotak.paragraf.m-ke, paragraf.m-ke')
periksa(!slot.some(s => s.id === `k${blok.indexOf(kotak!)}`), 'kotak berisian merah tidak lagi menjadi satu slot deskripsi utuh')
periksa(peta[isian[1].id] === 'sapaan_pengampu' && peta[isian[3].id] === 'sapaan_siswa', '"ustadz" & "sholih" dikenali sebagai sapaan')
periksa(peta[isian[0].id] === 'isian_guru' && peta[isian[2].id] === 'isian_guru', 'isian lain diisi guru')
periksa(peta[`h${iHal}`] === 'halaman_riyadhoh', 'halaman berjudul Riyadhoh otomatis hanya untuk pesertanya')
periksa(slot.find(s => s.prefiks === ': ')?.tebakan === 'nama_siswa', 'baris identitas merah tetap lewat jalur label (nama siswa)')
periksa(isian[0].konteks?.sebelum === 'Ananda' && isian[0].konteks?.sesudah === 'dalam mendengarkan', 'konteks = kalimat hitam yang mengapit')
periksa(slotIsianGuru(blok, peta).length === 2, 'slotIsianGuru hanya isian yang diisi guru')

console.log('\n## Tata letak')
// Diturunkan dari template ATS SMP: gaya Title (tebal 12pt, inden 311/1540)
// yang ditimpa sebagian oleh atribut langsung, tab-stop 3600 untuk baris
// identitas, sel kepala biru, kertas F4, dan kop surat di belakang teks.
const gaya = `<w:styles>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="68"/><w:ind w:left="311" w:firstLine="1540"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`
const xmlTata = `<w:document><w:body>
  <w:p><w:pPr><w:pStyle w:val="Title"/><w:spacing w:line="302" w:lineRule="auto"/><w:ind w:right="1879" w:firstLine="409"/></w:pPr>
    <w:r><w:drawing><wp:anchor behindDoc="1"><wp:positionH relativeFrom="page"><wp:align>left</wp:align></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="7569200" cy="11887200"/><a:blip r:embed="rId7"/></wp:anchor></w:drawing></w:r>
    <w:r><w:t>TAHUN PELAJARAN 2026/2027</w:t></w:r></w:p>
  <w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="3600"/></w:tabs><w:spacing w:before="139"/><w:ind w:left="441"/></w:pPr><w:r><w:t>Kelas</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>: IX A</w:t></w:r></w:p>
  <w:p/><w:p><w:pPr><w:spacing w:before="144"/></w:pPr></w:p>
  <w:tbl><w:tblPr><w:tblInd w:w="952" w:type="dxa"/><w:tblBorders><w:top w:val="single"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1906"/><w:gridCol w:w="1906"/></w:tblGrid>
    <w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:fill="4F81BD"/></w:tcPr><w:p><w:r><w:t>Hadir</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Izin</w:t></w:r></w:p></w:tc></w:tr>
  </w:tbl>
  <w:sectPr><w:pgSz w:w="11920" w:h="18720"/><w:pgMar w:top="1640" w:right="900" w:bottom="280" w:left="1220"/></w:sectPr>
</w:body></w:document>`
const bt = bacaDocument(xmlTata, gaya)
const judul = bt[0]
periksa(judul.jenis === 'paragraf' && judul.tebal && judul.tata?.ukuran === 12, 'gaya Title terwarisi: tebal, 12pt')
periksa(judul.jenis === 'paragraf' && judul.tata?.kiri === 15.55 && judul.tata?.awal === 20.45 && judul.tata?.kanan === 93.95,
  'inden gaya ditimpa per atribut (kiri dari gaya, baris pertama & kanan langsung)')
periksa(judul.jenis === 'paragraf' && Math.abs((judul.tata?.baris ?? 0) - 302 / 240) < 1e-9 && judul.tata?.sebelum === 3.4,
  'spasi baris kelipatan & jarak sebelum dari gaya')
const kelas = bt[1]
periksa(kelas.jenis === 'paragraf' && kelas.tata?.tab === 180 && kelas.tata?.kiri === 22.05, 'tab-stop baris identitas (pt dari margin)')
const jeda = bt[2]
periksa(jeda.jenis === 'jeda' && jeda.baris === 2 && Math.abs((jeda.tinggi ?? 0) - (2 * 11 * 1.15 + 7.2)) < 1e-6,
  'tinggi jeda = jumlah tinggi tiap paragraf kosong')
const tabel = bt[3]
periksa(tabel.jenis === 'tabel' && tabel.tata?.latar?.[0]?.[0] === '#4F81BD' && tabel.tata?.latar?.[0]?.[1] === null,
  'warna sel kepala terbaca')
periksa(tabel.jenis === 'tabel' && tabel.tata?.kolom?.join() === '95.3,95.3' && tabel.tata?.geser === 47.6 && !tabel.tata?.tanpaGaris,
  'lebar kolom, geser tabel, dan garis')
const kertasTata = kertasDari(bt)
periksa(bt[bt.length - 1] === kertasTata && kertasTata?.kertas.lebar === 596 && kertasTata?.kertas.tinggi === 936 && kertasTata?.kertas.margin.join() === '82,45,14,61',
  'blok kertas di akhir: F4 & margin')
periksa(kertasTata?.kertas.huruf === 'Times New Roman', 'huruf dokumen dari gaya Normal')
periksa(kertasTata?.latar.length === 1 && kertasTata.latar[0]?.src === 'rId7' && kertasTata.latar[0]?.x === 0,
  'kop surat di belakang teks menjadi latar halaman 1')
periksa(!cariSlot(bt).some(s => s.id === `p${bt.length - 1}.0`), 'blok kertas tidak menghasilkan slot')
periksa(kertasDari(blok)?.latar.length === 2, 'dokumen dua halaman → dua entri latar')

console.log('\n## Hiasan huruf & garis')
// Dari template ATS: isian merah tebal-miring, "Barakallah" tebal-miring di
// tengah kalimat hitam, nama koordinator bergaris bawah, salam miring, dan
// garis gambar di bawah "     Dikeluarkan di:" (lima spasi di depannya).
const runH = (teks: string, rPr: string) => `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${teks}</w:t></w:r>`
const kalimatHias = p(
  runH('Alhamdulillah', '<w:i/>'), run(', capaian Ananda '),
  runH('Surat Al-', '<w:b/><w:i/><w:color w:val="EE0000"/>'), runH('Qiyamah', '<w:b/><w:i/><w:color w:val="EE0000"/>'),
  run('. '), runH('Barakallah', '<w:b/><w:i/>'), run(' ya.'),
)
const potH = potonganParagraf(kalimatHias)!
periksa(potH.filter(x => x.merah).length === 1 && potH.find(x => x.merah)?.teks === 'Surat Al-Qiyamah',
  'hiasan tidak memecah isian merah (tetap satu slot)')
periksa(!!potH.find(x => x.merah)?.hias?.b && !!potH.find(x => x.merah)?.hias?.i, 'isian merah membawa hiasannya (tebal-miring)')
periksa(potH[0].bagian?.[0]?.teks === 'Alhamdulillah' && !!potH[0].bagian?.[0]?.i && !potH[0].bagian?.[1]?.i,
  'potongan hitam berhias campur dirinci per bagian')
periksa(potH[2].bagian?.some(g => g.teks.startsWith('Barakallah') && g.b && g.i) === true, 'kata tebal-miring di tengah kalimat hitam')

const xmlHias = `<w:document><w:body>
  ${p(runH('Assalamu’alaikum', '<w:i/>'), runH(' warahmatullahi', '<w:i/>'))}
  <w:p><w:r><w:drawing><wp:anchor behindDoc="0"><wp:positionH relativeFrom="column"><wp:posOffset>3685157</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>174781</wp:posOffset></wp:positionV><wp:extent cx="1846052" cy="8626"/><a:prstGeom prst="line"/><wps:style><a:lnRef idx="1"/></wps:style></wp:anchor></w:drawing></w:r>${run('     Dikeluarkan di: Bantul')}</w:p>
  ${p(runH('Maulana Achmad, M.Ag', '<w:u w:val="single"/>'))}
  <w:sectPr><w:pgSz w:w="11920" w:h="18720"/><w:pgMar w:top="1640" w:right="900" w:bottom="280" w:left="1220"/></w:sectPr>
</w:body></w:document>`
const bh = bacaDocument(xmlHias)
const [salam, dikeluarkan, nama] = bh
periksa(salam.jenis === 'paragraf' && !!salam.hias?.[0]?.i, 'salam miring')
periksa(nama.jenis === 'paragraf' && !!nama.hias?.[0]?.u, 'nama koordinator bergaris bawah')
periksa(dikeluarkan.jenis === 'paragraf' && dikeluarkan.garis?.length === 1 && Math.abs(dikeluarkan.garis[0].lebar - 145.36) < 0.01
  && dikeluarkan.garis[0].tebal === 0.5 && Math.abs(dikeluarkan.garis[0].kiri - 290.17) < 0.01, 'garis gambar terbaca: lebar, tebal tema, letak dari margin')
periksa(dikeluarkan.jenis === 'paragraf' && dikeluarkan.segmen[0] === 'Dikeluarkan di: Bantul' && dikeluarkan.tata?.awal === 5 * 0.25 * 11,
  'spasi di awal baris menjadi inden, bukan teks')

console.log('\n## Isi awal')
periksa(awalIsianBawaan({ contoh: 'Sangat baik' }) === 'contoh', 'frasa umum → contoh template')
periksa(awalIsianBawaan({ contoh: 'Surat Al-Qiyamah ayat 34' }) === 'kosong', 'contoh berangka (data anak lain) → kosong')
periksa(isiAwalIsian({ contoh: 'x' }, 'capaian_tahfidz', { capaian_tahfidz: 'QS. An-Naba ayat 1' }) === 'QS. An-Naba ayat 1', 'isi awal dari data')
periksa(ikutHuruf('ustadz', 'Ustadzah') === 'ustadzah' && ikutHuruf('Ustadz', 'ustadzah') === 'Ustadzah', 'huruf besar/kecil ikut template')

console.log(gagal ? `\n${gagal} gagal` : '\nSemua lulus')
process.exit(gagal ? 1 : 0)
