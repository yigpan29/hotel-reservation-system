import { useEffect, useMemo, useState } from 'react'
import { api, message } from '../api'
import { dayInfo, monthGrid, monthsAhead, monthsFromNow, occupiedNights, pickDay, shiftMonth } from '../availability'
import { dateAfter, nightsBetween, type Room, type RoomOccupancy } from '../types'
import Notice from '../ui/Notice'
import { Loading } from '../ui/Loading'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '../ui/Icons'

const weekdays = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const label = (day: string) => { const [year, month, date] = day.split('-'); return Number(date) + ' de ' + monthNames[Number(month) - 1] + ' de ' + year }

const navClass =
  'grid h-10 w-10 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-card'
  + ' transition-[background-color,border-color,transform,color] duration-160 ease-out-strong'
  + ' hover:bg-ink-50 hover:text-ink-900 active:scale-[0.94] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'

const legend = [
  { swatch: 'bg-white border border-ink-300', text: 'Disponible' },
  { swatch: 'bg-danger-50 border border-danger-200', text: 'Ocupado' },
  { swatch: 'bg-ink-100 border border-ink-200', text: 'Pasado' },
  { swatch: 'bg-brand-600 border border-brand-700', text: 'Tu estancia' },
]

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
      <button type="button" className={navClass} disabled={away <= 0} aria-label="Mes anterior" onClick={() => setCursor(shiftMonth(cursor, -1))}>
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <span className="text-center text-base font-semibold capitalize text-ink-900" aria-live="polite">{monthNames[month - 1]} {year}</span>
      <button type="button" className={navClass} disabled={away >= monthsAhead} aria-label="Mes siguiente" onClick={() => setCursor(shiftMonth(cursor, 1))}>
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>

    {blocked && !error && <Loading label="Cargando disponibilidad…" className="mt-4 justify-center" />}
    {error && <Notice tone="error" role="alert" className="mt-4">{error}</Notice>}

    <div className="mt-4 grid grid-cols-7 gap-1 text-center">
      {weekdays.map(name => <abbr key={name} className="pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400 no-underline">{name}</abbr>)}
      {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} />)}
      {days.map(day => {
        const { past, busy, reachable, unreachable, selected, inside, disabled } = dayInfo(day, context)
        const tone = selected ? 'bg-brand-600 text-white font-semibold shadow-card disabled:opacity-100'
          : inside ? 'bg-brand-50 text-brand-900 font-medium'
          : past ? 'bg-ink-50 text-ink-300'
          : busy || unreachable ? 'bg-danger-50 text-danger-600 line-through' + (reachable ? ' ring-1 ring-brand-400' : '')
          : 'text-ink-800 hover:bg-brand-50 hover:text-brand-900'
        return <button key={day} type="button" disabled={disabled} onClick={() => pick(day)}
          aria-pressed={selected}
          className={'h-10 min-w-0 rounded-lg text-sm transition-[background-color,color,transform] duration-160 ease-out-strong'
            + ' enabled:active:scale-[0.94] disabled:cursor-not-allowed sm:h-11 ' + tone}
          aria-label={label(day) + (selected ? day === start ? ' · entrada seleccionada' : ' · salida seleccionada'
            : past ? ' · fecha pasada' : busy ? reachable ? ' · solo salida' : ' · ocupado' : unreachable ? ' · ocupado para esta estadía' : ' · disponible')}>
          {Number(day.slice(8))}
        </button>
      })}
    </div>

    <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-500">
      {legend.map(item => <li key={item.text} className="flex items-center gap-2">
        <span aria-hidden="true" className={'h-3.5 w-3.5 rounded ' + item.swatch} />{item.text}
      </li>)}
    </ul>

    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ink-200 bg-ink-25 p-3.5 text-sm text-ink-700">
      <CalendarIcon className="mt-0.5 h-4 w-4 text-brand-600" />
      <p role="status">{!start ? 'Elige tu fecha de entrada en el calendario.'
        : !end ? 'Entrada ' + start + '. Ahora elige la salida (el día de salida no cuenta como noche).'
        : 'Entrada ' + start + ' → Salida ' + end + ' · ' + stay + (stay === 1 ? ' noche' : ' noches')}</p>
    </div>
  </div>
}
