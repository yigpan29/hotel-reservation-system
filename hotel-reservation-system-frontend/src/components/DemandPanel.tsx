import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { api, ApiError, message } from '../api'
import type { Hotel } from '../types'
import type { DemandHistory, DemandForecast } from '../demand-types'

const number = (value: number) => value.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (value: string) => new Date(value + 'T12:00:00Z').toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const weekdays: Record<string, string> = { MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles', THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado', SUNDAY: 'Domingo' }
const levels = { HIGH: 'Alta', LOW: 'Baja', MODERATE: 'Moderada', UNAVAILABLE: 'No disponible' }
const dates = (values: string[]) => values.slice(0, 5).map(day).join(', ') + (values.length > 5 ? ' y ' + (values.length - 5) + ' más' : '')

export default function DemandPanel({ hotels }: { hotels: Hotel[] }) {
  const [hotel, setHotel] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState('')
  const [query, setQuery] = useState(''), [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ history: DemandHistory; forecast: DemandForecast } | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [expired, setExpired] = useState(false)
  useEffect(() => {
    const controller = new AbortController(), params = new URLSearchParams(query)
    const selectedHotel = params.get('hotelId'), forecastQuery = selectedHotel ? '?hotelId=' + selectedHotel : ''
    setLoading(true); setError(''); setExpired(false); setResult(null)
    Promise.all([api<DemandHistory>('/admin/demand/history' + (query ? '?' + query : ''), { signal: controller.signal }), api<DemandForecast>('/admin/demand/forecast' + forecastQuery, { signal: controller.signal })])
      .then(([history, forecast]) => { if (!controller.signal.aborted) { setResult({ history, forecast }); setStart(history.startDate); setEnd(history.endDate) } })
      .catch(error => { if (!controller.signal.aborted) { setExpired(error instanceof ApiError && error.status === 401); setError(error instanceof ApiError && error.status === 401 ? 'La sesión ha expirado. Inicia sesión nuevamente.' : error instanceof ApiError && error.status === 403 ? 'No tienes permisos para consultar la previsión de demanda.' : error instanceof TypeError ? 'No se pudo conectar con el backend. Comprueba la conexión y reintenta.' : message(error)) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, revision])
  function filter(event: FormEvent) { event.preventDefault(); const params = new URLSearchParams(); if (hotel) params.set('hotelId', hotel); if (start) params.set('startDate', start); if (end) params.set('endDate', end); setQuery(params.toString()); setRevision(value => value + 1) }
  const history = result?.history, forecast = result?.forecast
  return <section aria-labelledby="demand-heading" className="min-w-0 space-y-5">
    <h2 id="demand-heading" className="text-2xl font-bold">Previsión de demanda</h2>
    <p>Análisis informativo de noches de habitación. No cambia precios, reservas ni disponibilidad.</p>
    <form aria-label="Filtros de demanda" onSubmit={filter} className="panel grid gap-4 md:grid-cols-4">
      <label>Hotel de demanda<select className="field" disabled={loading} value={hotel} onChange={e => setHotel(e.target.value)}><option value="">Todos los hoteles</option>{hotels.map(h => <option key={h.id} value={h.id}>{h.name}{!h.active && ' (inactivo)'}</option>)}</select></label>
      <label>Inicio del histórico<input className="field" type="date" required disabled={loading} value={start} onChange={e => setStart(e.target.value)} /></label>
      <label>Fin del histórico<input className="field" type="date" required disabled={loading} value={end} onChange={e => setEnd(e.target.value)} /></label>
      <button className="action self-end" disabled={loading}>Aplicar filtros</button>
    </form>
    <p className="text-sm text-gray-600">El período filtra el histórico (máximo 366 días, hasta ayer). La previsión siempre utiliza las ocho semanas completas anteriores a la semana actual; el filtro de hotel se aplica a ambos.</p>
    {loading && <p role="status">Cargando análisis de demanda…</p>}
    {error && <div role="alert" className="notice-error">{error}{expired && <Link className="underline block" to="/login" state={{ from: '/admin' }}>Volver a iniciar sesión</Link>}<button className="underline block mt-2" onClick={() => setRevision(value => value + 1)}>Reintentar análisis</button></div>}
    {history && forecast && <>
      <p className="rounded border border-orange-200 bg-orange-50 p-4 font-medium" role="note">{history.context.dataKind === 'SYNTHETIC_DEMO' ? 'Historial sintético · demostración aislada. No son operaciones reales.' : 'Datos operativos registrados en el sistema. El inventario puede pertenecer al catálogo educativo.'}</p>
      <p>Consulta: {history.context.hotelId === null ? 'todos los hoteles' : hotels.find(h => h.id === history.context.hotelId)?.name || 'Hotel #' + history.context.hotelId} · {history.startDate} a {history.endDate}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Indicadores históricos">
        {[['Reservas del período', String(history.summary.totalReservations)], ['Confirmadas', String(history.summary.confirmedReservations)], ['Canceladas', String(history.summary.cancelledReservations)], ['Noches reservadas', String(history.summary.roomNights)], ['Promedio diario de noches', number(history.summary.dailyAverage)], ['Ocupación orientativa (capacidad actual)', history.summary.capacityReferencePercent === null ? 'No disponible' : number(history.summary.capacityReferencePercent) + '%']].map(([title, value]) => <article key={title} className="panel"><h3 className="text-sm text-gray-600">{title}</h3><p className="text-2xl font-bold mt-2">{value}</p></article>)}
      </div>
      <p className="text-sm">Capacidad de referencia: {history.context.currentActiveRooms} habitaciones actualmente activas de hoteles activos. No es capacidad histórica ni ocupación efectiva. Un porcentaje no disponible indica capacidad cero o demanda que supera esa referencia.</p>
      {(history.context.invalidStayRecords > 0 || history.summary.unknownStateReservations > 0 || history.summary.deduplicatedRoomNights > 0) && <p role="note" className="notice-error">Revisión de datos: {history.context.invalidStayRecords} registros con estancia inválida o habitación ausente en el ámbito seleccionado; {history.summary.unknownStateReservations} reservas de estado desconocido en el período; {history.summary.deduplicatedRoomNights} noches duplicadas de una misma habitación deduplicadas.</p>}
      {history.summary.roomNights === 0 && <p role="status" className="panel">Período sin actividad confirmada. Los ceros son noches registradas, no una predicción.</p>}
      <figure className="panel min-w-0" aria-label="Gráfico de demanda histórica">
        <figcaption className="font-bold mb-3">Demanda histórica · noches reservadas por día</figcaption>
        <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={history.days} margin={{ top: 12, right: 15, bottom: 15, left: 10 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={day} minTickGap={25} /><YAxis allowDecimals={false} width={45} label={{ value: 'Noches', angle: -90, position: 'insideLeft' }} /><Tooltip /><Legend /><Line dataKey="roomNights" name="Histórico CONFIRMED (noches)" stroke="#c2410c" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
        <p className="text-sm mt-2">Mayor demanda: {dates(history.summary.peakDates)}. Menor demanda: {dates(history.summary.lowDates)}. Las fechas de salida están excluidas.</p>
        <details className="mt-3"><summary className="cursor-pointer underline">Ver datos históricos en tabla</summary><div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Serie histórica diaria</caption><thead><tr><th>Fecha</th><th>Noches reservadas</th></tr></thead><tbody>{history.days.map(d => <tr key={d.date}><td>{d.date}</td><td>{d.roomNights}</td></tr>)}</tbody></table></div></details>
      </figure>
      <figure className="panel min-w-0" aria-label="Gráfico de previsión de demanda">
        <figcaption className="font-bold mb-3">Previsión de demanda · próximos 30 días</figcaption>
        <p>Referencia: {forecast.referenceDate} · Entrenamiento: {forecast.trainingStart} a {forecast.trainingEnd} · Horizonte: {forecast.horizonStart} a {forecast.horizonEnd}</p>
        <p role="status" className={forecast.status === 'AVAILABLE' ? 'my-3 text-blue-800' : 'notice-error'}>{forecast.message}</p>
        {forecast.status === 'AVAILABLE' && <>
          <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={forecast.days} margin={{ top: 12, right: 15, bottom: 15, left: 10 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={day} minTickGap={25} /><YAxis width={45} label={{ value: 'Noches', angle: -90, position: 'insideLeft' }} /><Tooltip /><Legend /><Line dataKey="estimatedRoomNights" name="Estimación (noches)" stroke="#1d4ed8" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} /><Line dataKey="confirmedRoomNights" name="Ya confirmadas (noches)" stroke="#c2410c" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
          <p className="text-sm my-3">Estimación y reservas ya confirmadas son series distintas: no deben sumarse. Alta: ≥80% de capacidad actual; baja: ≤30%; moderada: resto. Sin capacidad no se asigna nivel.</p>
          <p className="text-sm mb-3">{forecast.context.currentActiveRooms === 0 ? 'Sin capacidad activa para clasificar períodos.' : 'Demanda alta: ' + (dates(forecast.days.filter(d => d.level === 'HIGH').map(d => d.date)) || 'ninguna fecha') + '. Demanda baja: ' + (dates(forecast.days.filter(d => d.level === 'LOW').map(d => d.date)) || 'ninguna fecha') + '.'}</p>
          <details><summary className="cursor-pointer underline">Ver previsión diaria y niveles</summary><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Treinta días estimados</caption><thead><tr><th>Fecha</th><th>Estimadas</th><th>Ya confirmadas</th><th>% orientativo</th><th>Demanda</th></tr></thead><tbody>{forecast.days.map(d => <tr key={d.date}><td className="whitespace-nowrap pr-3">{d.date}</td><td>{number(d.estimatedRoomNights)}</td><td>{d.confirmedRoomNights}</td><td>{d.capacityReferencePercent === null ? 'ND' : number(d.capacityReferencePercent)}</td><td>{levels[d.level]}</td></tr>)}</tbody></table></div></details>
        </>}
      </figure>
      <details className="panel"><summary className="font-bold cursor-pointer">Método y limitaciones</summary>
        <p className="my-3">Promedio por día de la semana: suma de noches / 8 observaciones, incluyendo días con cero actividad. Redondeo HALF_UP a dos decimales. Cada lunes utiliza los ocho lunes de referencia; lo mismo para los otros días. No se garantiza precisión estadística.</p>
        {forecast.status === 'AVAILABLE' && <div className="overflow-x-auto"><table className="w-full text-left"><caption>Promedios históricos usados por el modelo</caption><thead><tr><th>Día</th><th>Noches</th><th>Observaciones</th><th>Promedio</th></tr></thead><tbody>{forecast.weekdayAverages.map(d => <tr key={d.weekday}><td>{weekdays[d.weekday]}</td><td>{d.roomNights}</td><td>{d.observations}</td><td>{number(d.average)}</td></tr>)}</tbody></table></div>}
        <ul className="list-disc pl-5 mt-3 space-y-2">{forecast.context.limitations.map(text => <li key={text}>{text}</li>)}</ul>
      </details>
    </>}
  </section>
}
