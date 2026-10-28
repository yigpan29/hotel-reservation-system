import { useState } from 'react'
import AvailabilityCalendar from './AvailabilityCalendar'
import Modal from './Modal'
import type { Room } from '../types'

/** Modal del calendario: las fechas solo se aplican al confirmar; el borrador parte de la estadía ya elegida. */
export default function DateRangeModal({ subtitle, rooms, initialStart, initialEnd, focus, onConfirm, onCancel }: { subtitle: string; rooms: Room[]; initialStart: string; initialEnd: string; focus: string; onConfirm: (start: string, end: string) => void; onCancel: () => void }) {
  const [start, setStart] = useState(initialStart), [end, setEnd] = useState(initialEnd)
  return <Modal title="Seleccionar fechas" onClose={onCancel}>
    <p className="text-gray-600 mt-1">{subtitle}</p>
    <div className="mt-4"><AvailabilityCalendar rooms={rooms} start={start} end={end} focus={focus} onChange={(from, to) => { setStart(from); setEnd(to) }} /></div>
    <div className="flex justify-end gap-3 mt-5">
      <button type="button" className="rounded border border-gray-300 px-5 py-2 hover:bg-gray-100" onClick={onCancel}>Cancelar</button>
      <button type="button" className="action" disabled={!start || !end} onClick={() => onConfirm(start, end)}>Confirmar fechas</button>
    </div>
  </Modal>
}
