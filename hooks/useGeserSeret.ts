'use client'

import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

/** Elemen yang tetap menerima klik biasa — seret tidak dimulai di atasnya. */
const INTERAKTIF = 'a, button, input, select, textarea, label, [role="button"], [contenteditable="true"]'

/** Jarak (px) sebelum tekanan dianggap seret, supaya klik yang sedikit goyang tidak tertelan. */
const AMBANG = 4

/**
 * Seret-untuk-menggeser horizontal dengan mouse pada wadah `overflow-x-auto`.
 * Tekan di area kosong lalu geser ke kiri/kanan — seperti menggeser kertas.
 * Sentuhan (HP) diabaikan karena geser jari sudah bawaan browser.
 *
 * Pakai: `const seret = useGeserSeret<HTMLDivElement>()` lalu `<div {...seret} …>`.
 */
export function useGeserSeret<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const awal = useRef<{ x: number; scroll: number; id: number; aktif: boolean } | null>(null)

  function onPointerDown(e: ReactPointerEvent<T>) {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return
    if ((e.target as Element).closest(INTERAKTIF)) return
    if (el.scrollWidth <= el.clientWidth) return // tidak ada yang perlu digeser
    awal.current = { x: e.clientX, scroll: el.scrollLeft, id: e.pointerId, aktif: false }
  }

  function onPointerMove(e: ReactPointerEvent<T>) {
    const el = ref.current
    const a = awal.current
    if (!el || !a || e.pointerId !== a.id) return
    const dx = e.clientX - a.x
    if (!a.aktif) {
      if (Math.abs(dx) < AMBANG) return
      a.aktif = true
      el.setPointerCapture(a.id)
      el.style.cursor = 'grabbing'
      el.style.userSelect = 'none'
    }
    el.scrollLeft = a.scroll - dx
  }

  function selesai(e: ReactPointerEvent<T>) {
    const el = ref.current
    const a = awal.current
    if (!el || !a || e.pointerId !== a.id) return
    if (a.aktif && el.hasPointerCapture(a.id)) el.releasePointerCapture(a.id)
    el.style.cursor = ''
    el.style.userSelect = ''
    awal.current = null
  }

  return { ref, onPointerDown, onPointerMove, onPointerUp: selesai, onPointerCancel: selesai }
}
