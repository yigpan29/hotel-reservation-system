import { useEffect, useMemo, useState } from 'react'
import { api, message } from '../api'
import { dateAfter, nightsBetween, type Room, type RoomOccupancy } from '../types'

const weekdays = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const monthsAhead = 11
const maxNightsPerRange = 400

const key = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (day: string, amount: number) => { const date = new Date(day + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + amount); return key(date) }
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
  const limit = today.slice(0, 7)
  useEffect(() => {
    let current = true
    setOccupancy(null); setError('')
    Promise.all(ids.split(',').map(id => api<RoomOccupancy>('/rooms/' + id + '/occupancy'))).then(value => { if (current) setOccupancy(value) }).catch(failure => { if (current) setError(message(failure)) })
    return () => { current = false }
  }, [ids])
  const blocked = occupancy === null
  const nights = useMemo(() => (occupancy || []).map(room => {
    const taken = new Set<string>()
    for (const range of room.occupied) {
      let day = range.startDate
      for (let guard = 0; day < range.endDate && guard < maxNightsPerRange; guard++) { taken.add(day); day = addDays(day, 1) }
    }
    return taken
  }), [occupancy])
  const roomFree = (taken: Set<string>, from: string, to: string) => { for (let day = from; day < to; day = addDays(day, 1)) if (taken.has(day)) return false; return true }
  const anyRoomFree = (from: string, to: string) => nights.some(taken => roomFree(taken, from, to))
  const [year, month] = cursor.split('-').map(Number)
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const days = Array.from({ length: total }, (_, index) => key(new Date(Date.UTC(year, month - 1, index + 1))))
  const shift = (amount: number) => { const moved = new Date(Date.UTC(year, month - 1 + amount, 1)); setCursor(key(moved).slice(0, 7)) }
  const monthsFromNow = (year - Number(limit.slice(0, 4))) * 12 + (month - Number(limit.slice(5, 7)))
  const stay = start && end ? nightsBetween(start, end) : 0
  const choosingEnd = Boolean(start) && !end

  function pick(day: string) {
    if (choosingEnd && day > start && anyRoomFree(start, day)) { onChange(start, day); return }
    if (day >= today && anyRoomFree(day, addDays(day, 1))) onChange(day, '')
  }

  return <div aria-label="Calendario de disponibilidad" role="group">
    <div className="flex items-center justify-between gap-2">
      <button type="button" className="action px-3 py-1" disabled={monthsFromNow <= 0} aria-label="Mes anterior" onClick={() => shift(-1)}>‹</button>
      <span className="text-center font-semibold capitalize" aria-live="polite">{monthNames[month - 1]} {year}</span>
      <button type="button" className="action px-3 py-1" disabled={monthsFromNow >= monthsAhead} aria-label="Mes siguiente" onClick={() => shift(1)}>›</button>
    </div>
    {blocked && !error && <p role="status" className="mt-3">Cargando disponibilidad…</p>}
    {error && <p role="alert" className="notice-error">{error}</p>}
    <div className="grid grid-cols-7 gap-1 mt-4 text-center text-sm">
      {weekdays.map(name => <abbr key={name} className="py-1 font-semibold text-gray-600 no-underline">{name}</abbr>)}
      {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} />)}
      {days.map(day => {
        const past = day < today, busy = !blocked && !anyRoomFree(day, addDays(day, 1))
        const reachable = choosingEnd && day > start && !blocked && anyRoomFree(start, day)
        const unreachable = choosingEnd && day > start && !blocked && !reachable && !busy
        const selected = day === start || day === end
        const inside = Boolean(start && end) && day > start && day < end
        const disabled = blocked || unreachable || ((past || busy) && !reachable)
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
