import { useState } from 'react'
import { useLoad } from '../useLoad'
import type { Page, Reservation } from '../types'
import ReservationList from '../components/ReservationList'
import SavedMethodsPanel from '../components/SavedMethodsPanel'
import CheckoutHistory, { type CheckoutSummary } from '../components/CheckoutHistory'
import { Loading } from '../ui/Loading'
import Notice from '../ui/Notice'
import Pager from '../ui/Pager'

/**
 * Mis reservas: la lista manda y ocupa la columna principal; los métodos autorizados
 * y los checkouts quedan al costado, donde se consultan sin competir con las estadías.
 */
export default function MyReservations() {
  const checkouts = useLoad<CheckoutSummary[]>('/checkouts/me')
  const [page, setPage] = useState(0), { data, loading, error, reload } = useLoad<Page<Reservation>>('/reservations/me?page=' + page)
  const total = data?.totalElements ?? 0
  return <section className="page">
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="title">Mis reservas</h1>
        <p className="subtitle">Tus estadías confirmadas y canceladas, con su número de reserva y su precio pactado.</p>
      </div>
      {data && <p className="chip bg-white shadow-card">{total === 1 ? '1 reserva' : total + ' reservas'}</p>}
    </header>

    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0">
        {loading && <Loading label="Cargando reservas…" />}
        {error && <Notice tone="error" role="alert" title="No se pudieron cargar tus reservas">{error}</Notice>}
        {data && <>
          <ReservationList certificates reservations={data.content} refresh={() => { reload(); checkouts.reload() }} />
          {data.totalPages > 1 && <Pager page={page} totalPages={data.totalPages} onPage={setPage}>
            Página {page + 1} de {data.totalPages}
          </Pager>}
        </>}
      </div>

      <aside aria-label="Pagos y checkouts" className="space-y-5 lg:sticky lg:top-24">
        <SavedMethodsPanel />
        <CheckoutHistory checkouts={checkouts.data} loading={checkouts.loading} error={checkouts.error} />
      </aside>
    </div>
  </section>
}
