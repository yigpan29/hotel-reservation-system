import { defaultGuests, guestsLabel, readAdults, readChildren, roomsLabel, totalGuests, type Guests } from './guests'
import type { RoomType } from './types'

/** Reglas puras de las habitaciones pedidas: sin React ni red, para poder probarlas aisladas. */
export interface RoomGroup { adults: number; children: number; type: string }
export const maxRooms = 8
export const newRoom = (): RoomGroup => ({ ...defaultGuests, type: '' })
export const defaultRooms = (): RoomGroup[] => [newRoom()]

export const roomGuests = (room: RoomGroup): Guests => ({ adults: room.adults, children: room.children })
export const roomsGuests = (rooms: RoomGroup[]): Guests =>
  ({ adults: rooms.reduce((total, room) => total + room.adults, 0), children: rooms.reduce((total, room) => total + room.children, 0) })
export const fits = (type: RoomType | undefined, guests: Guests) => type !== undefined && type.capacity >= totalGuests(guests)
export const typeNamed = (types: RoomType[], name: string) => types.find(type => type.type === name)
export const compatibleTypes = (types: RoomType[], room: RoomGroup) => types.filter(type => fits(type, roomGuests(room)))
/** Cuántas habitaciones pidió el cliente de un mismo tipo: hacen falta tantas unidades libres. */
export const unitsChosen = (rooms: RoomGroup[], name: string) => rooms.filter(room => room.type === name).length

export const addRoom = (rooms: RoomGroup[]) => rooms.length >= maxRooms ? rooms : [...rooms, newRoom()]
export const removeRoom = (rooms: RoomGroup[], index: number) => rooms.length <= 1 ? rooms : rooms.filter((_, position) => position !== index)
/** Cambiar los huéspedes puede dejar al tipo elegido sin capacidad: entonces se suelta para elegir otro. */
export const setRoomGuests = (rooms: RoomGroup[], index: number, types: RoomType[], guests: Guests): RoomGroup[] =>
  rooms.map((room, position) => position !== index ? room
    : { ...guests, type: fits(typeNamed(types, room.type), guests) ? room.type : '' })
/** Elegir el tipo de una habitación; volver a pulsar el elegido lo suelta. */
export const chooseType = (rooms: RoomGroup[], index: number, name: string): RoomGroup[] =>
  rooms.map((room, position) => position !== index ? room : { ...room, type: room.type === name ? '' : name })

/** Por qué una habitación pedida todavía no está lista, o '' si ya lo está. */
export function roomIssue(types: RoomType[], rooms: RoomGroup[], index: number): string {
  const room = rooms[index], guests = roomGuests(room)
  if (!compatibleTypes(types, room).length) return 'Ningún tipo disponible admite ' + guestsLabel(totalGuests(guests)) + '.'
  if (!room.type) return 'Elige un tipo de habitación.'
  const chosen = typeNamed(types, room.type)
  if (!fits(chosen, guests)) return 'El tipo ' + room.type + ' ya no admite ' + guestsLabel(totalGuests(guests)) + '.'
  if (unitsChosen(rooms, room.type) > (chosen as RoomType).available)
    return 'Solo ' + (chosen as RoomType).available + ' de tipo ' + room.type + ' ' + ((chosen as RoomType).available === 1 ? 'queda libre' : 'quedan libres') + ' en esas fechas.'
  return ''
}
/** El primer problema de la reserva, nombrando la habitación; '' cuando todo está elegido y cabe. */
export function selectionIssue(types: RoomType[], rooms: RoomGroup[]): string {
  const units = types.reduce((total, type) => total + type.available, 0)
  if (rooms.length > units) return 'Pediste ' + roomsLabel(rooms.length) + ' y solo ' + (units === 1 ? 'queda 1 disponible' : 'quedan ' + units + ' disponibles') + ' para las fechas seleccionadas.'
  for (let index = 0; index < rooms.length; index++) {
    const issue = roomIssue(types, rooms, index)
    if (issue) return 'Habitación ' + (index + 1) + ': ' + issue
  }
  return ''
}
export const selectionComplete = (types: RoomType[], rooms: RoomGroup[]) => selectionIssue(types, rooms) === ''

/** El precio se recalcula con cada tipo elegido; sin total del backend se deriva de la tarifa. */
export const stayPrice = (type: RoomType, nights: number) => type.totalPrice ?? type.pricePerNight * nights
export const roomPrice = (types: RoomType[], room: RoomGroup, nights: number) => {
  const chosen = typeNamed(types, room.type)
  return chosen ? stayPrice(chosen, nights) : 0
}
export const selectionNightly = (types: RoomType[], rooms: RoomGroup[]) =>
  rooms.reduce((total, room) => total + (typeNamed(types, room.type)?.pricePerNight ?? 0), 0)
export const selectionTotal = (types: RoomType[], rooms: RoomGroup[], nights: number) =>
  rooms.reduce((total, room) => total + roomPrice(types, room, nights), 0)

/** Las habitaciones pedidas viven en la URL, como las fechas: recargar no pierde lo configurado. */
export const roomsParam = (rooms: RoomGroup[]) => rooms.map(room => room.adults + '-' + room.children).join('_')
export const readRooms = (value: string | null): RoomGroup[] => {
  const parsed = (value || '').split('_').filter(Boolean).slice(0, maxRooms)
    .map(part => ({ adults: readAdults(part.split('-')[0] ?? null), children: readChildren(part.split('-')[1] ?? null), type: '' }))
  return parsed.length ? parsed : defaultRooms()
}
