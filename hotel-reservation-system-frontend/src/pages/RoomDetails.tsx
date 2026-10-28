import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { api, message, idempotencyKey } from '../api'
import PaymentOptions, { type PaymentChoice } from '../components/PaymentOptions'
import DateRangeModal from '../components/DateRangeModal'
import RoomGroup from '../components/RoomGroup'
import ReservationSummaryModal from '../components/ReservationSummaryModal'
import { useAuth } from '../auth-context'
import { useLoad } from '../useLoad'
import { guestLabel, guestsLabel, roomsLabel, totalGuests } from '../guests'
import { addRoom, chooseType, maxRooms, readRooms, removeRoom, roomsGuests, roomsParam, selectionIssue, selectionTotal, setRoomGuests, typeNamed, type RoomGroup as Group } from '../selection'
import { dateAfter, money, nightsBetween, type Allocation, type Hotel, type Room, type Reservation } from '../types'
interface Stay { start: string; end: string }
const isDay = (value: string | null): value is string => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value)
const readStay = (params: URLSearchParams): Stay | null => {
  const start = params.get('startDate'), end = params.get('endDate')
  return isDay(start) && isDay(end) && start >= dateAfter(0) && end > start ? { start, end } : null
}
const isSelectionPrompt = (problem: string) => /^Habitación \d+: Elige un tipo de habitación\.$/.test(problem)
const validationAdvice = (problem: string) => {
  if (problem.includes('No hay habitaciones disponibles')) return 'Prueba con otras fechas para encontrar habitaciones libres.'
  if (problem.includes('Solo ') && problem.includes('de tipo')) return 'Elige otro tipo de habitación o elimina una de las habitaciones solicitadas.'
  if (problem.startsWith('Pediste ') && problem.includes('habitaciones')) return 'Elimina una habitación o prueba con otras fechas.'
  if (problem.includes('Cada habitación necesita al menos un adulto')) return 'Agrega un adulto por habitación o reduce la cantidad de habitaciones.'
  if (problem.includes('ya no admite')) return 'Elige un tipo con mayor capacidad o reduce la cantidad de huéspedes.'
  return 'Agrega otra habitación o reduce la cantidad de huéspedes para continuar.'
}
export default function RoomDetails() {
  const [params, setParams] = useSearchParams(), path = useParams(), location = useLocation(), { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id
  const [checkoutConfig, setCheckoutConfig] = useState<{ enabled: boolean } | null>(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>({ paymentMethodId: null, saveMethod: false })
  const checkoutRequest = useRef<{ fingerprint: string; key: string } | null>(null)
  useEffect(() => {
    let active = true
    setCheckoutConfig(null); setCheckoutError(''); setPaymentChoice({ paymentMethodId: null, saveMethod: false }); checkoutRequest.current = null
    if (userId) void api<{ enabled: boolean }>('/checkouts/config').then(config => { if (active) setCheckoutConfig(config) }).catch(error => { if (active) setCheckoutError(message(error)) })
    return () => { active = false }
  }, [userId])
  const id = path.id || params.get('id') || ''
  const [stay, setStay] = useState<Stay | null>(() => readStay(params)), [picking, setPicking] = useState(false)
  const [booked, setBooked] = useState<Group[]>(() => readRooms(params.get('rooms')))
  const [plan, setPlan] = useState<{ query: string; data: Allocation } | null>(null), [planError, setPlanError] = useState(''), [revision, setRevision] = useState(0)
  const [summary, setSummary] = useState(false), [summaryError, setSummaryError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState<Reservation[] | null>(null)
  const success = useRef<HTMLDivElement>(null)
  const hotel = useLoad<Hotel>('/hotels/' + (id || '0')), rooms = useLoad<Room[]>('/hotels/' + (id || '0') + '/rooms')
  const guests = roomsGuests(booked)
  const query = stay ? '?hotelId=' + id + '&startDate=' + stay.start + '&endDate=' + stay.end + '&adults=' + guests.adults + '&children=' + guests.children : ''
  const nights = stay ? nightsBetween(stay.start, stay.end) : 0
  const current = plan?.data ?? null, stale = plan !== null && plan.query !== query
  const types = current?.types ?? []
  const selectionProblem = current && !stale ? selectionIssue(types, booked) : ''
  const validationProblem = current && !stale
    ? (!current.feasible ? current.message : isSelectionPrompt(selectionProblem) ? '' : selectionProblem)
    : ''
  const issue = !current ? 'Buscando disponibilidad…' : stale ? 'Actualizando disponibilidad…'
    : !current.feasible ? current.message || 'La configuración no está disponible.' : selectionProblem
  const total = selectionTotal(types, booked, nights)
  useEffect(() => { if (done) success.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [done])
  // El cálculo se rehace solo: cambiar fechas, huéspedes o habitaciones vuelve a consultar al backend.
  useEffect(() => {
    if (!query || !id) return
    let live = true
    setPlanError('')
    api<Allocation>('/rooms/allocation' + query).then(value => {
      if (!live) return
      setPlan({ query, data: value })
      // Un tipo que acaba de agotarse deja de estar elegido.
      setBooked(chosen => chosen.map(room => typeNamed(value.types, room.type) ? room : { ...room, type: '' }))
    }).catch(failure => { if (live) setPlanError(message(failure)) })
    return () => { live = false }
  }, [id, query, revision])
  function remember(next: Stay | null, list: Group[]) {
    setBooked(list); setSummary(false); setDone(null)
    setParams(next ? { id, startDate: next.start, endDate: next.end, rooms: roomsParam(list) } : { id, rooms: roomsParam(list) })
  }
  function applyDates(start: string, end: string) { setPicking(false); setStay({ start, end }); remember({ start, end }, booked.map(room => ({ ...room, type: '' }))) }
  async function confirm() {
    if (!stay || issue) return
    setBusy(true); setSummaryError('')
    try {
      // Se vuelve a validar justo antes de guardar: se recalcula el plan y el backend revalida al confirmar.
      const fresh = await api<Allocation>('/rooms/allocation' + query)
      setPlan({ query, data: fresh })
      const gone = selectionIssue(fresh.types, booked)
      if (gone) { setSummaryError(gone + ' Vuelve y elige de nuevo.'); return }
      if (!checkoutConfig) throw new Error(checkoutError || 'No se pudo verificar la configuración de pago. Vuelve a cargar la página.')
      if (checkoutConfig.enabled) {
        const body = { hotelId: Number(id), rooms: booked.map(room => ({ type: room.type, adults: room.adults, children: room.children })), startDate: stay.start, endDate: stay.end, ...paymentChoice }
        const fingerprint = JSON.stringify({ userId: user?.id, ...body })
        if (checkoutRequest.current?.fingerprint !== fingerprint) checkoutRequest.current = { fingerprint, key: idempotencyKey() }
        const result = await api<{ id: string }>('/checkouts/group', { method: 'POST', headers: { 'Idempotency-Key': checkoutRequest.current.key }, body: JSON.stringify(body) })
        setSummary(false); navigate('/checkout/' + result.id); return
      }
      const created = await api<Reservation[]>('/reservations/group', { method: 'POST', body: JSON.stringify({ hotelId: Number(id), rooms: booked.map(room => ({ type: room.type, adults: room.adults, children: room.children })), startDate: stay.start, endDate: stay.end }) })
      setSummary(false); setDone(created); setStay(null); setParams({ id })
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
      {stay && <p className="text-gray-700">{stay.start} → {stay.end} · {nights === 1 ? '1 noche' : nights + ' noches'}</p>}
      {stay && <p className="text-gray-700">{roomsLabel(booked.length)} · {guestLabel(guests)} · {guestsLabel(totalGuests(guests))}</p>}
    </form>}
    {rooms.error && <p role="alert" className="notice-error">{rooms.error}</p>}
    {rooms.loading && <p role="status">Cargando habitaciones…</p>}
    {!rooms.loading && !stay && !done && <p className="panel mt-6">Elige tus fechas para ver las habitaciones disponibles.</p>}
    {stay && <section className="mt-8" aria-label="Habitaciones disponibles">
      <h2 className="text-2xl font-bold mb-4">Habitaciones disponibles</h2>
      {planError && <p role="alert" className="notice-error">{planError}</p>}
      {!current && !planError && <p role="status">Buscando disponibilidad…</p>}
      {current && <p role="status" className="mb-4 text-gray-700">{roomsLabel(booked.length)} para {guestsLabel(totalGuests(guests))}: hay {roomsLabel(current.availableRooms)} disponibles entre el {stay.start} y el {stay.end}.</p>}
      {validationProblem && <div role="alert" className="notice-error mt-5" aria-live="polite">
        <p className="font-semibold">Revisa la configuración de habitaciones y huéspedes</p>
        <p className="mt-1">{validationProblem}</p>
        <p className="mt-2"><strong>Sugerencia:</strong> {validationAdvice(validationProblem)}</p>
      </div>}
      {current && booked.map((_room, index) => <RoomGroup key={index} types={types} rooms={booked} index={index} nights={nights}
        onGuests={value => remember(stay, setRoomGuests(booked, index, types, value))}
        onType={value => remember(stay, chooseType(booked, index, value))}
        onRemove={() => remember(stay, removeRoom(booked, index))} />)}
      {current && <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          {!validationProblem && <p role="status">{issue || 'Todo listo: ' + roomsLabel(booked.length) + ' para ' + guestsLabel(totalGuests(guests)) + '.'}</p>}
          <p className="text-gray-700">Precio total: <strong>{money(total)}</strong></p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded border border-orange-600 text-orange-700 px-5 py-2 disabled:opacity-40" disabled={booked.length >= maxRooms}
            onClick={() => remember(stay, addRoom(booked))}>Agregar habitación</button>
          {user ? <button type="button" className="action" disabled={Boolean(issue)} onClick={() => { setSummary(true); setSummaryError('') }}>Continuar al resumen</button>
            : <Link className="action inline-block" to="/login" state={{ from: location.pathname + location.search }}>Iniciar sesión para reservar</Link>}
        </div>
      </div>}
    </section>}
    {picking && rooms.data && <DateRangeModal subtitle={'Disponibilidad de ' + (hotel.data?.name || 'el hotel')} rooms={rooms.data} initialStart={stay?.start || ''} initialEnd={stay?.end || ''} focus={stay?.start || dateAfter(1)}
      onConfirm={applyDates} onCancel={() => setPicking(false)} />}
    {summary && stay && current && user && <ReservationSummaryModal hotelName={hotel.data?.name || ''} types={types} rooms={booked} start={stay.start} end={stay.end} busy={busy} ready={checkoutConfig !== null} error={summaryError || checkoutError} checkout={checkoutConfig?.enabled ?? false}
      onBack={() => { setSummary(false); setSummaryError('') }} onConfirm={confirm}>{checkoutConfig?.enabled && <PaymentOptions value={paymentChoice} onChange={setPaymentChoice} />}</ReservationSummaryModal>}
  </section>
}
