import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { getSiteSettings } from '@/lib/data/site'

export async function PublicFooter() {
  const settings = await getSiteSettings()
  const year = new Date().getFullYear()

  const contacts = [
    { icon: '✉', text: settings.footer_email },
    { icon: '☎', text: settings.footer_phone },
    { icon: '◷', text: settings.footer_hours },
  ].filter(c => c.text)

  return (
    <footer className="bg-[#0E3531] pt-11">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1.3fr] gap-9 pb-9 border-b border-white/10">

        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5 mb-3.5">
            <Logo size={34} alt="" />
            <div>
              <div className="font-heading text-lg font-medium leading-tight text-white">{settings.footer_brand}</div>
              <div className="text-[11px] tracking-[0.04em] text-[#9DBBB3]">{settings.footer_brand_sub}</div>
            </div>
          </div>
          <p className="text-xs leading-[1.7] m-0 text-[#9DBBB3]">{settings.footer_tagline}</p>
          <div className="flex gap-2 mt-4">
            {['▶', '✉', '☎', '◈'].map((ic, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-xs text-[#9DBBB3] hover:text-white cursor-pointer transition-colors"
              >
                {ic}
              </div>
            ))}
          </div>
        </div>

        {/* Unit Pendidikan */}
        <div>
          <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-3 text-[#9DBBB3]">
            Unit Pendidikan
          </div>
          {settings.footer_units.map((unit, i) => (
            <div key={unit.name} className={i > 0 ? 'mt-3.5' : undefined}>
              <div className="text-sm font-bold mb-1 text-[#E6EFEC]">{unit.name}</div>
              <div className="text-[11px] leading-[1.8] text-[#9DBBB3] whitespace-pre-line">
                {[unit.address, unit.phone].filter(Boolean).join('\n')}
              </div>
            </div>
          ))}
        </div>

        {/* Jelajahi */}
        <div>
          <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-3 text-[#9DBBB3]">
            Jelajahi
          </div>
          {settings.footer_links.map(link => (
            <Link
              key={link.label}
              href={link.href || '#'}
              className="block text-[13px] mb-2 text-[#9DBBB3] hover:text-white transition-colors no-underline"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Kontak */}
        <div>
          <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-3 text-[#9DBBB3]">
            Kontak &amp; Info
          </div>
          {contacts.map(row => (
            <div key={row.icon} className="flex items-start gap-2 mb-1.5 text-xs text-[#9DBBB3]">
              <span className="shrink-0 mt-0.5">{row.icon}</span>
              <span>{row.text}</span>
            </div>
          ))}

          <div className="text-[11px] font-bold tracking-[0.1em] uppercase mt-4 mb-1.5 text-[#9DBBB3]">
            Newsletter Wali
          </div>
          <div className="flex gap-1.5 mt-1.5">
            <input
              type="email"
              placeholder="email wali..."
              className="flex-1 px-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-[#E6EFEC] text-xs outline-none placeholder:text-[#9DBBB3]"
            />
            <button className="px-3.5 py-2 bg-[#BC5A0B] text-white border-none rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#9A4A09] transition-colors">
              Kirim
            </button>
          </div>
        </div>

      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center text-[10px] text-[#9DBBB3] tracking-[0.4px]">
        <span>© {year} {settings.footer_copyright}</span>
        <span>Kebijakan · Syarat · Masuk Guru</span>
      </div>
    </footer>
  )
}
