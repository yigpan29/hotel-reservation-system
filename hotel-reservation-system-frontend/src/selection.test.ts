import { describe, expect, it } from 'vitest'
import { addRoom, chooseType, compatibleTypes, defaultRooms, maxRooms, readRooms, removeRoom, roomIssue, roomPrice, roomsGuests, roomsParam, selectionComplete, selectionIssue, selectionNightly, selectionTotal, setRoomGuests, unitsChosen, type RoomGroup } from './selection'
import type { RoomType } from './types'

const type = (name: string, capacity: number, available: number, price: number): RoomType =>
  ({ type: name, capacity, available, pricePerNight: price, totalPrice: price * 2 })
const individual = type('Individual', 1, 1, 50), doble = type('Doble', 2, 1, 80), suite = type('Suite', 4, 2, 200)
const types = [individual, doble, suite]
const group = (adults: number, children: number, chosen = ''): RoomGroup => ({ adults, children, type: chosen })

describe('habitaciones pedidas', () => {
  it('empieza con una habitación de dos adultos', () => {
    expect(defaultRooms()).toEqual([{ adults: 2, children: 0, type: '' }])
  })
  it('agrega y elimina habitaciones sin tocar las demás', () => {
    const two = addRoom([group(2, 0, 'Doble')])
    expect(two).toEqual([group(2, 0, 'Doble'), group(2, 0)])
    expect(removeRoom(two, 1)).toEqual([group(2, 0, 'Doble')])
    expect(removeRoom(two, 0)).toEqual([group(2, 0)])
  })
  it('nunca deja la reserva sin habitaciones ni pasa del máximo', () => {
    expect(removeRoom([group(2, 0)], 0)).toEqual([group(2, 0)])
    const full = Array.from({ length: maxRooms }, () => group(1, 0))
    expect(addRoom(full)).toBe(full)
  })
  it('suma los huéspedes de todas las habitaciones', () => {
    expect(roomsGuests([group(2, 1), group(1, 2)])).toEqual({ adults: 3, children: 3 })
  })
})

describe('tipo de cada habitación', () => {
  it('muestra solo los tipos que admiten a ese grupo', () => {
    expect(compatibleTypes(types, group(1, 0)).map(item => item.type)).toEqual(['Individual', 'Doble', 'Suite'])
    expect(compatibleTypes(types, group(2, 1)).map(item => item.type)).toEqual(['Suite'])
    expect(compatibleTypes(types, group(3, 2))).toEqual([])
  })
  it('elige y suelta el tipo de una sola habitación', () => {
    const rooms = [group(2, 0), group(1, 0)]
    expect(chooseType(rooms, 1, 'Doble')).toEqual([group(2, 0), group(1, 0, 'Doble')])
    expect(chooseType([group(2, 0, 'Doble')], 0, 'Doble')).toEqual([group(2, 0)])
  })
  it('suelta el tipo elegido si deja de admitir a los huéspedes', () => {
    const rooms = [group(2, 0, 'Doble')]
    expect(setRoomGuests(rooms, 0, types, { adults: 2, children: 1 })).toEqual([group(2, 1)])
    expect(setRoomGuests(rooms, 0, types, { adults: 1, children: 0 })).toEqual([group(1, 0, 'Doble')])
  })
  it('cuenta cuántas habitaciones piden el mismo tipo', () => {
    expect(unitsChosen([group(2, 0, 'Suite'), group(1, 0, 'Suite'), group(1, 0, 'Doble')], 'Suite')).toBe(2)
  })
})

describe('validación antes de continuar', () => {
  it('pide elegir un tipo para cada habitación', () => {
    expect(roomIssue(types, [group(2, 0)], 0)).toBe('Elige un tipo de habitación.')
    expect(selectionIssue(types, [group(2, 0, 'Doble'), group(1, 0)])).toBe('Habitación 2: Elige un tipo de habitación.')
    expect(selectionComplete(types, [group(2, 0, 'Doble')])).toBe(true)
  })
  it('avisa cuando ningún tipo admite al grupo', () => {
    expect(roomIssue(types, [group(3, 2)], 0)).toBe('Ningún tipo disponible admite 5 huéspedes.')
  })
  it('exige unidades suficientes cuando varias habitaciones piden el mismo tipo', () => {
    const twoDoble = [group(2, 0, 'Doble'), group(2, 0, 'Doble')]
    expect(roomIssue(types, twoDoble, 0)).toBe('Solo 1 de tipo Doble queda libre en esas fechas.')
    expect(selectionComplete(types, twoDoble)).toBe(false)
    const twoSuite = [group(2, 2, 'Suite'), group(2, 2, 'Suite')]
    expect(selectionComplete(types, twoSuite)).toBe(true)
  })
  it('avisa cuando se piden más habitaciones que las disponibles', () => {
    expect(selectionIssue(types, [group(1, 0), group(1, 0), group(1, 0), group(1, 0), group(1, 0)]))
      .toBe('Pediste 5 habitaciones y solo quedan 4 disponibles para las fechas seleccionadas.')
  })
  it('suelta el tipo que ya no existe en el cálculo nuevo', () => {
    expect(roomIssue([suite], [group(2, 0, 'Doble')], 0)).toBe('El tipo Doble ya no admite 2 huéspedes.')
  })
})

describe('precio de lo elegido', () => {
  it('se actualiza con cada tipo elegido', () => {
    expect(selectionTotal(types, [group(2, 0)], 2)).toBe(0)
    expect(selectionTotal(types, [group(2, 0, 'Doble')], 2)).toBe(160)
    expect(selectionTotal(types, [group(2, 0, 'Doble'), group(2, 2, 'Suite')], 2)).toBe(560)
    expect(selectionNightly(types, [group(2, 0, 'Doble'), group(2, 2, 'Suite')])).toBe(280)
    expect(roomPrice(types, group(2, 2, 'Suite'), 2)).toBe(400)
  })
})

describe('habitaciones en la URL', () => {
  it('conserva huéspedes y habitaciones al recargar', () => {
    expect(roomsParam([group(2, 0, 'Doble'), group(1, 2)])).toBe('2-0_1-2')
    expect(readRooms('2-0_1-2')).toEqual([group(2, 0), group(1, 2)])
  })
  it('sin valor o con basura usa la configuración por defecto', () => {
    expect(readRooms(null)).toEqual(defaultRooms())
    expect(readRooms('')).toEqual(defaultRooms())
    expect(readRooms('x-y')).toEqual([group(1, 0)])
    expect(readRooms('0--3')).toEqual([group(1, 0)])
  })
  it('no admite más habitaciones que el máximo', () => {
    expect(readRooms(Array.from({ length: maxRooms + 4 }, () => '1-0').join('_'))).toHaveLength(maxRooms)
  })
})
