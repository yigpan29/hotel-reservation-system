import { describe, expect, it } from 'vitest'
import { isSelected, lostRooms, missingGuests, selectedCapacity, selectedRooms, selectionComplete, selectionIssue, selectionNightly, selectionTotal, toggleRoom } from './selection'
import type { Room } from './types'

const room = (id: number, type: string, price: number, capacity: number, available = true): Room =>
  ({ id, hotelId: 1, hotelName: 'Hotel', roomNumber: String(100 + id), type, pricePerNight: price, capacity, active: true, available, totalPrice: price * 2 })
const individual = room(1, 'Individual', 50, 1), doble = room(2, 'Doble', 80, 2), suite = room(3, 'Suite', 200, 4), busy = room(4, 'Doble', 80, 2, false)
const rooms = [individual, doble, suite, busy]
const four = { adults: 2, children: 2 }

describe('elegir y quitar habitaciones', () => {
  it('alterna una habitación sin tocar las demás', () => {
    expect(toggleRoom(doble, [])).toEqual([2])
    expect(toggleRoom(suite, [2])).toEqual([2, 3])
    expect(toggleRoom(doble, [2, 3])).toEqual([3])
    expect(isSelected([2, 3], 3)).toBe(true)
    expect(isSelected([2], 3)).toBe(false)
  })
  it('no deja elegir una habitación ocupada', () => {
    const selection = toggleRoom(busy, [])
    expect(selection).toEqual([])
    expect(toggleRoom(busy, [2])).toEqual([2])
  })
  it('mantiene el orden de la selección aunque se elija en desorden', () => {
    expect(toggleRoom(individual, toggleRoom(suite, []))).toEqual([1, 3])
  })
})

describe('capacidad elegida y huéspedes por cubrir', () => {
  it('suma sola la capacidad de lo elegido', () => {
    expect(selectedCapacity(rooms, [])).toBe(0)
    expect(selectedCapacity(rooms, [2])).toBe(2)
    expect(selectedCapacity(rooms, [2, 3])).toBe(6)
    expect(selectedRooms(rooms, [3, 2])).toEqual([suite, doble])
  })
  it('informa cuántos huéspedes faltan y nunca baja de cero', () => {
    expect(missingGuests(rooms, [], four)).toBe(4)
    expect(missingGuests(rooms, [2], four)).toBe(2)
    expect(missingGuests(rooms, [3], four)).toBe(0)
    expect(missingGuests(rooms, [2, 3], four)).toBe(0)
  })
})

describe('validación de la selección', () => {
  it('pide al menos una habitación', () => {
    expect(selectionIssue(rooms, [], four)).toBe('Elige al menos una habitación para continuar.')
    expect(selectionComplete(rooms, [], four)).toBe(false)
  })
  it('avisa cuando la capacidad no alcanza', () => {
    expect(selectionIssue(rooms, [2], four)).toBe('Faltan por cubrir 2 huéspedes.')
    expect(selectionIssue(rooms, [1], { adults: 2, children: 0 })).toBe('Faltan por cubrir 1 huésped.')
  })
  it('exige un adulto por habitación', () => {
    expect(selectionIssue(rooms, [1, 2, 3], four)).toBe('Cada habitación necesita al menos un adulto: 2 adultos no pueden ocupar 3 habitaciones.')
    expect(selectionIssue(rooms, [1, 2], { adults: 1, children: 2 })).toBe('Cada habitación necesita al menos un adulto: 1 adulto no puede ocupar 2 habitaciones.')
  })
  it('acepta la selección cuando cubre a todos sin romper la ocupación', () => {
    expect(selectionIssue(rooms, [2, 3], four)).toBe('')
    expect(selectionComplete(rooms, [2, 3], four)).toBe(true)
    expect(selectionComplete(rooms, [3], four)).toBe(true)
    expect(selectionComplete(rooms, [1], { adults: 1, children: 0 })).toBe(true)
  })
})

describe('precio y disponibilidad de lo elegido', () => {
  it('se actualiza con cada habitación', () => {
    expect(selectionTotal(rooms, [], 2)).toBe(0)
    expect(selectionTotal(rooms, [2], 2)).toBe(160)
    expect(selectionTotal(rooms, [2, 3], 2)).toBe(560)
    expect(selectionNightly(rooms, [2, 3])).toBe(280)
  })
  it('señala las habitaciones elegidas que dejaron de estar libres', () => {
    expect(lostRooms(rooms, [2])).toEqual([])
    expect(lostRooms(rooms, [4])).toEqual([4])
    expect(lostRooms([suite], [2])).toEqual([2])
  })
})
