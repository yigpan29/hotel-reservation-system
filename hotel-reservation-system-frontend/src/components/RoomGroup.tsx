import GuestSelector from './GuestSelector'
import { guestsLabel, type Guests } from '../guests'
import { compatibleTypes, roomGuests, stayPrice, type RoomGroup as Group } from '../selection'
import { money, type RoomType } from '../types'

const glyphs = ['▥', '▤', '▦', '▧', '▨', '▩']

/**
 * Una habitación pedida: sus huéspedes con los controles (+) y (−) y los tipos que pueden alojarlos.
 * El cliente elige un tipo para este grupo; no se vuelve a repartir huéspedes después.
 */
export default function RoomGroup({ types, rooms, index, nights, onGuests, onType, onRemove }: { types: RoomType[]; rooms: Group[]; index: number; nights: number; onGuests: (guests: Guests) => void; onType: (type: string) => void; onRemove: () => void }) {
  const room = rooms[index], name = 'la habitación ' + (index + 1)
  const compatible = compatibleTypes(types, room)
  return <section aria-label={'Habitación ' + (index + 1)} className="panel mt-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-xl font-bold">Habitación {index + 1}</h3>
      {rooms.length > 1 && <button type="button" aria-label={'Eliminar la habitación ' + (index + 1)}
        className="rounded border border-gray-300 px-4 py-1 hover:bg-gray-100" onClick={onRemove}>Eliminar</button>}
    </div>
    <div className="mt-3"><GuestSelector guests={roomGuests(room)} onChange={onGuests} name={name} hints={index === 0} /></div>
    {compatible.length > 0 && <><p className="mt-4 text-gray-700">Elige el tipo de habitación para estos huéspedes:</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-3">{compatible.map((type, position) => {
          const chosen = room.type === type.type
          return <article key={type.type} aria-label={type.type + ' para la habitación ' + (index + 1)}
            className={'bg-white rounded-xl shadow overflow-hidden border ' + (chosen ? 'border-orange-500 ring-2 ring-orange-200' : '')}>
            <div className="h-32 bg-gradient-to-br from-orange-100 to-orange-300 flex items-center justify-center text-orange-700 text-5xl" aria-hidden="true">{glyphs[position % glyphs.length]}</div>
            <div className="p-5">
              <h4 className="text-lg font-bold">{type.type}</h4>
              <p className="text-gray-600 my-2">Hasta {guestsLabel(type.capacity)} · {type.available === 1 ? '1 habitación disponible' : type.available + ' habitaciones disponibles'}</p>
              <p className="text-orange-700 font-semibold">{money(type.pricePerNight)} <span className="text-gray-600 font-normal">por noche</span></p>
              <p className="my-2">Total · {nights === 1 ? '1 noche' : nights + ' noches'}: <strong>{money(stayPrice(type, nights))}</strong></p>
              <button type="button" aria-label={(chosen ? 'Quitar ' : 'Elegir ') + type.type + ' en ' + name}
                className={chosen ? 'rounded border border-orange-600 text-orange-700 px-5 py-2 hover:bg-orange-50' : 'action'}
                onClick={() => onType(type.type)}>{chosen ? 'Elegida' : 'Elegir'}</button>
            </div>
          </article>
        })}</div></>}
  </section>
}
