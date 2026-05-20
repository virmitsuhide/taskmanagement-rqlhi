'use client'

import { useActionState } from 'react'
import { updateEmailAction, changePasswordAction } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { User } from '@/types'

export function ProfileForm({ user }: { user: User }) {
  const [emailState, emailAction, isEmailPending] = useActionState(updateEmailAction, null)
  const [pwState, pwAction, isPwPending] = useActionState(changePasswordAction, null)

  return (
    <div className="space-y-8">
      {/* Email */}
      <section>
        <h2 className="font-semibold mb-4">Email</h2>
        <form action={emailAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Alamat Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email ?? ''}
              placeholder="nama@email.com"
            />
            <p className="text-xs text-muted-foreground">Digunakan untuk notifikasi email.</p>
          </div>
          {emailState?.error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{emailState.error}</p>
          )}
          {emailState?.success && (
            <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">{emailState.message}</p>
          )}
          <Button type="submit" size="sm" disabled={isEmailPending}>
            {isEmailPending ? 'Menyimpan...' : 'Simpan Email'}
          </Button>
        </form>
      </section>

      {user.can_change_password && (
        <>
          <Separator />
          <section>
            <h2 className="font-semibold mb-4">Ganti Password</h2>
            <form action={pwAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current_password">Password Saat Ini</Label>
                <Input id="current_password" name="current_password" type="password" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new_password">Password Baru</Label>
                <Input id="new_password" name="new_password" type="password" required minLength={8} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_password">Konfirmasi Password Baru</Label>
                <Input id="confirm_password" name="confirm_password" type="password" required />
              </div>
              {pwState?.error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{pwState.error}</p>
              )}
              {pwState?.success && (
                <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">{pwState.message}</p>
              )}
              <Button type="submit" size="sm" disabled={isPwPending}>
                {isPwPending ? 'Menyimpan...' : 'Ganti Password'}
              </Button>
            </form>
          </section>
        </>
      )}

      {!user.can_change_password && (
        <p className="text-sm text-muted-foreground">Akun ini tidak mengizinkan penggantian password.</p>
      )}
    </div>
  )
}
