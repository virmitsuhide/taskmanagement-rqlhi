/**
 * Halaman tujuan sesudah login (?next= dari proxy.ts), bila aman dipakai.
 *
 * Hanya jalur relatif di aplikasi ini ("/guru/setoran…"), bukan "//situs-lain"
 * atau URL penuh — tanpa saringan ini tautan login bisa dipakai melempar orang
 * ke situs lain sesudah ia memasukkan password. Wilayahnya juga harus cocok
 * dengan jenis akunnya: guru ke /guru, pengurus ke luar /guru.
 */
export function tujuanLogin(next: FormDataEntryValue | null, jenis: 'guru' | 'pengurus'): string | null {
  if (typeof next !== 'string' || !/^\/(?![/\\])/.test(next)) return null
  const guru = next === '/guru' || next.startsWith('/guru/') || next.startsWith('/guru?')
  if (next.startsWith('/guru/login') || next.startsWith('/login')) return null
  return (jenis === 'guru') === guru ? next : null
}
