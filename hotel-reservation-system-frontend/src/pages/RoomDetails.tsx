import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { api, message } from '../api'
import DateRangeModal from '../components/DateRangeModal'
import ReservationSummaryModal from '../components/ReservationSummaryModal'
import { useAuth } from '../auth-context'
import { useLoad } from '../useLoad'
import { dateAfter, money, nightsBetween, type Hotel, type Room, type Reservation } from '../types'
interface Stay { start: string; end: string }
const glyphs = ['▥', '▤', '▦', '▧', '▨', '▩']
const isDay = (value: string | null): value is string => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value)
const readStay = (params: URLSearchParams): Stay | null => {
  const start = params.get('startDate'), end = params.get('endDate')
  return isDay(start) && isDay(end) && start >= dateAfter(0) && end > start ? { start, end } : null
}
export default function RoomDetails() {
  const [params, setParams] = useSearchParams(), path = useParams(), location = useLocation(), { user } = useAuth()
  const id = path.id || params.get('id') || ''
  const [stay, setStay] = useState<Stay | null>(() => readStay(params)), [picking, setPicking] = useState(false)
  const [options, setOptions] = useState<{ query: string; rooms: Room[] } | null>(null), [optionsError, setOptionsError] = useState(''), [revision, setRevision] = useState(0)
  const [chosen, setChosen] = useState<Room | null>(null), [summaryError, setSummaryError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState<Reservation | null>(null)
  const success = useRef<HTMLDivElement>(null)
  const hotel = useLoad<Hotel>('/hotels/' + (id || '0')), rooms = useLoad<Room[]>('/hotels/' + (id || '0') + '/rooms')
  const query = stay ? '?startDate=' + stay.start + '&endDate=' + stay.end : ''
  const nights = stay ? nightsBetween(stay.start, stay.end) : 0
  const current = options && options.query === query ? options : null
  const groups = useMemo(() => {
    if (!current) return []
    const byType = new Map<string, Room[]>()
    for (const room of current.rooms) if (room.available) byType.set(room.type, [...(byType.get(room.type) || []), room])
    return Array.from(byType, ([type, list]) => ({ type, list: [...list].sort((left, right) => left.pricePerNight - right.pricePerNight) }))
      .sort((left, right) => left.list[0].pricePerNight - right.list[0].pricePerNight)
  }, [current])
  useEffect(() => { if (done) success.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [done])
  useEffect(() => {
    if (!query || !id) return
    let current = true
    setOptionsError('')
    api<Room[]>('/hotels/' + id + '/rooms' + query).then(value => { if (current) setOptions({ query, rooms: value }) }).catch(failure => { if (current) setOptionsError(message(failure)) })
    return () => { current = false }
  }, [id, query, revision])
  function applyDates(start: string, end: string) {
    setPicking(false); setStay({ start, end }); setChosen(null); setDone(null)
    setParams({ id, startDate: start, endDate: end })
  }
  async function confirm() {
    if (!chosen || !stay) return
    setBusy(true); setSummaryError('')
    try {
      const fresh = await api<Room[]>('/hotels/' + id + '/rooms' + query)
      setOptions({ query, rooms: fresh })
      // Se vuelve a validar justo antes de guardar: si la habitación elegida se ocupó, se ofrece otra del mismo tipo.
      if (!fresh.find(room => room.id === chosen.id)?.available) { setSummaryError('Esta habitación acaba de ocuparse en esas fechas. Vuelve y elige de nuevo.'); return }
      const reservation = await api<Reservation>('/reservations', { method: 'POST', body: JSON.stringify({ roomId: chosen.id, startDate: stay.start, endDate: stay.end }) })
      setChosen(null); setDone(reservation); setStay(null); setParams({ id })
    } catch (failure) { setSummaryError(message(failure)); setRevision(value => value + 1) } finally { setBusy(false) }
  }
  if (!id) return <section className="page"><h1 className="title">Selecciona un hotel</h1><Link to="/products" className="action">Ver hoteles</Link></section>
  return <section className="page">
    {hotel.loading && <p role="status">Cargando hotel…</p>}{hotel.error && <p role="alert" className="notice-error">{hotel.error}</p>}
    {hotel.data && <><p className="text-orange-700">{hotel.data.location}</p><h1 className="title">{hotel.data.name}</h1><p className="mb-6">{hotel.data.description}</p></>}
    {done && <div ref={success} role="status" className="notice-success">
      <h2 className="text-xl font-bold">¡Tu reserva está lista!</h2><p>Tu estadía ha sido confirmada. ¡Te esperamos!</p>
      <p className="mt-2">Número de reserva: <strong>#{done.id}</strong> · <Link className="underline" to="/my-reservations">Ver mis reservas</Link></p>
      <button type="button" className="action mt-3" onClick={() => setDone(null)}>Hacer otra reserva</button>
    </div>}
    {!done && <form aria-label="Buscar disponibilidad" className="panel flex flex-wrap items-end gap-6" onSubmit={event => event.preventDefault()}>
      <div>
        <span className="block text-sm text-gray-600">Fechas</span>
        <button type="button" className="rounded bg-orange-100 text-orange-700 px-5 py-2 mt-1 hover:bg-orange-200 disabled:opacity-50" disabled={!rooms.data?.length} onClick={() => setPicking(true)}>{stay ? 'Cambiar fechas' : 'Seleccionar fechas'}</button>
      </div>
      {stay && <p className="text-gray-700">{stay.start} → {stay.end} · {nights === 1 ? '1 noche' : nights + ' noches'}</p>}
    </form>}
    {rooms.error && <p role="alert" className="notice-error">{rooms.error}</p>}
    {rooms.loading && <p role="status">Cargando habitaciones…</p>}
    {!rooms.loading && !stay && !done && <p className="panel mt-6">Elige tus fechas para ver las habitaciones disponibles.</p>}
    {stay && <section className="mt-8" aria-label="Habitaciones disponibles">
      <h2 className="text-2xl font-bold mb-4">Habitaciones disponibles</h2>
      {optionsError && <p role="alert" className="notice-error">{optionsError}</p>}
      {!current && !optionsError && <p role="status">Buscando disponibilidad…</p>}
      {current && groups.length === 0 && <div className="panel">
        <p>No hay habitaciones disponibles entre el {stay.start} y el {stay.end}.</p>
        <button type="button" className="action mt-3" onClick={() => setPicking(true)}>Cambiar fechas</button>
      </div>}
      {groups.length > 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{groups.map((group, index) => <article className="bg-white rounded-xl shadow overflow-hidden border" key={group.type}>
        <div className="h-32 bg-gradient-to-br from-orange-100 to-orange-300 flex items-center justify-center text-orange-700 text-5xl" aria-hidden="true">{glyphs[index % glyphs.length]}</div>
        <div className="p-5">
          <h3 className="text-xl font-bold">{group.type}</h3>
          <p className="text-gray-600 my-2">{group.list.length === 1 ? '1 habitación disponible' : group.list.length + ' habitaciones disponibles'}</p>
          <p className="text-orange-700 font-semibold">{money(group.list[0].pricePerNight)} <span className="text-gray-600 font-normal">por noche</span></p>
          <p className="my-2">Total · {nights === 1 ? '1 noche' : nights + ' noches'}: <strong>{money(group.list[0].pricePerNight * nights)}</strong></p>
          {user ? <button className="action" onClick={() => { setChosen(group.list[0]); setSummaryError(''); setDone(null) }}>Reservar {group.type}</button>
            : <Link className="action inline-block" to="/login" state={{ from: location.pathname + location.search }}>Iniciar sesión para reservar</Link>}
        </div>
      </article>)}</div>}
    </section>}
    {picking && rooms.data && <DateRangeModal subtitle={'Disponibilidad de ' + (hotel.data?.name || 'el hotel')} rooms={rooms.data} initialStart={stay?.start || ''} initialEnd={stay?.end || ''} focus={stay?.start || dateAfter(1)}
      onConfirm={applyDates} onCancel={() => setPicking(false)} />}
    {chosen && stay && user && <ReservationSummaryModal hotelName={chosen.hotelName} room={chosen} start={stay.start} end={stay.end} busy={busy} error={summaryError}
      onBack={() => { setChosen(null); setSummaryError('') }} onConfirm={confirm} />}
  </section>
}
