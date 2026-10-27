import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, message } from '../api'
import type { Page } from '../types'
import { useNotificationCounter } from '../notification-context'
interface Notice { id: number; reservationId: number; type: 'CONFIRMED' | 'CANCELLED' | 'CHECK_IN_REMINDER'; hotelName: string; startDate: string; endDate: string | null; message: string; createdAt: string; read: boolean; readAt: string | null }
const labels = { CONFIRMED: 'Reserva confirmada', CANCELLED: 'Reserva cancelada', CHECK_IN_REMINDER: 'Recordatorio de entrada' }
const time = (value: string) => new Date(value).toLocaleString('es-PA', { timeZone: 'America/Panama' })
export default function Notifications() {
  const [page, setPage] = useState(0), [revision, setRevision] = useState(0)
  const [data, setData] = useState<Page<Notice> | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [expired, setExpired] = useState(false)
  const { count } = useNotificationCounter()
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setExpired(false)
    api<Page<Notice>>('/notifications?page=' + page + '&size=10', { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(error => { if (!controller.signal.aborted) { setExpired(error instanceof ApiError && error.status === 401); setError(error instanceof ApiError && error.status === 401 ? 'La sesión ha expirado. Inicia sesión nuevamente.' : message(error)) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, revision])
  async function mark(id?: number) {
    setBusy(true); setError('')
    try { await api(id === undefined ? '/notifications/read-all' : '/notifications/' + id + '/read', { method: 'POST' }); setRevision(value => value + 1) }
    catch (error) { setExpired(error instanceof ApiError && error.status === 401); setError(error instanceof ApiError && error.status === 401 ? 'La sesión ha expirado. Inicia sesión nuevamente.' : message(error)) }
    finally { setBusy(false) }
  }
  return <section className="page space-y-5"><h1 className="title">Notificaciones</h1><p>Avisos privados de tus reservas. Fechas y horas en Panamá.</p>
    <div className="flex flex-wrap gap-4"><button className="action" disabled={busy || loading || count === 0} onClick={() => mark()}>Marcar todas como leídas</button><button disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Actualizar</button></div>
    {loading && <p role="status">Cargando notificaciones…</p>}{error && <p role="alert" className="notice-error">{error}</p>}{expired && <Link to="/login" className="underline">Volver a iniciar sesión</Link>}
    {!loading && !error && data && <>{!data.content.length && <p className="panel">No tienes notificaciones por el momento.</p>}
      {data.content.map(n => <article key={n.id} aria-label={'Notificación ' + n.id} className={'panel ' + (n.read ? 'notification-read' : 'notification-unread')}>
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{labels[n.type]}</h2><span>{n.read ? 'Leída' : 'No leída'}</span></div>
        <p className="my-3 break-words">{n.message}</p><p className="text-sm text-gray-600"><time dateTime={n.createdAt}>{time(n.createdAt)}</time>{n.readAt && ' · Leída: ' + time(n.readAt)}</p>
        <div className="flex flex-wrap gap-4 mt-3"><Link className="text-orange-700 underline" to={'/reservations/' + n.reservationId}>Ver reserva #{n.reservationId}</Link>{!n.read && <button className="text-orange-800 underline" disabled={busy} onClick={() => mark(n.id)}>Marcar como leída</button>}</div>
      </article>)}
      {data.totalPages > 1 && <nav aria-label="Páginas de notificaciones" className="flex flex-wrap gap-4"><button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1} de {data.totalPages}</span><button disabled={busy || page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></nav>}
    </>}
  </section>
}
