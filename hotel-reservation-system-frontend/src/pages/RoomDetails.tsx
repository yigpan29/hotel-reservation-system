import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { api, message } from '../api'
import DateRangeModal from '../components/DateRangeModal'
import GuestSelector from '../components/GuestSelector'
import RoomSelector from '../components/RoomSelector'
import ReservationSummaryModal from '../components/ReservationSummaryModal'
import { useAuth } from '../auth-context'
import { useLoad } from '../useLoad'
import { guestLabel, guestsLabel, readGuests, roomsLabel, totalGuests, type Guests } from '../guests'
import { lostRooms, selectedCapacity, selectionIssue, selectionTotal } from '../selection'
import { dateAfter, money, nightsBetween, type Allocation, type Hotel, type Room, type Reservation } from '../types'
interface Stay { start: string; end: string }
const isDay = (value: string | null): value is string => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value)
const readStay = (params: URLSearchParams): Stay | null => {
  const start = params.get('startDate'), end = params.get('endDate')
  return isDay(start) && isDay(end) && start >= dateAfter(0) && end > start ? { start, end } : null
}
export default function RoomDetails() {
  const [params, setParams] = useSearchParams(), path = useParams(), location = useLocation(), { user } = useAuth()
  const id = path.id || params.get('id') || ''
  const [stay, setStay] = useState<Stay | null>(() => readStay(params)), [picking, setPicking] = useState(false)
  const [guests, setGuests] = useState<Guests>(() => readGuests(params)), [selection, setSelection] = useState<number[]>([])
  const [plan, setPlan] = useState<{ query: string; data: Allocation } | null>(null), [planError, setPlanError] = useState(''), [revision, setRevision] = useState(0)
  const [summary, setSummary] = useState(false), [summaryError, setSummaryError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState<Reservation[] | null>(null)
  const success = useRef<HTMLDivElement>(null)
  const hotel = useLoad<Hotel>('/hotels/' + (id || '0')), rooms = useLoad<Room[]>('/hotels/' + (id || '0') + '/rooms')
  const query = stay ? '?hotelId=' + id + '&startDate=' + stay.start + '&endDate=' + stay.end + '&adults=' + guests.adults + '&children=' + guests.children : ''
  const nights = stay ? nightsBetween(stay.start, stay.end) : 0
  const current = plan && plan.query === query ? plan.data : null
  const issue = current ? selectionIssue(current.rooms, selection, guests) : 'Elige al menos una habitación para continuar.'
  const capacity = current ? selectedCapacity(current.rooms, selection) : 0, total = current ? selectionTotal(current.rooms, selection, nights) : 0
  useEffect(() => { if (done) success.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [done])
  // El cálculo se rehace solo: cambiar huéspedes o fechas descarta el plan anterior y vuelve a consultar al backend.
  useEffect(() => {
    if (!query || !id) return
    let live = true
    setPlanError('')
    api<Allocation>('/rooms/allocation' + query).then(value => {
      if (!live) return
      setPlan({ query, data: value })
      // Una habitación que acaba de ocuparse deja de estar elegida.
      setSelection(chosen => chosen.filter(id => value.rooms.find(room => room.id === id)?.available))
    }).catch(failure => { if (live) setPlanError(message(failure)) })
    return () => { live = false }
  }, [id, query, revision])
  function remember(next: Stay | null, people: Guests) {
    setSelection([]); setSummary(false); setDone(null)
    setParams(next ? { id, startDate: next.start, endDate: next.end, adults: String(people.adults), children: String(people.children) }
      : { id, adults: String(people.adults), children: String(people.children) })
  }
  function applyDates(start: string, end: string) { setPicking(false); setStay({ start, end }); remember({ start, end }, guests) }
  function applyGuests(people: Guests) { setGuests(people); remember(stay, people) }
  async function confirm() {
    if (!stay || issue) return
    setBusy(true); setSummaryError('')
    try {
      // Se vuelve a validar justo antes de guardar: se recalcula el plan y el backend revalida al confirmar.
      const fresh = await api<Allocation>('/rooms/allocation' + query)
      setPlan({ query, data: fresh })
      if (lostRooms(fresh.rooms, selection).length) {
        setSelection(chosen => chosen.filter(id => fresh.rooms.find(room => room.id === id)?.available))
        setSummaryError('Alguna de las habitaciones elegidas acaba de ocuparse. Vuelve y elige de nuevo.')
        return
      }
      const created = await api<Reservation[]>('/reservations/group', { method: 'POST', body: JSON.stringify({ roomIds: selection, startDate: stay.start, endDate: stay.end, adults: guests.adults, children: guests.children }) })
      setSummary(false); setSelection([]); setDone(created); setStay(null); setParams({ id })
    } catch (failure) { setSummaryError(message(failure)); setRevision(value => value + 1) } finally { setBusy(false) }
  }
  if (!id) return <section className="page"><h1 className="title">Selecciona un hotel</h1><Link to="/products" className="action">Ver hoteles</Link></section>
  return <section className="page">
    {hotel.loading && <p role="status">Cargando hotel…</p>}{hotel.error && <p role="alert" className="notice-error">{hotel.error}</p>}
    {hotel.data && <><p className="text-orange-700">{hotel.data.location}</p><h1 className="title">{hotel.data.name}</h1><p className="mb-6">{hotel.data.description}</p></>}
    {done && <div ref={success} role="status" className="notice-success">
      <h2 className="text-xl font-bold">¡Tu reserva está lista!</h2><p>Tu estadía ha sido confirmada. ¡Te esperamos!</p>
      <p className="mt-2">{done.length === 1 ? 'Número de reserva: ' : 'Números de reserva: '}<strong>{done.map(reservation => '#' + reservation.id).join(', ')}</strong> · <Link className="underline" to="/my-reservations">Ver mis reservas</Link></p>
      <button type="button" className="action mt-3" onClick={() => setDone(null)}>Hacer otra reserva</button>
    </div>}
    {!done && <form aria-label="Buscar disponibilidad" className="panel flex flex-wrap items-end gap-6" onSubmit={event => event.preventDefault()}>
      <div>
        <span className="block text-sm text-gray-600">Fechas</span>
        <button type="button" className="rounded bg-orange-100 text-orange-700 px-5 py-2 mt-1 hover:bg-orange-200 disabled:opacity-50" disabled={!rooms.data?.length} onClick={() => setPicking(true)}>{stay ? 'Cambiar fechas' : 'Seleccionar fechas'}</button>
      </div>
      <GuestSelector guests={guests} onChange={applyGuests} />
      {stay && <p className="text-gray-700">{stay.start} → {stay.end} · {nights === 1 ? '1 noche' : nights + ' noches'}</p>}
    </form>}
    {rooms.error && <p role="alert" className="notice-error">{rooms.error}</p>}
    {rooms.loading && <p role="status">Cargando habitaciones…</p>}
    {!rooms.loading && !stay && !done && <p className="panel mt-6">Elige tus fechas para ver las habitaciones disponibles.</p>}
    {stay && <section className="mt-8" aria-label="Habitaciones disponibles">
      <h2 className="text-2xl font-bold mb-4">Habitaciones disponibles</h2>
      {planError && <p role="alert" className="notice-error">{planError}</p>}
      {!current && !planError && <p role="status">Buscando disponibilidad…</p>}
      {current && <p role="status" className="mb-4 text-gray-700">{guestLabel(guests)} · {guestsLabel(totalGuests(guests))}: hacen falta al menos {roomsLabel(current.minimumRooms)} (capacidad máxima por habitación: {current.maxRoomCapacity}) y hay {roomsLabel(current.availableRooms)} disponibles entre el {stay.start} y el {stay.end}. Elige las habitaciones una por una.</p>}
      {current && !current.feasible && <p role="alert" className="notice-error">{current.message}</p>}
      {current && <RoomSelector rooms={current.rooms} selection={selection} nights={nights} onChange={setSelection} />}
      {current && <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p role="status">{issue || 'Las habitaciones elegidas alojan a ' + guestsLabel(totalGuests(guests)) + '.'}</p>
          <p className="text-gray-700">{selection.length ? 'Has elegido ' + roomsLabel(selection.length) + ' · capacidad ' + guestsLabel(capacity) + ' · total ' + money(total) : 'Todavía no has elegido habitaciones.'}</p>
        </div>
        {user ? <button type="button" className="action" disabled={Boolean(issue)} onClick={() => { setSummary(true); setSummaryError('') }}>Continuar al resumen</button>
          : <Link className="action inline-block" to="/login" state={{ from: location.pathname + location.search }}>Iniciar sesión para reservar</Link>}
      </div>}
    </section>}
    {picking && rooms.data && <DateRangeModal subtitle={'Disponibilidad de ' + (hotel.data?.name || 'el hotel')} rooms={rooms.data} initialStart={stay?.start || ''} initialEnd={stay?.end || ''} focus={stay?.start || dateAfter(1)}
      onConfirm={applyDates} onCancel={() => setPicking(false)} />}
    {summary && stay && current && user && <ReservationSummaryModal hotelName={hotel.data?.name || current.rooms[0]?.hotelName || ''} rooms={current.rooms} selection={selection} guests={guests} start={stay.start} end={stay.end} busy={busy} error={summaryError}
      onBack={() => { setSummary(false); setSummaryError('') }} onConfirm={confirm} />}
  </section>
}
