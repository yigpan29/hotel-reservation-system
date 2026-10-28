import type { ReactNode } from 'react'
import { AlertIcon, CheckCircleIcon, InfoIcon } from './Icons'

/**
 * Mensaje de estado. El icono y el color dan el tono de un vistazo; el título,
 * cuando existe, dice qué pasó, y el cuerpo qué hacer al respecto. Sin título el
 * aviso es solo el texto, para no añadir palabras que un lector de pantalla
 * tendría que repetir.
 */
export type NoticeTone = 'error' | 'success' | 'info' | 'warning'

const tones: Record<NoticeTone, { box: string; icon: string; Glyph: typeof InfoIcon }> = {
  error: { box: 'border-danger-200 bg-danger-50 text-danger-700', icon: 'text-danger-600', Glyph: AlertIcon },
  success: { box: 'border-success-200 bg-success-50 text-success-700', icon: 'text-success-600', Glyph: CheckCircleIcon },
  info: { box: 'border-info-200 bg-info-50 text-info-700', icon: 'text-info-700', Glyph: InfoIcon },
  warning: { box: 'border-warning-200 bg-warning-50 text-warning-700', icon: 'text-warning-700', Glyph: AlertIcon },
}

export default function Notice({ tone = 'info', title, role, children, className = '', ...rest }: {
  tone?: NoticeTone
  title?: string
  role?: 'alert' | 'status' | 'note'
  children: ReactNode
  className?: string
  'aria-live'?: 'polite' | 'assertive'
}) {
  const { box, icon, Glyph } = tones[tone]
  return <div role={role} {...rest} className={'flex gap-3 rounded-xl border p-4 animate-fade-in ' + box + ' ' + className}>
    <Glyph className={'mt-0.5 h-5 w-5 ' + icon} />
    <div className="min-w-0 flex-1 text-sm leading-relaxed">
      {title && <p className="font-semibold text-[0.9375rem]">{title}</p>}
      <div className={title ? 'mt-1' : ''}>{children}</div>
    </div>
  </div>
}
