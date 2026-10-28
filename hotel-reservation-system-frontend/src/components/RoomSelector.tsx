import { guestsLabel } from '../guests'
import { isSelected, stayPrice, toggleRoom } from '../selection'
import { money, type Room } from '../types'

const glyphs = ['▥', '▤', '▦', '▧', '▨', '▩']

/** Habitaciones del hotel, una por una: el cliente elige las que quiere y el sistema suma su capacidad. */
export default function RoomSelector({ rooms, selection, nights, onChange }: { rooms: Room[]; selection: number[]; nights: number; onChange: (selection: number[]) => void }) {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{rooms.map((room, index) => {
    const chosen = isSelected(selection, room.id)
    return <article key={room.id} aria-label={'Habitación ' + room.roomNumber} className={'bg-white rounded-xl shadow overflow-hidden border ' + (chosen ? 'border-orange-500 ring-2 ring-orange-200' : '')}>
      <div className="h-32 bg-gradient-to-br from-orange-100 to-orange-300 flex items-center justify-center text-orange-700 text-5xl" aria-hidden="true">{glyphs[index % glyphs.length]}</div>
      <div className="p-5">
        <h3 className="text-xl font-bold">{room.type}</h3>
        <p className="text-gray-600 my-2">Habitación {room.roomNumber} · hasta {guestsLabel(room.capacity)}</p>
        <p className="text-orange-700 font-semibold">{money(room.pricePerNight)} <span className="text-gray-600 font-normal">por noche</span></p>
        <p className="my-2">Total · {nights === 1 ? '1 noche' : nights + ' noches'}: <strong>{money(stayPrice(room, nights))}</strong></p>
        {!room.available ? <p className="notice-error mt-3">Ocupada en esas fechas</p>
          : <button type="button" aria-label={(chosen ? 'Quitar la habitación ' : 'Seleccionar la habitación ') + room.roomNumber}
            className={chosen ? 'rounded border border-orange-600 text-orange-700 px-5 py-2 hover:bg-orange-50' : 'action'}
            onClick={() => onChange(toggleRoom(room, selection))}>{chosen ? 'Quitar' : 'Seleccionar'}</button>}
        {chosen && <p role="status" className="text-sm text-gray-600 mt-2">Seleccionada · aporta {guestsLabel(room.capacity)}</p>}
      </div>
    </article>
  })}</div>
}
