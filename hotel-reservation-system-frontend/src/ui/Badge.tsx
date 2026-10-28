import type { ReactNode } from 'react'

/** Etiqueta de estado: un punto de color y una palabra. Nunca el único indicio de algo. */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info'

const tones: Record<BadgeTone, { box: string; dot: string }> = {
  neutral: { box: 'bg-ink-100 text-ink-700 border-ink-200', dot: 'bg-ink-400' },
  brand: { box: 'bg-brand-50 text-brand-700 border-brand-200', dot: 'bg-brand-500' },
  success: { box: 'bg-success-50 text-success-700 border-success-200', dot: 'bg-success-600' },
  danger: { box: 'bg-danger-50 text-danger-700 border-danger-200', dot: 'bg-danger-600' },
  warning: { box: 'bg-warning-50 text-warning-700 border-warning-200', dot: 'bg-warning-700' },
  info: { box: 'bg-info-50 text-info-700 border-info-200', dot: 'bg-info-700' },
}

export default function Badge({ tone = 'neutral', dot = false, children, className = '' }: { tone?: BadgeTone; dot?: boolean; children: ReactNode; className?: string }) {
  return <span className={'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ' + tones[tone].box + ' ' + className}>
    {dot && <span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full ' + tones[tone].dot} />}
    {children}
  </span>
}
