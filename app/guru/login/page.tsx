'use client'

import { useActionState } from 'react'
import { loginTeacherAction } from '@/app/actions/teacher-auth'
import {
  LoginShell, LoginFields, LoginError, LoginSubmit, LoginHelp, LoginLinks,
} from '@/components/auth/LoginShell'

export default function TeacherLoginPage() {
  const [state, action, isPending] = useActionState(loginTeacherAction, null)

  return (
    <LoginShell
      eyebrow="Masuk sebagai guru"
      title={<>Assalamu&rsquo;alaikum, <em>Ustadz/ah.</em></>}
      subtitle="Masukkan username & password yang diberikan admin."
      footer={
        <LoginLinks
          label="Bukan guru? Masuk sebagai"
          links={[
            { href: '/login', label: 'Admin / koor' },
            { href: '/karyawan/login', label: 'Karyawan' },
          ]}
        />
      }
    >
      <form action={action} className="space-y-4">
        <LoginFields disabled={isPending} usernamePlaceholder="contoh: ust_ahmad" />
        <LoginError message={state?.error} />
        <LoginSubmit pending={isPending} />
        <LoginHelp />
      </form>
    </LoginShell>
  )
}
