import { punyaKelompokTR } from '@/lib/data/tahsin-rekomendasi'
import { kelompokPengampu } from '@/lib/data/riyadhoh'
import { getGukarGroupsFor } from '@/lib/data/gukar'
import { getCurrentTerm } from '@/lib/data/terms'

/** Tab tambahan Progres per Sesi yang berhak dilihat seorang guru. */
export interface TabTambahanGuru {
  /** Memegang kelompok Tahsin Rekomendasi. */
  tr: boolean
  /** Pengampu Riyadhoh Sabtu (kelompok putra/putri mana pun). */
  riyadhoh: boolean
  /** Mengampu kelompok mentoring gukar di semester berjalan. */
  gukar: boolean
}

/**
 * Tab hanya muncul bagi yang memang mengajar jalur itu — guru lain tidak
 * perlu melihat tab kosong. Gukar dibaca dari kelompok semester berjalan,
 * karena kelompok pembinaan disusun ulang tiap semester.
 */
export async function getTabTambahanGuru(teacherId: string): Promise<TabTambahanGuru> {
  const [tr, riyadhoh, gukar] = await Promise.all([
    punyaKelompokTR(teacherId),
    kelompokPengampu(teacherId).then(k => k.length > 0),
    getCurrentTerm().then(async term => (term ? (await getGukarGroupsFor(teacherId, term.id)).length > 0 : false)),
  ])
  return { tr, riyadhoh, gukar }
}
