import type { ReactNode } from 'react'

/**
 * Etiqueta, control y ayuda con un ritmo único. El control va dentro del
 * <label>, así que sigue asociado sin necesidad de ids generados.
 */
export default function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return <div className={className}>
    <label className="block">
      <span className="label">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
    {hint && <span className="hint mt-1.5">{hint}</span>}
  </div>
}

/** Casilla con su texto al lado, alineada a la línea base del resto del formulario. */
export function CheckField({ label, checked, onChange, className = '' }: { label: string; checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  return <label className={'flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink-700 ' + className}>
    <input type="checkbox" className="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    {label}
  </label>
}
