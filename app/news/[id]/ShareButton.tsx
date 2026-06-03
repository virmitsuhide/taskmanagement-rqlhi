'use client'

import { useState, useEffect, useRef } from 'react'
import { Share2, Check, Copy, MessageCircle } from 'lucide-react'

/** Ambil API native share kalau tersedia (mobile), else undefined (desktop). */
function getNativeShare(): ((data: ShareData) => Promise<void>) | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as { share?: (data: ShareData) => Promise<void> }).share
}

export function ShareButton({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // Lazy init: di server '' (menu tertutup, tidak masuk HTML), di klien URL asli.
  const [url] = useState(() => (typeof window !== 'undefined' ? window.location.href : ''))
  const ref = useRef<HTMLDivElement>(null)

  // Tutup menu saat klik di luar
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const waText = `${title}\n\nBaca selengkapnya di Rumah Qur'an LHI:\n${url}`
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`

  async function nativeOrCopy() {
    const share = getNativeShare()
    if (share) {
      try { await share.call(navigator, { title, url }); return } catch { /* fall through */ }
    }
    copyLink()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      setOpen(false)
    } catch { /* noop */ }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => (getNativeShare() ? nativeOrCopy() : setOpen(o => !o))}
        className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        title="Bagikan"
      >
        {copied ? (
          <><Check className="h-3 w-3 text-success" /><span className="text-success font-medium">URL tersalin</span></>
        ) : (
          <><Share2 className="h-3 w-3" /><span>Bagikan</span></>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border bg-popover shadow-lg p-1 text-sm">
          <a
            href={waUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <MessageCircle className="h-4 w-4" style={{ color: '#25d366' }} />
            WhatsApp
          </a>
          <a
            href={fbUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <span className="w-4 h-4 inline-flex items-center justify-center font-bold text-[13px]" style={{ color: '#1877f2' }}>f</span>
            Facebook
          </a>
          <a
            href={xUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <span className="w-4 h-4 inline-flex items-center justify-center font-bold text-[13px]">𝕏</span>
            Twitter / X
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
          >
            <Copy className="h-4 w-4 text-muted-foreground" />
            Salin Link
          </button>
        </div>
      )}
    </div>
  )
}
