import Notice from '../ui/Notice'
import { Loading } from '../ui/Loading'
import { buttonClass } from '../ui/button-class'
import { Link, useParams } from 'react-router-dom'
import { useLoad } from '../useLoad'
import type { Reservation } from '../types'
import ReservationList from '../components/ReservationList'
export default function ReservationDetail() {
  const { id } = useParams(), { data, loading, error, reload } = useLoad<Reservation>('/reservations/' + id)
  return <section className="page"><h1 className="title">Detalle de reserva</h1>{loading && <Loading label="Cargando reserva…" />}{error && <Notice tone="error" role="alert">{error}</Notice>}{data && <ReservationList reservations={[data]} refresh={reload} certificates />}<Link className={buttonClass('secondary', 'md', 'mt-5')} to="/notifications">Volver a notificaciones</Link></section>
}
