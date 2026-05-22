import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'

interface Props {
  content: string
  className?: string
}

export function Markdown({ content, className }: Props) {
  return (
    <div
      className={cn(
        'prose-sm leading-relaxed [&_strong]:font-semibold [&_em]:italic [&_ul]:my-1',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}
