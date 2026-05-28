'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginTeacherAction } from '@/app/actions/teacher-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function TeacherLoginPage() {
  const [state, action, isPending] = useActionState(loginTeacherAction, null)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(180deg, var(--primary-wash) 0%, var(--secondary) 60%)' }}
    >
      <div className="mb-6 text-center">
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-xl text-white text-xl font-bold mb-3"
          style={{ background: 'var(--primary)', fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          📖
        </div>
        <p
          className="text-base font-semibold"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          Portal Guru
        </p>
        <p className="text-xs text-muted-foreground mt-1">Rumah Qur&apos;an LHI</p>
      </div>

      <Card className="w-full max-w-sm border-[var(--border)] shadow-[0_8px_24px_-12px_rgba(184,134,11,0.2)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Masuk sebagai Guru</CardTitle>
          <CardDescription>
            Masukkan username &amp; password yang diberikan admin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="contoh: ust_ahmad"
                autoComplete="username"
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isPending}
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
              style={{ background: 'var(--primary)', borderColor: 'var(--primary)' }}
            >
              {isPending ? 'Memuat...' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-4 text-center space-y-1">
        <p>
          <Link href="/" className="text-xs text-muted-foreground hover:underline">
            ← Kembali ke halaman utama
          </Link>
        </p>
        <p>
          <Link href="/login" className="text-xs text-muted-foreground hover:underline">
            Login sebagai admin/koor →
          </Link>
        </p>
      </div>
    </div>
  )
}
