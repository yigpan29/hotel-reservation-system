import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../ui/Icons'

/**
 * Ventana emergente accesible: foco atrapado, Escape, clic fuera y bloqueo del scroll de la página.
 * En móvil entra como hoja desde abajo (se desplaza su propia altura, sea la que sea) y en
 * escritorio crece desde el centro al 96%: nada aparece de la nada ni desde un punto que no existe.
 */
export default function Modal({ title, subtitle, onClose, dismissible = true, size = 'md', children }: {
  title: string
  subtitle?: ReactNode
  onClose: () => void
  dismissible?: boolean
  size?: 'md' | 'lg'
  children: ReactNode
}) {
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
  return createPortal(<div
    className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/55 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4"
    onMouseDown={event => { if (dismissible && event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keys} data-motion="transform"
      className={'relative flex max-h-[92vh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-popover'
        + ' animate-sheet-in focus:outline-none sm:rounded-2xl sm:animate-panel-in '
        + (size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
      <div className="sticky top-0 z-10 flex items-start gap-4 border-b border-ink-100 bg-white/90 px-5 py-4 backdrop-blur-sm sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
        {dismissible && <button type="button" aria-label="Cerrar" onClick={onClose}
          className="-mr-1.5 -mt-1 rounded-lg p-2 text-ink-500 transition-[background-color,color,transform] duration-160 ease-out-strong hover:bg-ink-100 hover:text-ink-800 active:scale-[0.94]">
          <CloseIcon className="h-5 w-5" />
        </button>}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </div>
  </div>, document.body)
}
