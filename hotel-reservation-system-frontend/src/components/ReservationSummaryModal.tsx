import type { ReactNode } from 'react'
import Modal from './Modal'
import Button from '../ui/Button'
import Notice from '../ui/Notice'
import { guestLabel, guestsLabel, roomsLabel, totalGuests } from '../guests'
import { roomGuests, roomPrice, roomsGuests, selectionNightly, selectionTotal, type RoomGroup } from '../selection'
import { money, nightsBetween, type RoomType } from '../types'
import { BedIcon, CalendarIcon, UsersIcon } from '../ui/Icons'

/** Segundo modal, independiente del calendario: resume habitaciones, huéspedes y precio antes de guardar. */
export default function ReservationSummaryModal({ hotelName, types, rooms, start, end, busy, error, onBack, onConfirm, children, checkout = false, ready = true }: { hotelName: string; types: RoomType[]; rooms: RoomGroup[]; start: string; end: string; busy: boolean; error: string; onBack: () => void; onConfirm: () => void; children?: ReactNode; checkout?: boolean; ready?: boolean }) {
  const nights = nightsBetween(start, end), guests = roomsGuests(rooms)
  const groups: { heading: string; Glyph: typeof BedIcon; rows: [string, string][] }[] = [
    {
      heading: 'Hotel y habitaciones', Glyph: BedIcon,
      rows: [['Hotel', hotelName],
        ...rooms.map((room, index) => ['Habitación ' + (index + 1) + ' · ' + room.type,
          guestLabel(roomGuests(room)) + ' · ' + money(roomPrice(types, room, nights))] as [string, string]),
        ['Habitaciones', roomsLabel(rooms.length)]],
    },
    {
      heading: 'Estadía', Glyph: CalendarIcon,
      rows: [['Entrada', start], ['Salida', end], ['Noches', String(nights)]],
    },
    {
      heading: 'Huéspedes y precio', Glyph: UsersIcon,
      rows: [['Huéspedes', guestLabel(guests) + ' · ' + guestsLabel(totalGuests(guests))],
        ['Precio por noche', money(selectionNightly(types, rooms))]],
    },
  ]
  return <Modal title="Resumen de tu reserva" subtitle={'Revisa los datos antes de confirmar'} onClose={onBack} dismissible={!busy}>
    <div className="space-y-5">
      {groups.map(({ heading, Glyph, rows }) => <section key={heading}>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
          <Glyph className="h-4 w-4" />{heading}
        </h3>
        <dl className="mt-2.5 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25 px-4">
          {rows.map(([name, value]) => <div key={name} className="flex justify-between gap-4 py-2.5 text-sm">
            <dt className="text-ink-500">{name}</dt>
            <dd className="text-right font-medium text-ink-900 tabular">{value}</dd>
          </div>)}
        </dl>
      </section>)}

      <div className="flex items-center justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-4">
        <span className="text-sm font-semibold text-brand-900">Precio total</span>
        <span className="text-xl font-bold text-brand-800 tabular">{money(selectionTotal(types, rooms, nights))}</span>
      </div>

      <p className="text-xs leading-relaxed text-ink-500">
        {checkout ? 'El total definitivo y el importe de cada habitación se muestran en el checkout antes de autorizar el pago. Todas se confirman juntas tras verificar el cobro.' : 'La salida es exclusiva. Los datos de cada huésped se registran en el check-in.'}
      </p>

      {children}
      {error && <Notice tone="error" role="alert">{error}</Notice>}

      <div className="flex flex-col-reverse gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={busy} onClick={onBack} className="sm:w-auto" full>Volver</Button>
        <Button loading={busy} disabled={!ready} onClick={onConfirm} className="sm:w-auto" full>{busy ? 'Confirmando…' : checkout ? 'Continuar al pago' : 'Confirmar reserva'}</Button>
      </div>
    </div>
  </Modal>
}
