import { useState } from 'react'
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { api, message } from '../api'
import { useAuth } from '../auth-context'
import { useLoad } from '../useLoad'
import { dateAfter, money, type Hotel, type Room, type Reservation } from '../types'
export default function RoomDetails() {
  const [params, setParams] = useSearchParams(), path = useParams(), location = useLocation(), { user } = useAuth()
  const id = path.id || params.get('id') || ''
  const [start, setStart] = useState(params.get('startDate') || dateAfter(1)), [end, setEnd] = useState(params.get('endDate') || dateAfter(2))
  const [dates, setDates] = useState(''), [selected, setSelected] = useState<Room | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState<number | null>(null)
  const hotel = useLoad<Hotel>('/hotels/' + (id || '0')), rooms = useLoad<Room[]>('/hotels/' + (id || '0') + '/rooms' + dates)
  async function confirm() {
    if (!selected) return
    setBusy(true); setError('')
    try { const reservation = await api<Reservation>('/reservations', { method: 'POST', body: JSON.stringify({ roomId: selected.id, startDate: start, endDate: end }) }); setConfirmation(reservation.id); setSelected(null); rooms.reload() } catch (error) { setError(message(error)); setSelected(null); rooms.reload() } finally { setBusy(false) }
  }
  if (!id) return <section className="page"><h1 className="title">Selecciona un hotel</h1><Link to="/products" className="action">Ver hoteles</Link></section>
  return <section className="page">
    {hotel.loading && <p role="status">Cargando hotel…</p>}{hotel.error && <p role="alert" className="notice-error">{hotel.error}</p>}
    {hotel.data && <><p className="text-orange-700">{hotel.data.location}</p><h1 className="title">{hotel.data.name}</h1><p className="mb-6">{hotel.data.description}</p></>}
    <form aria-label="Consultar disponibilidad" className="panel flex flex-wrap gap-4 items-end" onSubmit={event => { event.preventDefault(); setSelected(null); setError(''); setConfirmation(null); const query = '?startDate=' + start + '&endDate=' + end; setDates(query); setParams({ id, startDate: start, endDate: end }); rooms.reload() }}>
      <label>Entrada<input required type="date" min={dateAfter(0)} value={start} onChange={e => { setStart(e.target.value); setSelected(null); setDates('') }} className="field" /></label>
      <label>Salida<input required type="date" min={start} value={end} onChange={e => { setEnd(e.target.value); setSelected(null); setDates('') }} className="field" /></label><button className="action">Consultar disponibilidad</button>
    </form>
    {confirmation !== null && <div role="status" className="notice-success">Reserva #{confirmation} confirmada. <Link className="underline" to="/my-reservations">Ver mis reservas</Link></div>}
    {(error || rooms.error) && <p role="alert" className="notice-error">{error || rooms.error}</p>}
    {rooms.loading ? <p role="status">Cargando habitaciones…</p> : <div className="grid md:grid-cols-2 gap-5 mt-6">{rooms.data?.map(room => <article className="panel" key={room.id}>
      <h2 className="text-xl font-bold">Habitación {room.roomNumber} · {room.type}</h2><p>{money(room.pricePerNight)} por noche</p>
      {dates && <p className="my-2">{room.available ? 'Disponible' : 'No disponible'} · Total: {money(room.totalPrice)}</p>}
      {!dates ? <p className="text-gray-600 mt-3">Consulta tus fechas para reservar.</p> : room.available && (user ? <button className="action mt-3" onClick={() => { setSelected(room); setConfirmation(null); setError('') }}>Reservar habitación {room.roomNumber}</button> : <Link className="action inline-block mt-3" to="/login" state={{ from: location.pathname + location.search }}>Iniciar sesión para reservar</Link>)}
    </article>)}</div>}
    {!rooms.loading && rooms.data?.length === 0 && <p>No hay habitaciones activas en este hotel.</p>}
    {selected && <section className="panel mt-6 border-orange-400" aria-label="Confirmar reserva"><h2 className="text-xl font-bold">Revisa tu reserva</h2><p>Habitación {selected.roomNumber}: {start} → {end}</p><p>{money(selected.pricePerNight)} por noche. Total pactado: <strong>{money(selected.totalPrice)}</strong></p><p className="text-sm my-2">La salida es exclusiva. No se solicita ningún pago ni tarjeta.</p><button className="action" disabled={busy} onClick={confirm}>{busy ? 'Confirmando…' : 'Confirmar reserva'}</button><button className="ml-4 underline" disabled={busy} onClick={() => setSelected(null)}>Volver</button></section>}
  </section>
}
