import { useState } from 'react'
import { api, message } from '../api'
import { guestLabel, guestsLabel, totalGuests } from '../guests'
import { dateAfter, money, type Reservation } from '../types'
import DownloadCertificate from './DownloadCertificate'
export default function ReservationList({ reservations, refresh, certificates = false }: { reservations: Reservation[]; refresh(): void; certificates?: boolean }) {
  const [busy, setBusy] = useState<number | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState('')
  async function cancel(id: number) { setBusy(id); setError(''); setSuccess(''); try { await api('/reservations/' + id + '/cancel', { method: 'POST' }); setSuccess('Reserva #' + id + ' cancelada. El historial se conserva.'); refresh() } catch (error) { setError(message(error)) } finally { setBusy(null) } }
  return <>{error && <p role="alert" className="notice-error">{error}</p>}{success && <p role="status" className="notice-success">{success}</p>}
    {!reservations.length && <p className="panel">No hay reservas para mostrar.</p>}
    <div className="space-y-4">{reservations.map(r => <article className="panel" key={r.id} aria-label={'Reserva ' + r.id}>
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-bold">Reserva #{r.id} · {r.hotelName}</h2><span className={r.status === 'CONFIRMED' ? 'text-green-800' : 'text-gray-600'}>{r.status}</span></div>
      <p>Habitación {r.roomNumber}{r.roomType && ' · ' + r.roomType} · {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)}</p><p>Usuario: {r.username} (#{r.userId}) · Habitación ID: {r.roomId}</p><p>Precio pactado: {money(r.nightlyPrice)} por noche · Total: {money(r.totalPrice)}</p>
      {r.adults !== null && r.children !== null && <p>Huéspedes: {guestLabel({ adults: r.adults, children: r.children })} · {guestsLabel(totalGuests({ adults: r.adults, children: r.children }))}</p>}
      <p className="text-sm text-gray-600">Creada: {r.createdAt?.replace('T', ' ')}{r.cancelledAt && ' · Cancelada: ' + r.cancelledAt.replace('T', ' ')}</p>
      {r.status === 'CONFIRMED' && r.startDate.slice(0, 10) >= dateAfter(0) && <button className="mt-3 border border-orange-600 text-orange-700 rounded px-4 py-2" disabled={busy !== null} onClick={() => cancel(r.id)}>{busy === r.id ? 'Cancelando…' : 'Cancelar reserva #' + r.id}</button>}
      {certificates && <DownloadCertificate id={r.id} />}
    </article>)}</div></>
}
