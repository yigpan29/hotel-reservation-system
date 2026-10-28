import { useState } from 'react'
import { api, message } from '../api'
import { guestLabel, guestsLabel, totalGuests } from '../guests'
import { dateAfter, money, nightsBetween, type Reservation } from '../types'
import Badge, { type BadgeTone } from '../ui/Badge'
import Button from '../ui/Button'
import Notice from '../ui/Notice'
import DownloadCertificate from './DownloadCertificate'
import { BedIcon, CalendarIcon, TicketIcon, UsersIcon } from '../ui/Icons'

const states: Record<string, { label: string; tone: BadgeTone }> = {
  CONFIRMED: { label: 'Confirmada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
}
const stamp = (value: string | null) => value ? value.replace('T', ' ').slice(0, 16) : ''

/**
 * Las reservas como fichas: estado arriba, datos de la estadía en una rejilla y la
 * única acción posible abajo. `admin` añade los identificadores que solo necesita el panel.
 */
export default function ReservationList({ reservations, refresh, admin = false, certificates = false }: { reservations: Reservation[]; refresh(): void; admin?: boolean; certificates?: boolean }) {
  const [busy, setBusy] = useState<number | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState('')
  async function cancel(id: number) { setBusy(id); setError(''); setSuccess(''); try { await api('/reservations/' + id + '/cancel', { method: 'POST' }); setSuccess('Reserva #' + id + ' cancelada. El historial se conserva.'); refresh() } catch (error) { setError(message(error)) } finally { setBusy(null) } }

  if (!reservations.length) return <div className="panel flex flex-col items-center gap-3 py-12 text-center">
    <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-500"><TicketIcon className="h-6 w-6" /></span>
    <p className="text-lg font-semibold text-ink-900">No hay reservas para mostrar</p>
    <p className="max-w-sm text-sm text-ink-500">Cuando confirmes una estadía aparecerá aquí con su número, sus fechas y su precio.</p>
  </div>

  return <>
    {error && <Notice tone="error" role="alert" className="mb-4">{error}</Notice>}
    {success && <Notice tone="success" role="status" className="mb-4">{success}</Notice>}
    <div className="stagger space-y-4">
      {reservations.map(r => {
        const state = states[r.status] ?? { label: r.status, tone: 'neutral' as BadgeTone }
        const nights = nightsBetween(r.startDate.slice(0, 10), r.endDate.slice(0, 10))
        const cancellable = r.status === 'CONFIRMED' && r.startDate.slice(0, 10) >= dateAfter(0)
        const facts = [
          { Glyph: BedIcon, label: 'Habitación', value: r.roomNumber + (r.roomType ? ' · ' + r.roomType : '') },
          { Glyph: CalendarIcon, label: 'Estadía', value: r.startDate.slice(0, 10) + ' → ' + r.endDate.slice(0, 10) + ' · ' + (nights === 1 ? '1 noche' : nights + ' noches') },
          { Glyph: UsersIcon, label: 'Huéspedes', value: r.adults !== null && r.children !== null ? guestLabel({ adults: r.adults, children: r.children }) + ' · ' + guestsLabel(totalGuests({ adults: r.adults, children: r.children })) : 'No registrado (legacy)' },
          { Glyph: TicketIcon, label: 'Precio', value: money(r.totalPrice) + ' · ' + money(r.nightlyPrice) + ' por noche' },
        ]
        return <article className="panel" key={r.id} aria-label={'Reserva ' + r.id} data-motion="transform">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Reserva #{r.id}</p>
              <h3 className="mt-1 truncate text-lg font-semibold text-ink-900">{r.hotelName}</h3>
            </div>
            <Badge tone={state.tone} dot>{state.label}</Badge>
          </div>

          <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {facts.map(({ Glyph, label, value }) => <div key={label} className="flex gap-3">
              <Glyph className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-ink-800">{value}</dd>
              </div>
            </div>)}
          </dl>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <p className="text-xs text-ink-400">
              Creada: {stamp(r.createdAt)}
              {r.cancelledAt && ' · Cancelada: ' + stamp(r.cancelledAt)}
              {admin && ' · Usuario: ' + r.username + ' (#' + r.userId + ') · Habitación ID: ' + r.roomId}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {cancellable && <Button variant="danger" size="sm" disabled={busy !== null} loading={busy === r.id}
                onClick={() => cancel(r.id)}>{busy === r.id ? 'Cancelando…' : 'Cancelar reserva #' + r.id}</Button>}
              {certificates && <DownloadCertificate id={r.id} />}
            </div>
          </div>
        </article>
      })}
    </div>
  </>
}
