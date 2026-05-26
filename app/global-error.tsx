'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[GlobalError-root]', error)
  }, [error])

  return (
    <html lang="id">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fafafa',
            padding: '24px',
          }}
        >
          <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Aplikasi mengalami gangguan
            </h1>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
              Mohon refresh halaman atau hubungi administrator jika berlanjut.
            </p>
            {error.digest && (
              <p style={{ color: '#888', fontSize: 12, fontFamily: 'monospace', marginBottom: 16 }}>
                {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{
                background: '#111',
                color: '#fff',
                border: 0,
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Coba lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
