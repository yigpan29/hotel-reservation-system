import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { api, ApiError, message } from '../api'
import type { Hotel } from '../types'
import type { DemandHistory, DemandForecast } from '../demand-types'
import Button from '../ui/Button'
import Field from '../ui/Field'
import { Loading } from '../ui/Loading'
import Notice from '../ui/Notice'

const number = (value: number) => value.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (value: string) => new Date(value + 'T12:00:00Z').toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const weekdays: Record<string, string> = { MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles', THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado', SUNDAY: 'Domingo' }
const levels = { HIGH: 'Alta', LOW: 'Baja', MODERATE: 'Moderada', UNAVAILABLE: 'No disponible' }
const dates = (values: string[]) => values.slice(0, 5).map(day).join(', ') + (values.length > 5 ? ' y ' + (values.length - 5) + ' más' : '')

// Colores de los tokens de marca, en hexadecimal para que la exportación del SVG los conserve.
const historyColor = '#b85726', forecastColor = '#175cd3', gridColor = '#e2dfda', axisColor = '#7a736a'
const axis = { stroke: gridColor, tick: { fill: axisColor, fontSize: 12 } }
const tooltipStyle = { borderRadius: 12, border: '1px solid ' + gridColor, boxShadow: '0 12px 24px -8px rgb(27 25 23 / 0.18)', fontSize: 13 }

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
  const origins = result ? [result.history.context, result.forecast.context] : []
  const hasSynthetic = origins.some(origin => origin.syntheticReservations > 0 || origin.dataKind === 'SYNTHETIC_DEMO' || origin.dataKind === 'MIXED')
  const hasOperational = origins.some(origin => origin.operationalReservations > 0 || origin.dataKind === 'MIXED')

  return <section aria-labelledby="demand-heading" className="min-w-0 space-y-6">
    <div>
      <h2 id="demand-heading" className="section-title">Previsión de demanda</h2>
      <p className="subtitle">Análisis informativo de noches de habitación. No cambia precios, reservas ni disponibilidad.</p>
    </div>

    <form aria-label="Filtros de demanda" onSubmit={filter} className="panel">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Hotel de demanda">
          <select className="field" disabled={loading} value={hotel} onChange={e => setHotel(e.target.value)}>
            <option value="">Todos los hoteles</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}{!h.active && ' (inactivo)'}</option>)}
          </select>
        </Field>
        <Field label="Inicio del histórico">
          <input className="field" type="date" required disabled={loading} value={start} onChange={e => setStart(e.target.value)} />
        </Field>
        <Field label="Fin del histórico">
          <input className="field" type="date" required disabled={loading} value={end} onChange={e => setEnd(e.target.value)} />
        </Field>
        <div className="flex items-end"><Button type="submit" disabled={loading} full>Aplicar filtros</Button></div>
      </div>
      <p className="mt-4 border-t border-ink-100 pt-4 text-xs leading-relaxed text-ink-500">
        El período filtra el histórico (máximo 366 días, hasta ayer). La previsión siempre utiliza las ocho semanas
        completas anteriores a la semana actual; el filtro de hotel se aplica a ambos.
      </p>
    </form>

    {loading && <Loading label="Cargando análisis de demanda…" />}
    {error && <Notice tone="error" role="alert" title="No se pudo completar el análisis">
      <p>{error}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {expired && <Link className="link" to="/login" state={{ from: '/admin' }}>Volver a iniciar sesión</Link>}
        <button type="button" className="link" onClick={() => setRevision(value => value + 1)}>Reintentar análisis</button>
      </div>
    </Notice>}

    {history && forecast && <>
      <Notice tone="warning" role="note">
        {hasSynthetic && hasOperational ? 'Historial mixto: incluye datos sintéticos de demostración y registros operativos.'
          : hasSynthetic ? 'Incluye historial sintético de demostración educativa. No representa operaciones comerciales reales.'
          : 'Datos operativos registrados en el sistema. El inventario puede pertenecer al catálogo educativo.'}
      </Notice>

      <div className="rounded-2xl border border-ink-200 bg-ink-25 p-4 text-sm leading-relaxed text-ink-600">
        <p>Consulta: <strong className="font-semibold text-ink-800">{history.context.hotelId === null ? 'todos los hoteles' : hotels.find(h => h.id === history.context.hotelId)?.name || 'Hotel #' + history.context.hotelId}</strong> · {history.startDate} a {history.endDate}</p>
        {history.context.syntheticReservations !== undefined && forecast.context.syntheticReservations !== undefined && <p className="mt-2 text-xs text-ink-500" aria-label="Procedencia de los datos">
          Histórico consultado: {history.context.syntheticReservations} reservas sintéticas y {history.context.operationalReservations} operativas.
          Ventanas del modelo: {forecast.context.syntheticReservations} sintéticas y {forecast.context.operationalReservations} operativas.
          Lotes: {[...new Set([...history.context.syntheticBatches, ...forecast.context.syntheticBatches])].join(', ') || 'sin lotes etiquetados en estas ventanas'}.
        </p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicadores históricos">
        {[['Reservas del período', String(history.summary.totalReservations)], ['Confirmadas', String(history.summary.confirmedReservations)], ['Canceladas', String(history.summary.cancelledReservations)], ['Noches reservadas', String(history.summary.roomNights)], ['Promedio diario de noches', number(history.summary.dailyAverage)], ['Ocupación orientativa (capacidad actual)', history.summary.capacityReferencePercent === null ? 'No disponible' : number(history.summary.capacityReferencePercent) + '%']].map(([title, value]) =>
          <article key={title} className="panel">
            <h3 className="text-xs font-medium uppercase tracking-wider text-ink-400">{title}</h3>
            <p className="mt-2 text-2xl font-semibold text-ink-900 tabular">{value}</p>
          </article>)}
      </div>

      <p className="text-xs leading-relaxed text-ink-500">
        Capacidad de referencia: {history.context.currentActiveRooms} habitaciones actualmente activas de hoteles activos.
        No es capacidad histórica ni ocupación efectiva. Un porcentaje no disponible indica capacidad cero o demanda que supera esa referencia.
      </p>

      {(history.context.invalidStayRecords > 0 || history.summary.unknownStateReservations > 0 || history.summary.deduplicatedRoomNights > 0) &&
        <Notice tone="warning" role="note" title="Revisión de datos">
          {history.context.invalidStayRecords} registros con estancia inválida o habitación ausente en el ámbito seleccionado;
          {' ' + history.summary.unknownStateReservations} reservas de estado desconocido en el período;
          {' ' + history.summary.deduplicatedRoomNights} noches duplicadas de una misma habitación deduplicadas.
        </Notice>}

      {history.summary.roomNights === 0 && <p role="status" className="panel text-sm text-ink-600">Período sin actividad confirmada. Los ceros son noches registradas, no una predicción.</p>}

      <figure className="panel min-w-0" aria-label="Gráfico de demanda histórica">
        <figcaption className="text-base font-semibold text-ink-900">Demanda histórica · noches reservadas por día</figcaption>
        <div className="mt-5 h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={history.days} margin={{ top: 12, right: 15, bottom: 15, left: 10 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="date" tickFormatter={day} minTickGap={25} {...axis} />
              <YAxis allowDecimals={false} width={45} label={{ value: 'Noches', angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 12 }} {...axis} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
              <Line dataKey="roomNights" name="Histórico CONFIRMED (noches)" stroke={historyColor} strokeWidth={2.25} dot={history.days.length === 1} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-sm text-ink-600">Mayor demanda: {dates(history.summary.peakDates)}. Menor demanda: {dates(history.summary.lowDates)}. Las fechas de salida están excluidas.</p>
        <details className="mt-4 rounded-xl border border-ink-200 bg-ink-25 p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink-700">Ver datos históricos en tabla</summary>
          <div className="mt-4 overflow-x-auto">
            <table className="data-table"><caption className="sr-only">Serie histórica diaria</caption>
              <thead><tr><th>Fecha</th><th>Noches reservadas</th></tr></thead>
              <tbody>{history.days.map(d => <tr key={d.date}><td>{d.date}</td><td>{d.roomNights}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </figure>

      <figure className="panel min-w-0" aria-label="Gráfico de previsión de demanda">
        <figcaption className="text-base font-semibold text-ink-900">Previsión de demanda · próximos 30 días</figcaption>
        <p className="mt-2 text-xs text-ink-500">Referencia: {forecast.referenceDate} · Entrenamiento: {forecast.trainingStart} a {forecast.trainingEnd} · Horizonte: {forecast.horizonStart} a {forecast.horizonEnd}</p>
        {forecast.status === 'AVAILABLE'
          ? <p role="status" className="mt-3 text-sm text-info-700">{forecast.message}</p>
          : <Notice tone="error" role="status" className="mt-3">{forecast.message}</Notice>}
        {forecast.status === 'AVAILABLE' && <>
          <div className="mt-5 h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={forecast.days} margin={{ top: 12, right: 15, bottom: 15, left: 10 }} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="date" tickFormatter={day} minTickGap={25} {...axis} />
                <YAxis width={45} label={{ value: 'Noches', angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 12 }} {...axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                <Line dataKey="estimatedRoomNights" name="Estimación (noches)" stroke={forecastColor} strokeDasharray="6 4" strokeWidth={2.25} dot={false} isAnimationActive={false} />
                <Line dataKey="confirmedRoomNights" name="Ya confirmadas (noches)" stroke={historyColor} strokeWidth={2.25} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-500">Estimación y reservas ya confirmadas son series distintas: no deben sumarse. Alta: ≥80% de capacidad actual; baja: ≤30%; moderada: resto. Sin capacidad no se asigna nivel.</p>
          <p className="mt-2 text-sm text-ink-600">{forecast.context.currentActiveRooms === 0 ? 'Sin capacidad activa para clasificar períodos.' : 'Demanda alta: ' + (dates(forecast.days.filter(d => d.level === 'HIGH').map(d => d.date)) || 'ninguna fecha') + '. Demanda baja: ' + (dates(forecast.days.filter(d => d.level === 'LOW').map(d => d.date)) || 'ninguna fecha') + '.'}</p>
          <details className="mt-4 rounded-xl border border-ink-200 bg-ink-25 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-700">Ver previsión diaria y niveles</summary>
            <div className="mt-4 overflow-x-auto">
              <table className="data-table"><caption className="sr-only">Treinta días estimados</caption>
                <thead><tr><th>Fecha</th><th>Estimadas</th><th>Ya confirmadas</th><th>% orientativo</th><th>Demanda</th></tr></thead>
                <tbody>{forecast.days.map(d => <tr key={d.date}><td className="whitespace-nowrap">{d.date}</td><td>{number(d.estimatedRoomNights)}</td><td>{d.confirmedRoomNights}</td><td>{d.capacityReferencePercent === null ? 'ND' : number(d.capacityReferencePercent)}</td><td>{levels[d.level]}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>}
      </figure>

      <details className="panel">
        <summary className="cursor-pointer text-base font-semibold text-ink-900">Método y limitaciones</summary>
        <p className="mt-4 text-sm leading-relaxed text-ink-600">
          Promedio por día de la semana: suma de noches / 8 observaciones, incluyendo días con cero actividad.
          Redondeo HALF_UP a dos decimales. Cada lunes utiliza los ocho lunes de referencia; lo mismo para los otros días.
          No se garantiza precisión estadística.
        </p>
        {forecast.status === 'AVAILABLE' && <div className="mt-5 overflow-x-auto">
          <table className="data-table"><caption>Promedios históricos usados por el modelo</caption>
            <thead><tr><th>Día</th><th>Noches</th><th>Observaciones</th><th>Promedio</th></tr></thead>
            <tbody>{forecast.weekdayAverages.map(d => <tr key={d.weekday}><td>{weekdays[d.weekday]}</td><td>{d.roomNights}</td><td>{d.observations}</td><td>{number(d.average)}</td></tr>)}</tbody>
          </table>
        </div>}
        <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-ink-600">{forecast.context.limitations.map(text => <li key={text}>{text}</li>)}</ul>
      </details>
    </>}
  </section>
}
