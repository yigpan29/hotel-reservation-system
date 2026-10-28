import { adultsLabel, guestsLabel, roomsLabel, totalGuests, type Guests } from './guests'
import type { Room } from './types'

/** Reglas puras de la selección de habitaciones: sin React ni red, para poder probarlas aisladas. */
export const isSelected = (selection: number[], roomId: number) => selection.includes(roomId)
/** Elegir o quitar una habitación; una habitación ocupada no se puede elegir. */
export const toggleRoom = (room: Room, selection: number[]): number[] => !room.available ? selection
  : isSelected(selection, room.id) ? selection.filter(id => id !== room.id)
  : [...selection, room.id].sort((left, right) => left - right)

export const selectedRooms = (rooms: Room[], selection: number[]): Room[] =>
  selection.map(id => rooms.find(room => room.id === id)).filter((room): room is Room => room !== undefined)
/** La capacidad se suma sola con cada habitación elegida. */
export const selectedCapacity = (rooms: Room[], selection: number[]) =>
  selectedRooms(rooms, selection).reduce((total, room) => total + room.capacity, 0)
export const missingGuests = (rooms: Room[], selection: number[], guests: Guests) =>
  Math.max(0, totalGuests(guests) - selectedCapacity(rooms, selection))

/**
 * Por qué la selección todavía no alcanza, o '' si ya sirve: hace falta capacidad para todos los
 * huéspedes y un adulto por habitación, que es la restricción de ocupación que nadie puede saltarse.
 */
export function selectionIssue(rooms: Room[], selection: number[], guests: Guests): string {
  if (!selection.length) return 'Elige al menos una habitación para continuar.'
  if (selection.length > guests.adults) return 'Cada habitación necesita al menos un adulto: ' + adultsLabel(guests.adults)
    + (guests.adults === 1 ? ' no puede ocupar ' : ' no pueden ocupar ') + roomsLabel(selection.length) + '.'
  const missing = missingGuests(rooms, selection, guests)
  return missing ? 'Faltan por cubrir ' + guestsLabel(missing) + '.' : ''
}
export const selectionComplete = (rooms: Room[], selection: number[], guests: Guests) => selectionIssue(rooms, selection, guests) === ''

/** El precio se recalcula con cada habitación elegida; sin total del backend se deriva de la tarifa. */
export const stayPrice = (room: Room, nights: number) => room.totalPrice ?? room.pricePerNight * nights
export const selectionNightly = (rooms: Room[], selection: number[]) =>
  selectedRooms(rooms, selection).reduce((total, room) => total + room.pricePerNight, 0)
export const selectionTotal = (rooms: Room[], selection: number[], nights: number) =>
  selectedRooms(rooms, selection).reduce((total, room) => total + stayPrice(room, nights), 0)
/** Habitaciones elegidas que dejaron de estar disponibles en el último cálculo del backend. */
export const lostRooms = (rooms: Room[], selection: number[]) =>
  selection.filter(id => !rooms.find(room => room.id === id)?.available)
