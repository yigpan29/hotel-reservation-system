import Modal from './Modal'
import { guestLabel, guestsLabel, roomsLabel, totalGuests } from '../guests'
import { roomGuests, roomPrice, roomsGuests, selectionNightly, selectionTotal, type RoomGroup } from '../selection'
import { money, nightsBetween, type RoomType } from '../types'

/** Segundo modal, independiente del calendario: resume habitaciones, huéspedes y precio antes de guardar. */
export default function ReservationSummaryModal({ hotelName, types, rooms, start, end, busy, error, onBack, onConfirm }: { hotelName: string; types: RoomType[]; rooms: RoomGroup[]; start: string; end: string; busy: boolean; error: string; onBack: () => void; onConfirm: () => void }) {
  const nights = nightsBetween(start, end), guests = roomsGuests(rooms)
  const rows: [string, string][] = [['Hotel', hotelName],
    ...rooms.map((room, index) => ['Habitación ' + (index + 1) + ' · ' + room.type,
      guestLabel(roomGuests(room)) + ' · ' + money(roomPrice(types, room, nights))] as [string, string]),
    ['Habitaciones', roomsLabel(rooms.length)],
    ['Huéspedes', guestLabel(guests) + ' · ' + guestsLabel(totalGuests(guests))],
    ['Entrada', start], ['Salida', end], ['Noches', String(nights)], ['Precio por noche', money(selectionNightly(types, rooms))]]
  return <Modal title="Resumen de tu reserva" onClose={onBack} dismissible={!busy}>
    <dl className="mt-4 divide-y divide-gray-100">
      {rows.map(([name, value]) => <div key={name} className="flex justify-between gap-4 py-2"><dt className="text-gray-600">{name}</dt><dd className="font-medium text-right">{value}</dd></div>)}
      <div className="flex justify-between gap-4 py-3"><dt className="font-bold">Precio total</dt><dd className="font-bold text-orange-700 text-right">{money(selectionTotal(types, rooms, nights))}</dd></div>
    </dl>
    <p className="text-sm text-gray-600">La salida es exclusiva. No se solicita ningún pago ni tarjeta. Los datos de cada huésped se registran en el check-in.</p>
    {error && <p role="alert" className="notice-error">{error}</p>}
    <div className="flex justify-end gap-3 mt-5">
      <button type="button" className="rounded border border-gray-300 px-5 py-2 hover:bg-gray-100" disabled={busy} onClick={onBack}>Volver</button>
      <button type="button" className="action" disabled={busy} onClick={onConfirm}>{busy ? 'Confirmando…' : 'Confirmar reserva'}</button>
    </div>
  </Modal>
}
