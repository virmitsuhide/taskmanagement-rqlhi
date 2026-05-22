export function ArabesqueBG({ className = '', opacity = 0.07 }: { className?: string; opacity?: number }) {
  return (
    <svg
      aria-hidden
      className={`absolute inset-0 h-full w-full pointer-events-none ${className}`}
      style={{ opacity }}
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="arabesque" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <circle cx="60" cy="60" r="40" />
            <circle cx="0" cy="0" r="40" />
            <circle cx="120" cy="0" r="40" />
            <circle cx="0" cy="120" r="40" />
            <circle cx="120" cy="120" r="40" />
            <path d="M60 20 L80 60 L60 100 L40 60 Z" />
            <path d="M20 60 L60 40 L100 60 L60 80 Z" />
          </g>
        </pattern>
      </defs>
      <rect width="800" height="600" fill="url(#arabesque)" />
    </svg>
  )
}

export function GeoStar({ size = 220, color, strokeOnly = false }: { size?: number; color?: string; strokeOnly?: boolean }) {
  const c = color ?? 'currentColor'
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
      <g
        transform="translate(100 100)"
        stroke={c}
        strokeWidth="1.25"
        fill={strokeOnly ? 'none' : c}
        fillOpacity={strokeOnly ? 0 : 0.08}
      >
        {[0, 30, 60].map((rot) => (
          <rect
            key={rot}
            x="-65"
            y="-65"
            width="130"
            height="130"
            transform={`rotate(${rot})`}
            rx="6"
          />
        ))}
        <circle r="76" fill="none" />
        <circle r="44" fill="none" />
      </g>
    </svg>
  )
}

export function AbstractTile({ height = 140, variant = 0 }: { height?: number; variant?: number }) {
  const variants = [
    { from: 'var(--primary-wash)',     to: 'var(--accent-warm-wash)', accent: 'var(--primary)' },
    { from: 'var(--accent-warm-wash)', to: 'var(--primary-wash)',     accent: 'var(--accent-warm)' },
    { from: 'var(--primary-wash)',     to: 'var(--primary)',          accent: 'var(--primary-foreground)' },
    { from: 'var(--accent-warm-wash)', to: 'var(--primary)',          accent: 'var(--accent-warm)' },
  ]
  const v = variants[variant % variants.length]
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height, background: `linear-gradient(135deg, ${v.from} 0%, ${v.to} 100%)` }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden>
        <g fill="none" stroke={v.accent} strokeWidth="1.2" opacity="0.6">
          <circle cx="320" cy="70" r="50" />
          <circle cx="320" cy="70" r="30" />
          <circle cx="320" cy="70" r="14" />
          <path d="M40 110 Q120 20 220 90 T380 60" />
          <path d="M0 90 L60 30" opacity="0.4" />
          <path d="M80 130 L140 70" opacity="0.4" />
        </g>
      </svg>
    </div>
  )
}

export function HeroIllustration({ size = 420 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 420 420" aria-hidden>
      <defs>
        <linearGradient id="hero-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary-wash)" />
          <stop offset="100%" stopColor="var(--accent-warm-wash)" />
        </linearGradient>
        <linearGradient id="hero-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent-warm)" />
        </linearGradient>
      </defs>
      <rect width="420" height="420" rx="48" fill="url(#hero-grad)" />
      <g stroke="url(#hero-stroke)" strokeWidth="1.4" fill="none" opacity="0.9">
        <circle cx="210" cy="210" r="150" />
        <circle cx="210" cy="210" r="110" />
        <circle cx="210" cy="210" r="70" />
        <path d="M210 60 L260 210 L210 360 L160 210 Z" />
        <path d="M60 210 L210 160 L360 210 L210 260 Z" />
      </g>
      <g transform="translate(210 210)">
        <g stroke="var(--primary)" strokeWidth="1.6" fill="none" opacity="0.7">
          {[0, 45, 90, 135].map((r) => (
            <rect key={r} x="-40" y="-40" width="80" height="80" transform={`rotate(${r})`} rx="4" />
          ))}
        </g>
        <circle r="6" fill="var(--accent-warm)" />
      </g>
    </svg>
  )
}
