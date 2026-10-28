import { useEffect, useMemo, useState } from 'react'
import { api, message } from '../api'
import { dayInfo, monthGrid, monthsAhead, monthsFromNow, occupiedNights, pickDay, shiftMonth } from '../availability'
import { dateAfter, nightsBetween, type Room, type RoomOccupancy } from '../types'

const weekdays = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const label = (day: string) => { const [year, month, date] = day.split('-'); return Number(date) + ' de ' + monthNames[Number(month) - 1] + ' de ' + year }

/**
 * Calendario mensual de un tipo de habitación. Una noche está libre si alguna habitación del tipo lo está,
 * pero una estadía solo es válida si UNA MISMA habitación está libre durante todas sus noches.
 */
export default function AvailabilityCalendar({ rooms, start, end, focus, onChange }: { rooms: Room[]; start: string; end: string; focus: string; onChange: (start: string, end: string) => void }) {
  const ids = rooms.map(room => room.id).join(',')
  const [occupancy, setOccupancy] = useState<RoomOccupancy[] | null>(null), [error, setError] = useState('')
  const today = dateAfter(0)
  const [cursor, setCursor] = useState(() => (focus >= today ? focus : today).slice(0, 7))
  useEffect(() => {
    let current = true
    setOccupancy(null); setError('')
    Promise.all(ids.split(',').map(id => api<RoomOccupancy>('/rooms/' + id + '/occupancy'))).then(value => { if (current) setOccupancy(value) }).catch(failure => { if (current) setError(message(failure)) })
    return () => { current = false }
  }, [ids])
  const blocked = occupancy === null
  const nights = useMemo(() => occupiedNights(occupancy || []), [occupancy])
  const context = { today, start, end, rooms: nights, loaded: !blocked }
  const { year, month, offset, days } = monthGrid(cursor)
  const away = monthsFromNow(cursor, today)
  const stay = start && end ? nightsBetween(start, end) : 0

  function pick(day: string) {
    const next = pickDay(day, context)
    if (next) onChange(next.start, next.end)
  }

  return <div aria-label="Calendario de disponibilidad" role="group">
    <div className="flex items-center justify-between gap-2">
      <button type="button" className="action px-3 py-1" disabled={away <= 0} aria-label="Mes anterior" onClick={() => setCursor(shiftMonth(cursor, -1))}>‹</button>
      <span className="text-center font-semibold capitalize" aria-live="polite">{monthNames[month - 1]} {year}</span>
      <button type="button" className="action px-3 py-1" disabled={away >= monthsAhead} aria-label="Mes siguiente" onClick={() => setCursor(shiftMonth(cursor, 1))}>›</button>
    </div>
    {blocked && !error && <p role="status" className="mt-3">Cargando disponibilidad…</p>}
    {error && <p role="alert" className="notice-error">{error}</p>}
    <div className="grid grid-cols-7 gap-1 mt-4 text-center text-sm">
      {weekdays.map(name => <abbr key={name} className="py-1 font-semibold text-gray-600 no-underline">{name}</abbr>)}
      {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} />)}
      {days.map(day => {
        const { past, busy, reachable, unreachable, selected, inside, disabled } = dayInfo(day, context)
        const tone = selected ? 'bg-orange-600 text-white font-bold disabled:opacity-100'
          : inside ? 'bg-orange-100 text-orange-900'
          : past ? 'bg-gray-100 text-gray-400'
          : busy || unreachable ? 'bg-red-100 text-red-700 line-through' + (reachable ? ' ring-2 ring-orange-400' : '')
          : 'bg-green-50 text-green-800 hover:bg-green-100'
        return <button key={day} type="button" disabled={disabled} onClick={() => pick(day)}
          aria-pressed={selected} className={'rounded py-2 min-w-0 disabled:cursor-not-allowed ' + tone}
          aria-label={label(day) + (selected ? day === start ? ' · entrada seleccionada' : ' · salida seleccionada'
            : past ? ' · fecha pasada' : busy ? reachable ? ' · solo salida' : ' · ocupado' : unreachable ? ' · ocupado para esta estadía' : ' · disponible')}>
          {Number(day.slice(8))}
        </button>
      })}
    </div>
    <ul className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-sm text-gray-700">
      <li className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-green-50 border border-green-300" />Disponible</li>
      <li className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-red-100 border border-red-300" />Ocupado</li>
      <li className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-gray-100 border border-gray-300" />Pasado</li>
      <li className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-orange-600" />Tu estancia</li>
    </ul>
    <p className="mt-3" role="status">{!start ? 'Elige tu fecha de entrada en el calendario.'
      : !end ? 'Entrada ' + start + '. Ahora elige la salida (la noche de salida no se cobra).'
      : 'Entrada ' + start + ' → Salida ' + end + ' · ' + stay + (stay === 1 ? ' noche' : ' noches')}</p>
  </div>
}
