'use client'

import { useRef, useState, useCallback } from 'react'
import { Bold, Italic, List, ListOrdered, Smile, Code } from 'lucide-react'
import { cn } from '@/lib/utils'

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Sering',
    emojis: ['👍', '👏', '🙏', '✅', '❌', '📌', '📝', '💡', '⚠️', '🔥', '🎯', '⭐'],
  },
  {
    label: 'Ekspresi',
    emojis: ['😀', '😊', '😎', '🤔', '😅', '😢', '😠', '🥳', '😴', '🙄', '😇', '🤝'],
  },
  {
    label: 'Kerja',
    emojis: ['📅', '⏰', '📊', '📈', '📉', '💼', '📞', '✉️', '🗓️', '📋', '🔔', '🏁'],
  },
  {
    label: 'Islam',
    emojis: ['🕌', '📖', '🤲', '☪️', '🌙', '⭐', '🕋', '📿'],
  },
]

interface Props {
  name?: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  rows?: number
  placeholder?: string
  required?: boolean
  className?: string
}

export function RichTextEditor({
  name,
  defaultValue,
  value: controlledValue,
  onChange,
  rows = 4,
  placeholder,
  required,
  className,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const [emojiOpen, setEmojiOpen] = useState(false)

  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  function wrapSelection(prefix: string, suffix: string = prefix, placeholder = 'teks') {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.substring(start, end) || placeholder
    const next = value.substring(0, start) + prefix + selected + suffix + value.substring(end)
    setValue(next)
    requestAnimationFrame(() => {
      el.focus()
      const cursorStart = start + prefix.length
      el.setSelectionRange(cursorStart, cursorStart + selected.length)
    })
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = value.substring(0, start) + text + value.substring(end)
    setValue(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + text.length
      el.setSelectionRange(pos, pos)
    })
  }

  function prefixLine(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const next = value.substring(0, lineStart) + prefix + value.substring(lineStart)
    setValue(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + prefix.length
      el.setSelectionRange(pos, pos)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      wrapSelection('**')
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      wrapSelection('*')
    }
  }

  return (
    <div className={cn('rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-ring transition', className)}>
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1 bg-muted/40 relative">
        <ToolbarButton onClick={() => wrapSelection('**')} title="Tebal (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection('*')} title="Miring (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection('`')} title="Kode">
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton onClick={() => prefixLine('- ')} title="Daftar poin">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => prefixLine('1. ')} title="Daftar bernomor">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton onClick={() => setEmojiOpen((v) => !v)} title="Emoji" active={emojiOpen}>
          <Smile className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="ml-auto text-[10px] text-muted-foreground/70 pr-1 hidden sm:block">
          **tebal**  ·  *miring*  ·  - daftar  ·  1. nomor
        </span>

        {emojiOpen && (
          <div
            className="absolute top-full right-0 z-30 mt-1 w-72 rounded-md border bg-popover shadow-lg p-2 space-y-2"
            onMouseLeave={() => setEmojiOpen(false)}
          >
            {EMOJI_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 mb-1">
                  {group.label}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        insertAtCursor(emoji)
                        setEmojiOpen(false)
                      }}
                      className="h-7 w-7 rounded hover:bg-accent text-base leading-none flex items-center justify-center"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <textarea
        ref={textareaRef}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        required={required}
        className="w-full resize-y bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

function ToolbarButton({
  children, onClick, title, active,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  )
}
