import { lazy, Suspense, useId, useState, type FormEvent } from 'react'
import { api, message } from '../api'
import { useLoad } from '../useLoad'
import type { Hotel, HotelInput, Room, RoomInput, Page, Reservation } from '../types'
import { money } from '../types'
import ReservationList from '../components/ReservationList'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Field, { CheckField } from '../ui/Field'
import { Loading } from '../ui/Loading'
import Notice from '../ui/Notice'
import Pager from '../ui/Pager'
import { BedIcon, BuildingIcon, ChartIcon, MapPinIcon, PencilIcon, TicketIcon } from '../ui/Icons'

const DemandPanel = lazy(() => import('../components/DemandPanel'))
const emptyHotel: HotelInput = { name: '', location: '', description: '', rating: 0, active: true }
const tabs = [
  { key: 'hotels', label: 'Hoteles', Glyph: BuildingIcon },
  { key: 'rooms', label: 'Habitaciones', Glyph: BedIcon },
  { key: 'reservations', label: 'Reservas', Glyph: TicketIcon },
  { key: 'demand', label: 'Previsión de demanda', Glyph: ChartIcon },
]

export default function AdminPanel() {
  const [tab, setTab] = useState('hotels'), [hotelId, setHotelId] = useState(0)
  const hotels = useLoad<Hotel[]>('/admin/hotels')
  const selectedId = hotelId || hotels.data?.[0]?.id || 0
  const group = useId()
  return <section className="page">
    <h1 className="title">Administración</h1>
    <p className="subtitle">Catálogo, inventario, reservas y análisis de demanda del sistema.</p>

    <div role="tablist" aria-label="Gestión administrativa" className="mt-7 flex flex-wrap gap-1 rounded-2xl border border-ink-200 bg-white p-1.5 shadow-card">
      {tabs.map(({ key, label, Glyph }) => <button key={key} role="tab" id={group + key} aria-selected={tab === key} aria-controls={group + 'panel'}
        onClick={() => setTab(key)}
        className={'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-[background-color,color,transform] duration-160 ease-out-strong active:scale-[0.97] '
          + (tab === key ? 'bg-brand-600 text-white shadow-card' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900')}>
        <Glyph className="h-4 w-4" />{label}
      </button>)}
    </div>

    <div id={group + 'panel'} role="tabpanel" aria-labelledby={group + tab} className="mt-7">
      {hotels.loading && <Loading label="Cargando inventario…" />}
      {hotels.error && <Notice tone="error" role="alert" title="No se pudo cargar el inventario">{hotels.error}</Notice>}
      {tab === 'hotels' && <HotelManager hotels={hotels.data || []} refresh={hotels.reload} />}
      {tab !== 'hotels' && tab !== 'demand' && <Field label="Hotel" className="mb-6 max-w-md">
        <select className="field" value={selectedId} onChange={e => setHotelId(Number(e.target.value))}>
          {!hotels.data?.length && <option value={0}>Crea un hotel primero</option>}
          {hotels.data?.map(h => <option key={h.id} value={h.id}>{h.name}{!h.active && ' (inactivo)'}</option>)}
        </select>
      </Field>}
      {tab === 'rooms' && selectedId > 0 && <RoomManager key={selectedId} hotelId={selectedId} />}
      {tab === 'reservations' && <AdminReservations hotelId={selectedId} />}
      {tab === 'demand' && <Suspense fallback={<Loading label="Cargando módulo de demanda…" />}><DemandPanel hotels={hotels.data || []} /></Suspense>}
    </div>
  </section>
}

function HotelManager({ hotels, refresh }: { hotels: Hotel[]; refresh(): void }) {
  const [form, setForm] = useState<HotelInput>(emptyHotel), [id, setId] = useState<number | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false)
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setSuccess(''); try { await api('/admin/hotels' + (id === null ? '' : '/' + id), { method: id === null ? 'POST' : 'PUT', body: JSON.stringify(form) }); setForm(emptyHotel); setId(null); setSuccess('Hotel guardado'); refresh() } catch (error) { setError(message(error)) } finally { setBusy(false) } }
  return <>
    <form aria-label="Formulario de hotel" className="panel" onSubmit={save}>
      <h2 className="text-base font-semibold text-ink-900">{id ? 'Editar hotel #' + id : 'Crear hotel'}</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Field label="Nombre del hotel">
          <input className="field" required maxLength={255} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Ubicación">
          <input className="field" required maxLength={255} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
        </Field>
        <Field label="Descripción" className="md:col-span-2" hint="Hasta 255 caracteres. Es el texto que ve el cliente en el catálogo.">
          <textarea className="field" required maxLength={255} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Calificación" hint="De 0 a 5, con un decimal.">
          <input className="field" type="number" min={0} max={5} step="0.1" value={form.rating ?? ''} onChange={e => setForm({ ...form, rating: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <CheckField label="Hotel activo" checked={form.active} onChange={active => setForm({ ...form, active })} className="self-center" />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-5">
        <Button type="submit" loading={busy}>Guardar hotel</Button>
        {id && <Button variant="ghost" onClick={() => { setId(null); setForm(emptyHotel) }}>Volver a crear</Button>}
      </div>
    </form>
    {error && <Notice tone="error" role="alert" className="mt-4">{error}</Notice>}
    {success && <Notice tone="success" role="status" className="mt-4">{success}</Notice>}
    <div className="stagger mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {hotels.map(h => <article className="panel flex flex-col" key={h.id}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-ink-900">{h.name}</h3>
          <Badge tone={h.active ? 'success' : 'neutral'} dot>{h.active ? 'Activo' : 'Inactivo'}</Badge>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500">
          <MapPinIcon className="h-4 w-4 text-ink-400" />{h.location}
        </p>
        <p className="mt-1 text-xs text-ink-400">ID #{h.id}{h.rating !== null && ' · ' + h.rating + '/5'}</p>
        <Button variant="secondary" size="sm" className="mt-4 self-start" aria-label={'Editar hotel ' + h.name}
          onClick={() => { setId(h.id); setForm(h); setSuccess('') }}>
          <PencilIcon className="h-4 w-4" />Editar
        </Button>
      </article>)}
    </div>
  </>
}

function RoomManager({ hotelId }: { hotelId: number }) {
  const empty: RoomInput = { hotelId, roomNumber: '', type: '', pricePerNight: 0, active: true }
  const [form, setForm] = useState<RoomInput>(empty), [id, setId] = useState<number | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false)
  const rooms = useLoad<Room[]>('/admin/hotels/' + hotelId + '/rooms')
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setSuccess(''); try { await api('/admin/rooms' + (id === null ? '' : '/' + id), { method: id === null ? 'POST' : 'PUT', body: JSON.stringify(form) }); setId(null); setForm(empty); setSuccess('Habitación guardada'); rooms.reload() } catch (error) { setError(message(error)) } finally { setBusy(false) } }
  return <>
    <form aria-label="Formulario de habitación" className="panel" onSubmit={save}>
      <h2 className="text-base font-semibold text-ink-900">{id ? 'Editar habitación #' + id : 'Crear habitación'}</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Field label="Número de habitación">
          <input className="field" required maxLength={50} value={form.roomNumber} onChange={e => setForm({ ...form, roomNumber: e.target.value })} />
        </Field>
        <Field label="Tipo" hint="El tipo agrupa las habitaciones que el cliente puede elegir.">
          <input className="field" required maxLength={100} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
        </Field>
        <Field label="Precio por noche (USD enteros)">
          <input type="number" className="field" min={0} max={2147483647} step={1} required value={form.pricePerNight} onChange={e => setForm({ ...form, pricePerNight: Number(e.target.value) })} />
        </Field>
        <CheckField label="Habitación activa" checked={form.active} onChange={active => setForm({ ...form, active })} className="self-center" />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-5">
        <Button type="submit" loading={busy}>Guardar habitación</Button>
        {id && <Button variant="ghost" onClick={() => { setId(null); setForm(empty) }}>Volver a crear</Button>}
      </div>
    </form>
    {(error || rooms.error) && <Notice tone="error" role="alert" className="mt-4">{error || rooms.error}</Notice>}
    {success && <Notice tone="success" role="status" className="mt-4">{success}</Notice>}
    {rooms.loading && <Loading label="Cargando habitaciones…" className="mt-4" />}
    <div className="stagger mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {rooms.data?.map(r => <article className="panel flex flex-col" key={r.id}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-ink-900">Habitación {r.roomNumber}</h3>
          <Badge tone={r.active ? 'success' : 'neutral'} dot>{r.active ? 'Activa' : 'Inactiva'}</Badge>
        </div>
        <p className="mt-2 text-sm text-ink-500">{r.type}</p>
        <p className="mt-1 text-sm font-semibold text-ink-800 tabular">{money(r.pricePerNight)} <span className="font-normal text-ink-500">por noche</span></p>
        <Button variant="secondary" size="sm" className="mt-4 self-start" aria-label={'Editar habitación ' + r.roomNumber}
          onClick={() => { setId(r.id); setForm(r); setSuccess('') }}>
          <PencilIcon className="h-4 w-4" />Editar
        </Button>
      </article>)}
    </div>
  </>
}

