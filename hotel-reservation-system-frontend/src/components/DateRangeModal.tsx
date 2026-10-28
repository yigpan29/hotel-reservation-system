import { useState } from 'react'
import AvailabilityCalendar from './AvailabilityCalendar'
import Modal from './Modal'
import Button from '../ui/Button'
import type { Room } from '../types'

/** Modal del calendario: las fechas solo se aplican al confirmar; el borrador parte de la estadía ya elegida. */
export default function DateRangeModal({ subtitle, rooms, initialStart, initialEnd, focus, onConfirm, onCancel }: { subtitle: string; rooms: Room[]; initialStart: string; initialEnd: string; focus: string; onConfirm: (start: string, end: string) => void; onCancel: () => void }) {
  const [start, setStart] = useState(initialStart), [end, setEnd] = useState(initialEnd)
  return <Modal title="Seleccionar fechas" subtitle={subtitle} onClose={onCancel}>
    <AvailabilityCalendar rooms={rooms} start={start} end={end} focus={focus} onChange={(from, to) => { setStart(from); setEnd(to) }} />
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel} className="sm:w-auto" full>Cancelar</Button>
      <Button disabled={!start || !end} onClick={() => onConfirm(start, end)} className="sm:w-auto" full>Confirmar fechas</Button>
    </div>
  </Modal>
}
