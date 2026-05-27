'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canEditProgram } from '@/lib/auth/permissions'
import { findProgram } from '@/app/program/_data'

export async function updateProgramDetailAction(
  slug: string,
  _: unknown,
  formData: FormData,
) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canEditProgram(session.role)) return { error: 'Tidak memiliki izin.' }
  if (!findProgram(slug)) return { error: 'Program tidak ditemukan.' }

  const long_description = ((formData.get('long_description') as string) ?? '').trim()
  const curriculum       = ((formData.get('curriculum') as string) ?? '').trim()
  const schedule         = ((formData.get('schedule') as string) ?? '').trim()
  const target_audience  = ((formData.get('target_audience') as string) ?? '').trim()
  const contact_info     = ((formData.get('contact_info') as string) ?? '').trim()

  const supabase = createServerClient()

  const { error } = await supabase
    .from('program_details')
    .upsert(
      {
        slug,
        long_description,
        curriculum,
        schedule,
        target_audience,
        contact_info,
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' },
    )

  if (error) return { error: error.message || 'Gagal menyimpan perubahan.' }

  revalidatePath('/program')
  revalidatePath(`/program/${slug}`)
  redirect(`/program/${slug}`)
}
