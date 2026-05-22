const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c])
}

function applyInline(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-[0.85em]">$1</code>')
}

export function renderMarkdown(input: string): string {
  if (!input) return ''
  const escaped = escapeHtml(input)
  const lines = escaped.split('\n')
  const out: string[] = []
  let inList = false

  for (const raw of lines) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*]\s+(.+)$/)
    if (bullet) {
      if (!inList) {
        out.push('<ul class="list-disc pl-5 space-y-0.5 my-1">')
        inList = true
      }
      out.push(`<li>${applyInline(bullet[1])}</li>`)
      continue
    }
    if (inList) {
      out.push('</ul>')
      inList = false
    }
    if (line.trim() === '') {
      out.push('<br />')
    } else {
      out.push(applyInline(line))
    }
  }
  if (inList) out.push('</ul>')

  return out.join('\n').replace(/(<\/(?:strong|em|code)>)\n(?!<)/g, '$1<br />')
}
