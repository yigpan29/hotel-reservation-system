import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, message } from '../api'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Notice from '../ui/Notice'
import { Loading } from '../ui/Loading'
import { buttonClass } from '../ui/button-class'
import { CheckCircleIcon, ClockIcon, TicketIcon } from '../ui/Icons'
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
  return <section className="page space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">Tu actividad</p><h1 className="title mt-2">Notificaciones</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-500">Avisos privados de tus reservas. Fechas y horas en Panamá.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy || loading || count === 0} onClick={() => mark()}><CheckCircleIcon />Marcar todas como leídas</Button>
        <Button variant="ghost" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Actualizar</Button>
      </div>
    </header>
    {loading && <Loading label="Cargando notificaciones…" />}
    {error && <Notice tone="error" role="alert">{error}</Notice>}
    {expired && <Link to="/login" className={buttonClass('secondary')}>Volver a iniciar sesión</Link>}
    {!loading && !error && data && <>
      {!data.content.length && <div className="panel flex flex-col items-center gap-3 py-14 text-center">
        <TicketIcon className="h-10 w-10 text-ink-400" /><h2 className="text-lg font-semibold text-ink-900">Todo al día</h2>
        <p className="text-sm text-ink-500">No tienes notificaciones por el momento.</p>
        <Link to="/products" className={buttonClass('primary', 'md', 'mt-2')}>Explorar hoteles</Link>
      </div>}
      <div className="space-y-4">{data.content.map(n => <article key={n.id} aria-label={'Notificación ' + n.id}
        className={'panel relative overflow-hidden ' + (n.read ? '' : 'border-brand-200')}>
        {!n.read && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-600" />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-900">{labels[n.type]}</h2>
          <Badge tone={n.read ? 'neutral' : 'brand'} dot>{n.read ? 'Leída' : 'No leída'}</Badge>
        </div>
        <p className="my-3 break-words text-sm leading-relaxed text-ink-600">{n.message}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-400"><ClockIcon /><time dateTime={n.createdAt}>{time(n.createdAt)}</time>{n.readAt && ' · Leída: ' + time(n.readAt)}</p>
        <footer className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
          <Link className={buttonClass('secondary', 'sm')} to={'/reservations/' + n.reservationId}>Ver reserva #{n.reservationId}</Link>
          {!n.read && <Button variant="ghost" size="sm" disabled={busy} onClick={() => mark(n.id)}>Marcar como leída</Button>}
        </footer>
      </article>)}</div>
      {data.totalPages > 1 && <nav aria-label="Páginas de notificaciones" className="flex flex-wrap items-center justify-center gap-4">
        <Button variant="secondary" size="sm" disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
        <span className="text-sm text-ink-500 tabular">Página {page + 1} de {data.totalPages}</span>
        <Button variant="secondary" size="sm" disabled={busy || page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
      </nav>}
    </>}
  </section>
}
