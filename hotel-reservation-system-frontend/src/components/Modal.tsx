import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Ventana emergente accesible: foco atrapado, Escape, clic fuera y bloqueo del scroll de la página. */
export default function Modal({ title, onClose, dismissible = true, children }: { title: string; onClose: () => void; dismissible?: boolean; children: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null), titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; dialog.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  function keys(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.stopPropagation(); if (dismissible) onClose(); return }
    if (event.key !== 'Tab' || !dialog.current) return
    const items = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), select, a[href]'))
    if (!items.length) { event.preventDefault(); return }
    const edge = event.shiftKey ? items[0] : items[items.length - 1], wrap = event.shiftKey ? items[items.length - 1] : items[0]
    if (document.activeElement === edge || document.activeElement === dialog.current) { event.preventDefault(); wrap.focus() }
  }
  return createPortal(<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onMouseDown={event => { if (dismissible && event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keys} className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-xl p-5 max-h-[92vh] overflow-y-auto focus:outline-none">
      <h2 id={titleId} className="text-xl font-bold">{title}</h2>
      {children}
    </div>
  </div>, document.body)
}
