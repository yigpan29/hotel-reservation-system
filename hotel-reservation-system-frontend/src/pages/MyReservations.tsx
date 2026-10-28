import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLoad } from '../useLoad'
import type { Page, Reservation } from '../types'
import ReservationList from '../components/ReservationList'
import SavedMethodsPanel from '../components/SavedMethodsPanel'
export default function MyReservations() {
  const checkouts = useLoad<{ id: string; stage: string; paymentStatus: string; reservationId: number | null }[]>('/checkouts/me')
  const [page, setPage] = useState(0), { data, loading, error, reload } = useLoad<Page<Reservation>>('/reservations/me?page=' + page)
  return <section className="page"><h1 className="title">Mis reservas</h1>{loading && <p role="status">Cargando reservas…</p>}{error && <p role="alert" className="notice-error">{error}</p>}{data && <><ReservationList certificates reservations={data.content} refresh={() => { reload(); checkouts.reload() }} /><div className="flex gap-4 mt-6"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1} de {Math.max(data.totalPages, 1)}</span><button disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></div></>}
    <SavedMethodsPanel />
    {checkouts.error && <p role="alert">{checkouts.error}</p>}
    {!!checkouts.data?.length && <section className="panel mt-6"><h2 className="text-xl font-bold">Últimos 20 checkouts de prueba</h2><p>Consulta cada checkout para verificar el pago o reembolso.</p>{checkouts.data.map(c => <p key={c.id}><Link className="underline" to={'/checkout/' + c.id}>Checkout {c.reservationId ? 'de reserva #' + c.reservationId : c.id.slice(0, 8)}</Link> · {c.stage} · {c.paymentStatus}</p>)}</section>}
  </section>

}
