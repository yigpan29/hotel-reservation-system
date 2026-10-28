import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, message } from '../api'
import { guestLabel, guestsLabel, totalGuests } from '../guests'
import { dateAfter, money, nightsBetween, prettyDay, type Reservation } from '../types'
import Badge, { type BadgeTone } from '../ui/Badge'
import Button from '../ui/Button'
import { buttonClass } from '../ui/button-class'
import Notice from '../ui/Notice'
import { ArrowRightIcon, BedIcon, CalendarIcon, TicketIcon, UsersIcon } from '../ui/Icons'
import DownloadCertificate from './DownloadCertificate'

const states: Record<string, { label: string; tone: BadgeTone }> = {
  CONFIRMED: { label: 'Confirmada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
}
/** '2026-10-28T15:29:…' → '28 oct 2026, 15:29'. */
const stamp = (value: string | null) => value ? prettyDay(value) + ', ' + value.slice(11, 16) : ''

/**
 * Las reservas como fichas: identificador y estado arriba, la estadía en una rejilla
 * de datos, el importe destacado y las acciones al pie. `admin` añade los
 * identificadores que solo necesita el panel; `certificates`, la constancia en PDF.
 */
export default function ReservationList({ reservations, refresh, admin = false, certificates = false }: { reservations: Reservation[]; refresh(): void; admin?: boolean; certificates?: boolean }) {
  const [busy, setBusy] = useState<number | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState('')
  async function cancel(id: number) { setBusy(id); setError(''); setSuccess(''); try { await api('/reservations/' + id + '/cancel', { method: 'POST' }); setSuccess('Reserva #' + id + ' cancelada. El historial se conserva.'); refresh() } catch (error) { setError(message(error)) } finally { setBusy(null) } }

  if (!reservations.length) return <div className="panel flex flex-col items-center gap-3 py-14 text-center">
    <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-500"><TicketIcon className="h-6 w-6" /></span>
    <p className="text-lg font-semibold text-ink-900">No hay reservas para mostrar</p>
    <p className="max-w-sm text-sm leading-relaxed text-ink-500">
      {admin ? 'Ajusta los filtros para encontrar las reservas del hotel.' : 'Cuando confirmes una estadía aparecerá aquí con su número, sus fechas y su importe.'}
    </p>
    {!admin && <Link to="/products" className={buttonClass('primary', 'md', 'mt-2')}>Explorar hoteles<ArrowRightIcon className="h-4 w-4" /></Link>}
  </div>

  return <>
    {error && <Notice tone="error" role="alert" className="mb-4">{error}</Notice>}
    {success && <Notice tone="success" role="status" className="mb-4">{success}</Notice>}
    <ul className="stagger space-y-4">
      {reservations.map(r => {
        const state = states[r.status] ?? { label: r.status, tone: 'neutral' as BadgeTone }
        const start = r.startDate.slice(0, 10), end = r.endDate.slice(0, 10)
        const nights = nightsBetween(start, end)
        const cancellable = r.status === 'CONFIRMED' && start >= dateAfter(0)
        const facts: { Glyph: typeof CalendarIcon; label: string; value: ReactNode; note: string }[] = [
          {
            Glyph: CalendarIcon, label: 'Estadía', note: nights === 1 ? '1 noche' : nights + ' noches',
            // Cada fecha va entera: si no cabe, el salto ocurre junto a la flecha y no dentro de un día.
            value: <><span className="whitespace-nowrap">{prettyDay(start)} →</span> <span className="whitespace-nowrap">{prettyDay(end)}</span></>,
          },
          { Glyph: BedIcon, label: 'Habitación', value: r.roomNumber + (r.roomType ? ' · ' + r.roomType : ''), note: '' },
          {
            Glyph: UsersIcon, label: 'Huéspedes',
            value: r.adults !== null && r.children !== null ? guestLabel({ adults: r.adults, children: r.children }) : 'No registrado (legacy)',
            note: r.adults !== null && r.children !== null ? guestsLabel(totalGuests({ adults: r.adults, children: r.children })) : '',
          },
        ]
        return <li key={r.id}>
          <article className="panel relative overflow-hidden" aria-label={'Reserva ' + r.id} data-motion="transform">
            {/* Franja de estado: el color refuerza la insignia, nunca la sustituye. */}
            <span aria-hidden="true" className={'absolute inset-x-0 top-0 h-1 ' + (r.status === 'CONFIRMED' ? 'bg-success-600' : 'bg-ink-300')} />

            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">Reserva #{r.id}</span>
                  <Badge tone={state.tone} dot>{state.label}</Badge>
                </div>
                <h3 className="mt-2 truncate text-lg font-semibold text-ink-900">{r.hotelName}</h3>
              </div>
              <p className="w-full text-left sm:w-auto sm:text-right">
                <span className="block text-xl font-bold text-ink-900 tabular">{money(r.totalPrice)}</span>
                {r.nightlyPrice !== null && <span className="mt-0.5 block text-xs text-ink-500 tabular">{money(r.nightlyPrice)} por noche</span>}
              </p>
            </header>

            <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-ink-100 pt-5 sm:grid-cols-3">
              {facts.map(({ Glyph, label, value, note }) => <div key={label} className="flex gap-3">
                <Glyph className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                <div className="min-w-0">
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-ink-800">{value}</dd>
                  {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
                </div>
              </div>)}
            </dl>

            <footer className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-ink-100 pt-4">
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-400">
                Creada el {stamp(r.createdAt)}
                {r.cancelledAt && ' · Cancelada el ' + stamp(r.cancelledAt)}
                {admin && ' · Usuario: ' + r.username + ' (#' + r.userId + ') · Habitación ID: ' + r.roomId}
              </p>
              {(certificates || cancellable) && <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
                {certificates && <DownloadCertificate id={r.id} />}
                {cancellable && <Button variant="danger" size="sm" className="flex-1 sm:flex-none"
                  aria-label={'Cancelar reserva #' + r.id}
                  disabled={busy !== null} loading={busy === r.id} onClick={() => cancel(r.id)}>
                  {busy === r.id ? 'Cancelando…' : 'Cancelar reserva'}
                </Button>}
              </div>}
            </footer>
          </article>
        </li>
      })}
    </ul>
  </>
}
