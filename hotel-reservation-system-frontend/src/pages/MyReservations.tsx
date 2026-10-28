import { useState } from 'react'
import { useLoad } from '../useLoad'
import type { Page, Reservation } from '../types'
import ReservationList from '../components/ReservationList'
import { Loading } from '../ui/Loading'
import Notice from '../ui/Notice'
import Pager from '../ui/Pager'

export default function MyReservations() {
  const [page, setPage] = useState(0), { data, loading, error, reload } = useLoad<Page<Reservation>>('/reservations/me?page=' + page)
  return <section className="page">
    <h1 className="title">Mis reservas</h1>
    <p className="subtitle">Tus estadías confirmadas y canceladas, con su número de reserva y su precio pactado.</p>
    <div className="mt-8">
      {loading && <Loading label="Cargando reservas…" />}
      {error && <Notice tone="error" role="alert" title="No se pudieron cargar tus reservas">{error}</Notice>}
      {data && <>
        <ReservationList reservations={data.content} refresh={reload} />
        <Pager page={page} totalPages={data.totalPages} onPage={setPage}>
          {data.totalElements === 1 ? '1 reserva' : data.totalElements + ' reservas'} · Página {page + 1} de {Math.max(data.totalPages, 1)}
        </Pager>
      </>}
    </div>
  </section>
}
