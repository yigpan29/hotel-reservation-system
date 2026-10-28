import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { api, message } from '../api'
import DateRangeModal from '../components/DateRangeModal'
import RoomGroup from '../components/RoomGroup'
import ReservationSummaryModal from '../components/ReservationSummaryModal'
import StayBar from '../components/StayBar'
import { useAuth } from '../auth-context'
import { useLoad } from '../useLoad'
import { guestLabel, guestsLabel, roomsLabel, totalGuests } from '../guests'
import { addRoom, chooseType, maxRooms, readRooms, removeRoom, roomsGuests, roomsParam, selectionIssue, selectionTotal, setRoomGuests, typeNamed, type RoomGroup as Group } from '../selection'
import { dateAfter, money, nightsBetween, type Allocation, type Hotel, type Room, type Reservation } from '../types'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { buttonClass } from '../ui/button-class'
import Notice from '../ui/Notice'
import { Loading } from '../ui/Loading'
import { ArrowRightIcon, CheckCircleIcon, MapPinIcon, PlusIcon, StarIcon } from '../ui/Icons'

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
      const created = await api<Reservation[]>('/reservations/group', { method: 'POST', body: JSON.stringify({ hotelId: Number(id), rooms: booked.map(room => ({ type: room.type, adults: room.adults, children: room.children })), startDate: stay.start, endDate: stay.end }) })
      setSummary(false); setDone(created); setStay(null); setParams({ id })
    } catch (failure) { setSummaryError(message(failure)); setRevision(value => value + 1) } finally { setBusy(false) }
  }

  if (!id) return <section className="page">
    <h1 className="title">Selecciona un hotel</h1>
    <p className="subtitle">Abre un hotel del catálogo para ver sus habitaciones y su disponibilidad.</p>
    <Link to="/products" className={buttonClass('primary', 'md', 'mt-6')}>Ver hoteles<ArrowRightIcon className="h-4 w-4" /></Link>
  </section>

  return <section className="page">
    <nav aria-label="Ruta" className="mb-5 flex items-center gap-2 text-sm text-ink-500">
      <Link to="/products" className="rounded transition-colors duration-160 hover:text-ink-800">Hoteles</Link>
      <span aria-hidden="true">/</span>
      <span className="truncate font-medium text-ink-700">{hotel.data?.name || 'Hotel'}</span>
    </nav>

    {hotel.loading && <Loading label="Cargando hotel…" />}
    {hotel.error && <Notice tone="error" role="alert" title="No se pudo cargar el hotel">{hotel.error}</Notice>}
    {hotel.data && <header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
          <MapPinIcon className="h-4 w-4" />{hotel.data.location}
        </p>
        {hotel.data.rating !== null && <Badge tone="brand">
          <StarIcon className="h-3.5 w-3.5 fill-brand-400" />{hotel.data.rating.toFixed(1)} / 5
        </Badge>}
      </div>
      <h1 className="title mt-2">{hotel.data.name}</h1>
      <p className="subtitle">{hotel.data.description}</p>
    </header>}

    {done && <div ref={success} role="status" className="mt-8 overflow-hidden rounded-2xl border border-success-200 bg-success-50 p-6 animate-enter-up">
      <div className="flex gap-4">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-success-600 shadow-card">
          <CheckCircleIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-success-700">¡Tu reserva está lista!</h2>
          <p className="mt-1 text-sm text-success-700">Tu estadía ha sido confirmada. ¡Te esperamos!</p>
          <p className="mt-3 text-sm text-ink-700">
            {done.length === 1 ? 'Número de reserva: ' : 'Números de reserva: '}
            <strong className="font-semibold text-ink-900">{done.map(reservation => '#' + reservation.id).join(', ')}</strong>
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/my-reservations" className={buttonClass('primary', 'md')}>Ver mis reservas<ArrowRightIcon className="h-4 w-4" /></Link>
            <Button variant="secondary" onClick={() => setDone(null)}>Hacer otra reserva</Button>
          </div>
        </div>
      </div>
    </div>}

    {!done && <div className="mt-8">
      <StayBar stay={stay} nights={nights} rooms={booked.length} guests={guests}
        disabled={!rooms.data?.length} onPick={() => setPicking(true)} />
    </div>}

    {rooms.error && <Notice tone="error" role="alert" className="mt-6" title="No se pudieron cargar las habitaciones">{rooms.error}</Notice>}
    {rooms.loading && <Loading label="Cargando habitaciones…" className="mt-6" />}

    {stay && <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-label="Habitaciones disponibles" className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="section-title">Habitaciones disponibles</h2>
          {current && <p role="status" className="text-sm text-ink-500">
            {roomsLabel(current.availableRooms)} libres del {stay.start} al {stay.end}
          </p>}
        </div>

        {planError && <Notice tone="error" role="alert" className="mt-5" title="No se pudo calcular la disponibilidad">{planError}</Notice>}
        {!current && !planError && <Loading label="Buscando disponibilidad…" className="mt-5" />}

        {validationProblem && <Notice tone="error" role="alert" aria-live="polite" className="mt-5"
          title="Revisa la configuración de habitaciones y huéspedes">
          <p>{validationProblem}</p>
          <p className="mt-2"><strong className="font-semibold">Sugerencia:</strong> {validationAdvice(validationProblem)}</p>
        </Notice>}

        {current && <div className="mt-5 space-y-6">
          {booked.map((_room, index) => <RoomGroup key={index} types={types} rooms={booked} index={index} nights={nights}
            onGuests={value => remember(stay, setRoomGuests(booked, index, types, value))}
            onType={value => remember(stay, chooseType(booked, index, value))}
            onRemove={() => remember(stay, removeRoom(booked, index))} />)}
        </div>}
      </section>

      {current && <aside aria-label="Resumen de la selección" className="lg:sticky lg:top-24">
        <div className="panel">
          <h2 className="text-base font-semibold text-ink-900">Tu selección</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Habitaciones</dt>
              <dd className="font-medium text-ink-900">{roomsLabel(booked.length)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Huéspedes</dt>
              <dd className="text-right font-medium text-ink-900">{guestLabel(guests)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Noches</dt>
              <dd className="font-medium text-ink-900 tabular">{nights}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-ink-100 pt-4">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink-500">Precio total:</span>
              <strong className="text-xl font-bold text-ink-900 tabular">{money(total)}</strong>
            </p>
            {!validationProblem && <p role="status" className="mt-2 text-sm text-ink-500">
              {issue || 'Todo listo: ' + roomsLabel(booked.length) + ' para ' + guestsLabel(totalGuests(guests)) + '.'}
            </p>}
          </div>

          <div className="mt-5 space-y-3">
            {user
              ? <Button full size="lg" disabled={Boolean(issue)} onClick={() => { setSummary(true); setSummaryError('') }}>Continuar al resumen</Button>
              : <Link className={buttonClass('primary', 'lg', 'w-full')} to="/login" state={{ from: location.pathname + location.search }}>Iniciar sesión para reservar</Link>}
            <Button variant="secondary" full disabled={booked.length >= maxRooms}
              onClick={() => remember(stay, addRoom(booked))}>
              <PlusIcon className="h-4 w-4" />Agregar habitación
            </Button>
            {booked.length >= maxRooms && <p className="hint text-center">Máximo {maxRooms} habitaciones por reserva.</p>}
          </div>
        </div>
        <p className="mt-3 px-1 text-xs leading-relaxed text-ink-400">
          Podrás cancelar tu reserva desde «Mis reservas» mientras la estadía no haya comenzado.
        </p>
      </aside>}
    </div>}

    {picking && rooms.data && <DateRangeModal subtitle={'Disponibilidad de ' + (hotel.data?.name || 'el hotel')} rooms={rooms.data} initialStart={stay?.start || ''} initialEnd={stay?.end || ''} focus={stay?.start || dateAfter(1)}
      onConfirm={applyDates} onCancel={() => setPicking(false)} />}
    {summary && stay && current && user && <ReservationSummaryModal hotelName={hotel.data?.name || ''} types={types} rooms={booked} start={stay.start} end={stay.end} busy={busy} error={summaryError}
      onBack={() => { setSummary(false); setSummaryError('') }} onConfirm={confirm} />}
  </section>
}
