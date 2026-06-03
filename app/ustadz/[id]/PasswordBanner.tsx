'use client'

import { useState } from 'react'
import { Copy, Check, X } from 'lucide-react'

interface Props {
  password: string
  username: string
}

export function PasswordBanner({ password, username }: Props) {
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function copyPwd() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API gagal — ignore, user bisa select & copy manual
    }
  }

  async function copyShareText() {
    const text = `Akun Portal Guru RQ LHI\n\nUsername: ${username}\nPassword: ${password}\n\nLogin di: https://rumahquranlhi.id/guru/login`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      //
    }
  }

  return (
    <div className="rounded-xl border-2 border-warning/40 bg-warning-wash p-5 mb-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-semibold text-warning">⚠ Password telah dibuat</p>
          <p className="text-xs text-warning/90 mt-1">
            Salin password sekarang dan bagikan ke guru. Setelah Anda meninggalkan halaman ini, password tidak akan ditampilkan lagi (hanya hash yang disimpan).
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-warning hover:text-warning/80 shrink-0"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 bg-card border border-warning/20 rounded-lg p-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-warning">Password</p>
          <code className="text-sm font-mono font-semibold select-all break-all">{password}</code>
        </div>
        <button
          onClick={copyPwd}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-warning text-warning-foreground hover:bg-warning/90"
        >
          {copied ? <><Check className="h-3 w-3" />Tersalin</> : <><Copy className="h-3 w-3" />Salin</>}
        </button>
      </div>

      <button
        onClick={copyShareText}
        className="mt-2 text-xs text-warning hover:text-warning/80 underline"
      >
        📋 Salin teks lengkap (username + password + link login) untuk dikirim ke guru
      </button>
    </div>
  )
}
