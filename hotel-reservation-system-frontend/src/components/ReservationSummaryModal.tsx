import Modal from './Modal'
import { money, nightsBetween, type Room } from '../types'

/** Segundo modal, independiente del calendario: resume la reserva antes de guardarla. */
export default function ReservationSummaryModal({ hotelName, room, start, end, busy, error, onBack, onConfirm }: { hotelName: string; room: Room; start: string; end: string; busy: boolean; error: string; onBack: () => void; onConfirm: () => void }) {
  const nights = nightsBetween(start, end)
  const rows: [string, string][] = [['Hotel', hotelName], ['Tipo de habitación', room.type], ['Número de habitación', room.roomNumber], ['Entrada', start], ['Salida', end], ['Noches', String(nights)], ['Precio por noche', money(room.pricePerNight)]]
  return <Modal title="Resumen de tu reserva" onClose={onBack} dismissible={!busy}>
    <dl className="mt-4 divide-y divide-gray-100">
      {rows.map(([name, value]) => <div key={name} className="flex justify-between gap-4 py-2"><dt className="text-gray-600">{name}</dt><dd className="font-medium text-right">{value}</dd></div>)}
      <div className="flex justify-between gap-4 py-3"><dt className="font-bold">Precio total</dt><dd className="font-bold text-orange-700 text-right">{money(room.pricePerNight * nights)}</dd></div>
    </dl>
    <p className="text-sm text-gray-600">La salida es exclusiva. No se solicita ningún pago ni tarjeta.</p>
    {error && <p role="alert" className="notice-error">{error}</p>}
    <div className="flex justify-end gap-3 mt-5">
      <button type="button" className="rounded border border-gray-300 px-5 py-2 hover:bg-gray-100" disabled={busy} onClick={onBack}>Volver</button>
      <button type="button" className="action" disabled={busy} onClick={onConfirm}>{busy ? 'Confirmando…' : 'Confirmar reserva'}</button>
    </div>
  </Modal>
}
