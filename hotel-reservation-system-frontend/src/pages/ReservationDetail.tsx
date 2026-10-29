import { Link, useParams } from 'react-router-dom'
import { useLoad } from '../useLoad'
import type { Reservation } from '../types'
import ReservationList from '../components/ReservationList'
export default function ReservationDetail() {
  const { id } = useParams(), { data, loading, error, reload } = useLoad<Reservation>('/reservations/' + id)
  return <section className="page"><h1 className="title">Detalle de reserva</h1>{loading && <p role="status">Cargando reserva…</p>}{error && <p role="alert" className="notice-error">{error}</p>}{data && <ReservationList reservations={[data]} refresh={reload} />}<Link className="inline-block mt-5 underline text-orange-700" to="/notifications">Volver a notificaciones</Link></section>
}
