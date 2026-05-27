'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canEditAbout } from '@/lib/auth/permissions'

export async function updateAboutRqAction(
  _: unknown,
  formData: FormData,
) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canEditAbout(session.role)) return { error: 'Tidak memiliki izin.' }

  const vision  = ((formData.get('vision')  as string) ?? '').trim()
  const mission = ((formData.get('mission') as string) ?? '').trim()
  const history = ((formData.get('history') as string) ?? '').trim()

  const supabase = createServerClient()

  const { error } = await supabase
    .from('about_rq')
    .upsert(
      {
        id: 1,
        vision,
        mission,
        history,
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

  if (error) return { error: error.message || 'Gagal menyimpan perubahan.' }

  revalidatePath('/tentang')
  redirect('/tentang')
}