function AdminReservations({ hotelId }: { hotelId: number }) {
  const [query, setQuery] = useState(''), [page, setPage] = useState(0)
  const { data, loading, error, reload } = useLoad<Page<Reservation>>('/admin/reservations?page=' + page + query)
  function filter(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget), params = new URLSearchParams(); if (form.get('hotel') === 'selected' && hotelId) params.set('hotelId', String(hotelId)); for (const key of ['roomId', 'userId', 'status']) { const value = String(form.get(key) || ''); if (value) params.set(key, value) }; setPage(0); setQuery('&' + params.toString()); reload() }
  return <>
    <form aria-label="Filtrar reservas" className="panel" onSubmit={filter}>
      <h2 className="text-base font-semibold text-ink-900">Filtrar reservas</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Hotel del filtro">
          <select name="hotel" className="field"><option value="all">Todos</option><option value="selected">Hotel seleccionado arriba</option></select>
        </Field>
        <Field label="Habitación ID"><input name="roomId" type="number" min={1} className="field" /></Field>
        <Field label="Usuario ID"><input name="userId" type="number" min={1} className="field" /></Field>
        <Field label="Estado">
          <select name="status" className="field"><option value="">Todos</option><option>CONFIRMED</option><option>CANCELLED</option></select>
        </Field>
      </div>
      <div className="mt-6 border-t border-ink-100 pt-5"><Button type="submit">Filtrar reservas</Button></div>
    </form>
    <div className="mt-7">
      {loading && <Loading label="Cargando reservas…" />}
      {error && <Notice tone="error" role="alert" title="No se pudieron cargar las reservas">{error}</Notice>}
      {data && <>
        <ReservationList reservations={data.content} refresh={reload} admin />
        <Pager page={page} totalPages={data.totalPages} onPage={setPage}>
          {data.totalElements === 1 ? '1 reserva' : data.totalElements + ' reservas'} · Página {page + 1}
        </Pager>
      </>}
    </div>
  </>
}
