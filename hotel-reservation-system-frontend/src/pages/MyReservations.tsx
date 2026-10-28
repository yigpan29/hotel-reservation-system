import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLoad } from '../useLoad'
import type { Page, Reservation } from '../types'
import ReservationList from '../components/ReservationList'
import { Loading } from '../ui/Loading'
import Notice from '../ui/Notice'
import Pager from '../ui/Pager'
import SavedMethodsPanel from '../components/SavedMethodsPanel'
export default function MyReservations() {
  const checkouts = useLoad<{ id: string; stage: string; paymentStatus: string; reservationId: number | null }[]>('/checkouts/me')
  const [page, setPage] = useState(0), { data, loading, error, reload } = useLoad<Page<Reservation>>('/reservations/me?page=' + page)
  return <section className="page">
    <h1 className="title">Mis reservas</h1>
    <p className="subtitle">Tus estadías confirmadas y canceladas, con su número de reserva y su precio pactado.</p>
    <div className="mt-8">
      {loading && <Loading label="Cargando reservas…" />}
      {error && <Notice tone="error" role="alert" title="No se pudieron cargar tus reservas">{error}</Notice>}
      {data && <>
        <ReservationList certificates reservations={data.content} refresh={() => { reload(); checkouts.reload() }} />
        <Pager page={page} totalPages={data.totalPages} onPage={setPage}>
          {data.totalElements === 1 ? '1 reserva' : data.totalElements + ' reservas'} · Página {page + 1} de {Math.max(data.totalPages, 1)}
        </Pager>
      </>}
    </div>
    <SavedMethodsPanel />
    {checkouts.error && <Notice tone="error" role="alert">{checkouts.error}</Notice>}
    {!!checkouts.data?.length && <section className="panel mt-6"><h2 className="text-xl font-bold">Últimos 20 checkouts de prueba</h2><p>Consulta cada checkout para verificar el pago o reembolso.</p>{checkouts.data.map(c => <p key={c.id}><Link className="underline" to={'/checkout/' + c.id}>Checkout {c.reservationId ? 'de reserva #' + c.reservationId : c.id.slice(0, 8)}</Link> · {c.stage} · {c.paymentStatus}</p>)}</section>}
  </section>
}
