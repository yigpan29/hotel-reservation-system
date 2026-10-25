import { useState } from 'react'
import { useLoad } from '../useLoad'
import type { Page, Reservation } from '../types'
import ReservationList from '../components/ReservationList'
export default function MyReservations() {
  const [page, setPage] = useState(0), { data, loading, error, reload } = useLoad<Page<Reservation>>('/reservations/me?page=' + page)
  return <section className="page"><h1 className="title">Mis reservas</h1>{loading && <p role="status">Cargando reservas…</p>}{error && <p role="alert" className="notice-error">{error}</p>}{data && <><ReservationList reservations={data.content} refresh={reload} /><div className="flex gap-4 mt-6"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1} de {Math.max(data.totalPages, 1)}</span><button disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></div></>}</section>
}
