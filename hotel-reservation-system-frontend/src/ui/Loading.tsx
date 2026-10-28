import type { ReactNode } from 'react'

/**
 * Estados de espera. Un indicador que gira rápido (900 ms) hace que la carga se
 * perciba más corta aunque tarde lo mismo; el texto sigue siendo el que anuncia
 * el lector de pantalla, intacto para quien no ve el movimiento.
 */
export function Spinner({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60 ' + className}
    style={{ animationDuration: '900ms' }} />
}

export function Loading({ label, className = '' }: { label: string; className?: string }) {
  return <p role="status" className={'flex items-center gap-2.5 text-sm text-ink-500 ' + className}>
    <Spinner />{label}
  </p>
}

/** Silueta del contenido que viene: evita el salto de la página al llegar los datos. */
export function SkeletonCard() {
  return <div className="card p-0" aria-hidden="true">
    <div className="skeleton h-40 rounded-none" />
    <div className="space-y-3 p-5">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-5 w-3/4" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-2/3" />
      <div className="skeleton mt-5 h-10 w-36 rounded-xl" />
    </div>
  </div>
}

export function SkeletonGrid({ count = 3, children }: { count?: number; children?: ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} />)}
    {children}
  </div>
}
