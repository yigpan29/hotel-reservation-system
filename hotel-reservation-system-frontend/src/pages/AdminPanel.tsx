import { lazy, Suspense, useState, type FormEvent } from 'react'
import { api, message } from '../api'
import { useLoad } from '../useLoad'
import type { Hotel, HotelInput, Room, RoomInput, Page, Reservation } from '../types'
import ReservationList from '../components/ReservationList'
const DemandPanel = lazy(() => import('../components/DemandPanel'))
const emptyHotel: HotelInput = { name: '', location: '', description: '', rating: 0, active: true }
export default function AdminPanel() {
  const [tab, setTab] = useState('hotels'), [hotelId, setHotelId] = useState(0)
  const hotels = useLoad<Hotel[]>('/admin/hotels')
  const selectedId = hotelId || hotels.data?.[0]?.id || 0
  return <section className="page"><h1 className="title">Administración</h1><div className="flex flex-wrap gap-3 mb-6" role="tablist" aria-label="Gestión administrativa">
    {[['hotels', 'Hoteles'], ['rooms', 'Habitaciones'], ['reservations', 'Reservas'], ['demand', 'Previsión de demanda']].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'action' : 'border border-orange-300 rounded px-4 py-2'} onClick={() => setTab(key)}>{label}</button>)}</div>
    {hotels.loading && <p role="status">Cargando inventario…</p>}{hotels.error && <p role="alert" className="notice-error">{hotels.error}</p>}
    {tab === 'hotels' && <HotelManager hotels={hotels.data || []} refresh={hotels.reload} />}
    {tab !== 'hotels' && tab !== 'demand' && <label className="block mb-5">Hotel<select className="field" value={selectedId} onChange={e => setHotelId(Number(e.target.value))}>{!hotels.data?.length && <option value={0}>Crea un hotel primero</option>}{hotels.data?.map(h => <option key={h.id} value={h.id}>{h.name}{!h.active && ' (inactivo)'}</option>)}</select></label>}
    {tab === 'rooms' && selectedId > 0 && <RoomManager key={selectedId} hotelId={selectedId} />}
    {tab === 'reservations' && <AdminReservations hotelId={selectedId} />}
    {tab === 'demand' && <Suspense fallback={<p role="status">Cargando módulo de demanda…</p>}><DemandPanel hotels={hotels.data || []} /></Suspense>}
  </section>
}
function HotelManager({ hotels, refresh }: { hotels: Hotel[]; refresh(): void }) {
  const [form, setForm] = useState<HotelInput>(emptyHotel), [id, setId] = useState<number | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false)
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setSuccess(''); try { await api('/admin/hotels' + (id === null ? '' : '/' + id), { method: id === null ? 'POST' : 'PUT', body: JSON.stringify(form) }); setForm(emptyHotel); setId(null); setSuccess('Hotel guardado'); refresh() } catch (error) { setError(message(error)) } finally { setBusy(false) } }
  return <><form aria-label="Formulario de hotel" className="panel grid md:grid-cols-2 gap-4" onSubmit={save}><h2 className="font-bold md:col-span-2">{id ? 'Editar hotel #' + id : 'Crear hotel'}</h2>
    <label>Nombre del hotel<input className="field" required maxLength={255} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label>Ubicación<input className="field" required maxLength={255} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label>
    <label>Descripción<textarea className="field" required maxLength={255} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
    <label>Calificación<input className="field" type="number" min={0} max={5} step="0.1" value={form.rating ?? ''} onChange={e => setForm({ ...form, rating: e.target.value ? Number(e.target.value) : null })} /></label>
    <label><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Hotel activo</label>
    <div><button disabled={busy} className="action">Guardar hotel</button>{id && <button type="button" className="ml-4 underline" onClick={() => { setId(null); setForm(emptyHotel) }}>Volver a crear</button>}</div>
  </form>{error && <p role="alert" className="notice-error">{error}</p>}{success && <p role="status" className="notice-success">{success}</p>}<div className="grid md:grid-cols-2 gap-4 my-6">{hotels.map(h => <article className="panel" key={h.id}><h2 className="font-bold">{h.name} · #{h.id}</h2><p>{h.location} · {h.active ? 'Activo' : 'Inactivo'}</p><button className="text-orange-700 underline mt-2" onClick={() => { setId(h.id); setForm(h); setSuccess('') }}>Editar hotel {h.name}</button></article>)}</div></>
}
function RoomManager({ hotelId }: { hotelId: number }) {
  const empty: RoomInput = { hotelId, roomNumber: '', type: '', pricePerNight: 0, active: true }
  const [form, setForm] = useState<RoomInput>(empty), [id, setId] = useState<number | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false)
  const rooms = useLoad<Room[]>('/admin/hotels/' + hotelId + '/rooms')
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setSuccess(''); try { await api('/admin/rooms' + (id === null ? '' : '/' + id), { method: id === null ? 'POST' : 'PUT', body: JSON.stringify(form) }); setId(null); setForm(empty); setSuccess('Habitación guardada'); rooms.reload() } catch (error) { setError(message(error)) } finally { setBusy(false) } }
  return <><form aria-label="Formulario de habitación" className="panel grid md:grid-cols-2 gap-4" onSubmit={save}><h2 className="font-bold md:col-span-2">{id ? 'Editar habitación #' + id : 'Crear habitación'}</h2>
    <label>Número de habitación<input className="field" required maxLength={50} value={form.roomNumber} onChange={e => setForm({ ...form, roomNumber: e.target.value })} /></label>
    <label>Tipo<input className="field" required maxLength={100} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} /></label>
    <label>Precio por noche (USD enteros)<input type="number" className="field" min={0} max={2147483647} step={1} required value={form.pricePerNight} onChange={e => setForm({ ...form, pricePerNight: Number(e.target.value) })} /></label>
    <label className="self-center"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Habitación activa</label>
    <div><button className="action" disabled={busy}>Guardar habitación</button>{id && <button type="button" className="ml-4 underline" onClick={() => { setId(null); setForm(empty) }}>Volver a crear</button>}</div>
  </form>{(error || rooms.error) && <p role="alert" className="notice-error">{error || rooms.error}</p>}{success && <p role="status" className="notice-success">{success}</p>}{rooms.loading && <p role="status">Cargando habitaciones…</p>}
    <div className="grid md:grid-cols-2 gap-4 my-6">{rooms.data?.map(r => <article className="panel" key={r.id}><h2 className="font-bold">Habitación {r.roomNumber} · {r.type}</h2><p>USD {r.pricePerNight} por noche · {r.active ? 'Activa' : 'Inactiva'}</p><button className="text-orange-700 underline mt-2" onClick={() => { setId(r.id); setForm(r); setSuccess('') }}>Editar habitación {r.roomNumber}</button></article>)}</div>
  </>
}
function AdminReservations({ hotelId }: { hotelId: number }) {
  const [query, setQuery] = useState(''), [page, setPage] = useState(0)
  const { data, loading, error, reload } = useLoad<Page<Reservation>>('/admin/reservations?page=' + page + query)
  function filter(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget), params = new URLSearchParams(); if (form.get('hotel') === 'selected' && hotelId) params.set('hotelId', String(hotelId)); for (const key of ['roomId', 'userId', 'status']) { const value = String(form.get(key) || ''); if (value) params.set(key, value) }; setPage(0); setQuery('&' + params.toString()); reload() }
  return <><form aria-label="Filtrar reservas" className="panel grid md:grid-cols-4 gap-3 mb-5" onSubmit={filter}><label>Hotel del filtro<select name="hotel" className="field"><option value="all">Todos</option><option value="selected">Hotel seleccionado arriba</option></select></label><label>Habitación ID<input name="roomId" type="number" min={1} className="field" /></label><label>Usuario ID<input name="userId" type="number" min={1} className="field" /></label><label>Estado<select name="status" className="field"><option value="">Todos</option><option>CONFIRMED</option><option>CANCELLED</option></select></label><button className="action">Filtrar reservas</button></form>
    {loading && <p role="status">Cargando reservas…</p>}{error && <p role="alert" className="notice-error">{error}</p>}{data && <><ReservationList reservations={data.content} refresh={reload} /><div className="flex gap-4 mt-5"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button><span>{data.totalElements} reservas · Página {page + 1}</span><button disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></div></>}</>
}
