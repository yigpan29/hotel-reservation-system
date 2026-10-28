import { Link } from 'react-router-dom'
import Badge, { type BadgeTone } from '../ui/Badge'
import { Loading } from '../ui/Loading'
import Notice from '../ui/Notice'
import { ChevronRightIcon, ReceiptIcon } from '../ui/Icons'

export interface CheckoutSummary { id: string; stage: string; paymentStatus: string; reservationId: number | null }

/** El código del backend en palabras; el tono solo acompaña, nunca es el único dato. */
const stages: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pendiente de pago', tone: 'warning' },
  FINALIZING: { label: 'Verificando', tone: 'info' },
  SUCCEEDED: { label: 'Completado', tone: 'success' },
  CANCEL_REQUESTED: { label: 'Cancelación en proceso', tone: 'warning' },
  CANCELLED: { label: 'Cancelado', tone: 'neutral' },
  EXPIRED: { label: 'Tiempo agotado', tone: 'neutral' },
  FAILED: { label: 'Fallido', tone: 'danger' },
  REFUND_PENDING: { label: 'Reembolso en proceso', tone: 'info' },
  REFUNDED: { label: 'Reembolsado', tone: 'neutral' },
  REFUND_FAILED: { label: 'Reembolso con incidencia', tone: 'danger' },
}

/**
 * Los últimos checkouts del cliente. Cada fila entra al detalle, que es donde se
 * consulta el resultado real: aquí solo se resume en qué punto quedó cada uno.
 */
export default function CheckoutHistory({ checkouts, loading, error, className = '' }: {
  checkouts: CheckoutSummary[] | null
  loading: boolean
  error: string
  className?: string
}) {
  if (!loading && !error && !checkouts?.length) return null
  return <section className={'panel ' + className} aria-labelledby="checkout-history">
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
        <ReceiptIcon className="h-5 w-5" />
      </span>
      <div>
        <h2 id="checkout-history" className="text-base font-semibold text-ink-900">Checkouts recientes</h2>
        <p className="text-xs text-ink-500">Últimos 20 · entorno de pruebas</p>
      </div>
    </div>

    {loading && <Loading label="Consultando checkouts…" className="mt-4" />}
    {error && <Notice tone="error" role="alert" className="mt-4">{error}</Notice>}

    {!!checkouts?.length && <ul className="mt-4 space-y-2">
      {checkouts.map(checkout => {
        const stage = stages[checkout.stage] ?? { label: checkout.stage, tone: 'neutral' as BadgeTone }
        return <li key={checkout.id}>
          <Link to={'/checkout/' + checkout.id}
            className="flex items-start gap-3 rounded-xl border border-ink-200 p-3 transition-[background-color,border-color] duration-160 ease-out-strong hover:border-ink-300 hover:bg-ink-50">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-800">
                {checkout.reservationId ? 'Checkout de reserva #' + checkout.reservationId : 'Checkout ' + checkout.id.slice(0, 8)}
              </span>
              {/* El estado baja a su propia línea: el título nunca pierde letras por un badge largo. */}
              <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <Badge tone={stage.tone} dot>{stage.label}</Badge>
                <span className="truncate text-xs text-ink-400">{checkout.paymentStatus}</span>
              </span>
            </span>
            <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-ink-400" />
          </Link>
        </li>
      })}
    </ul>}
  </section>
}
