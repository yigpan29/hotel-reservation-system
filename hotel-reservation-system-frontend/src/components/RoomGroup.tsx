import GuestSelector from './GuestSelector'
import { guestsLabel, type Guests } from '../guests'
import { compatibleTypes, roomGuests, stayPrice, type RoomGroup as Group } from '../selection'
import { money, type RoomType } from '../types'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { BedIcon, CheckIcon, InfoIcon, TrashIcon, UsersIcon } from '../ui/Icons'

// Cada tipo recibe un tono distinto de la misma familia: se distinguen de un vistazo sin salir de la paleta.
const covers = [
  'from-brand-100 via-brand-200 to-brand-400',
  'from-ink-100 via-ink-200 to-ink-400',
  'from-brand-50 via-brand-100 to-brand-300',
  'from-ink-200 via-brand-100 to-brand-300',
]

/**
 * Una habitación pedida: sus huéspedes con los controles (+) y (−) y los tipos que pueden alojarlos.
 * El cliente elige un tipo para este grupo; no se vuelve a repartir huéspedes después.
 */
export default function RoomGroup({ types, rooms, index, nights, onGuests, onType, onRemove }: { types: RoomType[]; rooms: Group[]; index: number; nights: number; onGuests: (guests: Guests) => void; onType: (type: string) => void; onRemove: () => void }) {
  const room = rooms[index], name = 'la habitación ' + (index + 1)
  const compatible = compatibleTypes(types, room)
  return <section aria-label={'Habitación ' + (index + 1)} className="panel">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-sm font-bold text-ink-700">{index + 1}</span>
        <h3 className="text-lg font-semibold text-ink-900">Habitación {index + 1}</h3>
        {room.type
          ? <Badge tone="brand" dot>{room.type}</Badge>
          : <Badge tone="neutral">Sin tipo elegido</Badge>}
      </div>
      {rooms.length > 1 && <Button variant="ghost" size="sm" aria-label={'Eliminar la habitación ' + (index + 1)}
        onClick={onRemove} className="text-ink-500 hover:text-danger-700">
        <TrashIcon className="h-4 w-4" />Eliminar
      </Button>}
    </div>

    <div className="mt-5"><GuestSelector guests={roomGuests(room)} onChange={onGuests} name={name} hints={index === 0} /></div>

    {compatible.length === 0
      ? <div className="mt-5 flex gap-3 rounded-xl border border-ink-200 bg-ink-25 p-4 text-sm text-ink-600">
          <InfoIcon className="mt-0.5 h-5 w-5 text-ink-400" />
          <p>Ningún tipo disponible admite a estos huéspedes en una sola habitación. Reduce los huéspedes de esta habitación o agrega otra habitación al pedido.</p>
        </div>
      : <>
        <div className="mt-6 flex items-baseline justify-between gap-3 border-t border-ink-100 pt-5">
          <p className="text-sm font-medium text-ink-700">Elige el tipo de habitación para estos huéspedes</p>
          <p className="text-xs text-ink-400">{compatible.length === 1 ? '1 opción' : compatible.length + ' opciones'}</p>
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {compatible.map((type, position) => {
            const chosen = room.type === type.type
            return <article key={type.type} aria-label={type.type + ' para la habitación ' + (index + 1)}
              className={'card flex flex-col transition-[border-color,box-shadow,transform] duration-220 ease-out-strong '
                + (chosen ? 'border-brand-500 shadow-lift ring-2 ring-brand-500/25' : 'hover:border-ink-300')}>
              <div aria-hidden="true" className={'relative h-28 bg-gradient-to-br ' + covers[position % covers.length]}>
                <span className="absolute inset-0 grid place-items-center text-ink-800/45"><BedIcon className="h-10 w-10" strokeWidth={1.25} /></span>
                {chosen && <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white shadow-card">
                  <CheckIcon className="h-4 w-4" />
                </span>}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h4 className="text-base font-semibold text-ink-900">{type.type}</h4>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500">
                  <UsersIcon className="h-4 w-4 text-ink-400" />Hasta {guestsLabel(type.capacity)}
                </p>
                <p className="mt-3">
                  <Badge tone={type.available === 1 ? 'warning' : 'success'} dot>
                    {type.available === 1 ? '1 habitación disponible' : type.available + ' habitaciones disponibles'}
                  </Badge>
                </p>
                <p className="mt-4 text-ink-900">
                  <span className="text-xl font-semibold tabular">{money(type.pricePerNight)}</span>
                  <span className="text-sm text-ink-500"> por noche</span>
                </p>
                <p className="mt-1 text-sm text-ink-500">
                  Total · {nights === 1 ? '1 noche' : nights + ' noches'}: <strong className="font-semibold text-ink-800 tabular">{money(stayPrice(type, nights))}</strong>
                </p>
                <Button variant={chosen ? 'outline' : 'primary'} full className="mt-5"
                  aria-label={(chosen ? 'Quitar ' : 'Elegir ') + type.type + ' en ' + name}
                  onClick={() => onType(type.type)}>
                  {chosen && <CheckIcon className="h-4 w-4" />}{chosen ? 'Elegida' : 'Elegir'}
                </Button>
              </div>
            </article>
          })}
        </div>
      </>}
  </section>
}
