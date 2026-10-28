import Button from '../ui/Button'
import { guestLabel, roomsLabel, type Guests } from '../guests'
import { prettyDay } from '../types'
import { CalendarIcon, ClockIcon, UsersIcon } from '../ui/Icons'

/**
 * La barra de la estadía: lo que el cliente ya eligió, en una sola línea, y el único
 * botón que lo cambia. Mientras no haya fechas, es la invitación a elegirlas.
 */
export default function StayBar({ stay, nights, rooms, guests, disabled, onPick }: {
  stay: { start: string; end: string } | null
  nights: number
  rooms: number
  guests: Guests
  disabled: boolean
  onPick: () => void
}) {
  if (!stay) return <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-ink-300 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3.5">
      <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <CalendarIcon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-ink-900">Elige tus fechas</p>
        <p className="mt-1 text-sm text-ink-500">El calendario muestra qué noches están libres en este hotel.</p>
      </div>
    </div>
    <Button size="lg" disabled={disabled} onClick={onPick} className="w-full sm:w-auto">Seleccionar fechas</Button>
  </div>

  const cells = [
    { Glyph: CalendarIcon, label: 'Fechas', value: prettyDay(stay.start) + ' → ' + prettyDay(stay.end) },
    { Glyph: ClockIcon, label: 'Estadía', value: nights === 1 ? '1 noche' : nights + ' noches' },
    { Glyph: UsersIcon, label: 'Huéspedes', value: roomsLabel(rooms) + ' · ' + guestLabel(guests) },
  ]
  return <div className="rounded-2xl border border-ink-200/80 bg-white p-2 shadow-card">
    <div className="flex flex-col gap-1 lg:flex-row lg:items-stretch">
      <dl className="grid flex-1 gap-1 sm:grid-cols-3">
        {cells.map(({ Glyph, label, value }) => <div key={label} className="rounded-xl px-3.5 py-3 transition-colors duration-160 hover:bg-ink-50">
          <dt className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
            <Glyph className="h-3.5 w-3.5" />{label}
          </dt>
          <dd className="mt-1 truncate text-sm font-semibold text-ink-900">{value}</dd>
        </div>)}
      </dl>
      <div className="flex items-center p-1.5 lg:border-l lg:border-ink-100 lg:pl-3">
        <Button variant="subtle" disabled={disabled} onClick={onPick} className="w-full lg:w-auto">Cambiar fechas</Button>
      </div>
    </div>
  </div>
}
