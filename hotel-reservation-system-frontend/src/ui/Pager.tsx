import type { ReactNode } from 'react'
import Button from './Button'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

/** Paginación: dos pasos y la posición actual. La misma pieza para el cliente y para el panel. */
export default function Pager({ page, totalPages, onPage, children }: { page: number; totalPages: number; onPage: (page: number) => void; children?: ReactNode }) {
  return <nav aria-label="Paginación" className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-5">
    <p className="text-sm text-ink-500">{children ?? <>Página {page + 1} de {Math.max(totalPages, 1)}</>}</p>
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
        <ChevronLeftIcon className="h-4 w-4" />Anterior
      </Button>
      <Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
        Siguiente<ChevronRightIcon className="h-4 w-4" />
      </Button>
    </div>
  </nav>
}
