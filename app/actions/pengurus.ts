'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { AMANAH_LABELS, ROLE_LABELS, canManagePengurus, JABATAN_ORDER } from '@/lib/auth/permissions'
import type { UserRole } from '@/types'

/**
 * Menetapkan siapa yang menduduki sebuah jabatan pengurus.
 *
 * Wewenang kepala RQ. Efeknya bukan sekadar catatan: profil yang tampil di akun
 * jabatan itu langsung ikut berpindah ke rekam guru yang baru (lihat
 * lib/data/pengurus.ts → getProfilAmanah).
 *
 * Kursi dikosongkan dulu, baru diisi. Urutannya penting: indeks unik di
 * drizzle/0046 menjaga satu akun hanya diduduki satu guru, jadi mengisi lebih
 * dulu akan ditolak database selagi pemegang lama masih menempel.
 */
export async function setPemegangAmanahAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManagePengurus(session.role)) return { error: 'Tidak memiliki izin.' }

  const role = formData.get('role') as UserRole
  const orangId = ((formData.get('orang_id') as string) || '').trim()
  // Dari tabel mana orangnya diambil. Kursi Bendahara diduduki karyawan, kursi
  // lain guru — keduanya punya kolom linked_user_id sendiri.
  const sumber = formData.get('sumber') === 'karyawan' ? 'employees' : 'teachers'

  if (!JABATAN_ORDER.includes(role)) return { error: 'Jabatan tidak dikenal.' }

  const supabase = createServerClient()

  const { data: akun } = await supabase
    .from('users')
    .select('id')
    .eq('role', role)
    .maybeSingle()
  if (!akun) return { error: `Akun untuk ${AMANAH_LABELS[role]} belum dibuat.` }

  const userId = (akun as { id: string }).id

  // Guru yang dipilih harus layak DAN belum menduduki kursi lain. Dicek di sini,
  // bukan hanya di dropdown: dropdown hanya menyusun pilihan, sedangkan nilai
  // yang benar-benar terkirim bisa diubah lewat peralatan pengembang peramban.
  if (orangId) {
    const { data: orang } = await supabase
      .from(sumber)
      .select('id, full_name, employment_type, linked_user_id')
      .eq('id', orangId)
      .is('deleted_at', null)
      .maybeSingle()

    const o = orang as {
      full_name: string
      employment_type: string | null
      linked_user_id: string | null
    } | null

    if (!o) return { error: 'Orang yang dipilih tidak ditemukan.' }

    // Syarat kepegawaian hanya berlaku untuk guru. Karyawan RQ jumlahnya
    // sedikit dan semuanya pegawai RQ — tidak ada golongan yang perlu
    // dikecualikan seperti "kontrak RQ" pada guru.
    if (
      sumber === 'teachers' &&
      o.employment_type !== 'tetap_yayasan' &&
      o.employment_type !== 'kontrak_yayasan'
    ) {
      return { error: `${o.full_name} bukan guru tetap/kontrak yayasan, jadi belum bisa diberi amanah.` }
    }
    if (o.linked_user_id && o.linked_user_id !== userId) {
      return {
        error: `${o.full_name} sedang memegang amanah lain. Kosongkan dulu jabatan itu sebelum memindahkannya.`,
      }
    }
  }

  // 1. Kosongkan kursi ini dari pemegang lama.
  // Disapu di kedua tabel, bukan hanya di tabel asal pemegang baru: kursi ini
  // bisa saja sedang dipegang guru lalu dialihkan ke karyawan, atau sebaliknya.
  for (const tabel of ['teachers', 'employees'] as const) {
    const lepas = await supabase.from(tabel).update({ linked_user_id: null }).eq('linked_user_id', userId)
    if (lepas.error && !lepas.error.message?.includes('employees')) {
      return { error: pesanGalat(lepas.error.message) }
    }
  }

  // 2. Dudukkan pemegang baru — kecuali kursinya memang sengaja dikosongkan.
  //
  // Nama di akun ikut berpindah. Bukan duplikasi profil: display_name adalah
  // label akun yang sudah terpasang di puluhan tempat (kepala halaman, daftar
  // tugas, notulen, notifikasi) dan dibawa di dalam token sesi. Kalau tidak ikut
  // diperbarui, seluruh aplikasi akan menyebut nama orang yang sudah tidak
  // menjabat. Saat kursinya dikosongkan namanya kembali ke label jabatan —
  // membiarkan nama pejabat lama menempel di kursi kosong justru lebih
  // menyesatkan daripada label yang netral.
  if (orangId) {
    const duduk = await supabase
      .from(sumber)
      .update({ linked_user_id: userId })
      .eq('id', orangId)
    if (duduk.error) return { error: pesanGalat(duduk.error.message) }

    const { data: orang } = await supabase
      .from(sumber)
      .select('full_name')
      .eq('id', orangId)
      .maybeSingle()
    const nama = (orang as { full_name: string } | null)?.full_name
    if (nama) await supabase.from('users').update({ display_name: nama }).eq('id', userId)
  } else {
    await supabase.from('users').update({ display_name: ROLE_LABELS[role] }).eq('id', userId)
  }

  revalidatePath('/pengurus')
  revalidatePath('/karyawan')
  revalidatePath('/profil')
  revalidatePath('/ustadz')
  revalidatePath('/profil-guru')

  return {
    success: true,
    message: orangId
      ? `${AMANAH_LABELS[role]} diperbarui.`
      : `${AMANAH_LABELS[role]} dikosongkan.`,
  }
}

function pesanGalat(pesan: string): string {
  if (pesan.includes('linked_user_id_unik')) {
    return 'Satu jabatan hanya boleh diduduki satu orang. Muat ulang halaman lalu coba lagi.'
  }
  return `Gagal menyimpan: ${pesan}`
}
