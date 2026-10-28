import { describe, expect, it } from 'vitest'
import { canChange, changeGuests, defaultGuests, guestLabel, guestsLabel, maxAdults, maxChildren, minimumRooms, readAdults, readChildren, roomsLabel, totalGuests } from './guests'

describe('contadores de huéspedes', () => {
  it('toda reserva conserva al menos un adulto', () => {
    expect(changeGuests({ adults: 1, children: 0 }, 'adults', -1)).toEqual({ adults: 1, children: 0 })
    expect(canChange({ adults: 1, children: 0 }, 'adults', -1)).toBe(false)
    expect(canChange({ adults: 2, children: 0 }, 'adults', -1)).toBe(true)
  })
  it('nunca produce cantidades negativas de niños', () => {
    expect(changeGuests({ adults: 2, children: 0 }, 'children', -1).children).toBe(0)
    expect(changeGuests({ adults: 2, children: 1 }, 'children', -1).children).toBe(0)
    expect(canChange({ adults: 2, children: 0 }, 'children', -1)).toBe(false)
  })
  it('respeta el máximo de cada cantidad', () => {
    expect(changeGuests({ adults: maxAdults, children: 0 }, 'adults', 1).adults).toBe(maxAdults)
    expect(changeGuests({ adults: 2, children: maxChildren }, 'children', 1).children).toBe(maxChildren)
    expect(canChange({ adults: maxAdults, children: maxChildren }, 'children', 1)).toBe(false)
  })
  it('cada control cambia solo su propia cantidad', () => {
    expect(changeGuests({ adults: 2, children: 1 }, 'adults', 1)).toEqual({ adults: 3, children: 1 })
    expect(changeGuests({ adults: 2, children: 1 }, 'children', 1)).toEqual({ adults: 2, children: 2 })
    expect(totalGuests({ adults: 2, children: 2 })).toBe(4)
  })
})

describe('huéspedes leídos de texto', () => {
  it('sin valor usa la cantidad por defecto', () => {
    expect(readAdults(null)).toBe(defaultGuests.adults)
    expect(readChildren(null)).toBe(defaultGuests.children)
  })
  it('conserva lo elegido', () => {
    expect(readAdults('3')).toBe(3)
    expect(readChildren('2')).toBe(2)
  })
  it('corrige valores imposibles en lugar de confiar en el texto', () => {
    expect([readAdults('0'), readChildren('-4')]).toEqual([1, 0])
    expect([readAdults('99'), readChildren('99')]).toEqual([maxAdults, maxChildren])
    expect([readAdults('dos'), readChildren('x')]).toEqual([1, 0])
    expect([readAdults('2.7'), readChildren('1.9')]).toEqual([2, 1])
  })
})

describe('mínimo de habitaciones', () => {
  it('reparte los huéspedes entre habitaciones de la capacidad indicada', () => {
    expect(minimumRooms(4, 2)).toBe(2)
    expect(minimumRooms(5, 2)).toBe(3)
    expect(minimumRooms(4, 4)).toBe(1)
    expect(minimumRooms(1, 4)).toBe(1)
  })
  it('no divide por una capacidad inservible', () => expect(minimumRooms(4, 0)).toBe(0))
})

describe('textos de huéspedes y habitaciones', () => {
  it('distingue singular y plural', () => {
    expect(guestLabel({ adults: 1, children: 0 })).toBe('1 adulto')
    expect(guestLabel({ adults: 2, children: 1 })).toBe('2 adultos · 1 niño')
    expect(guestLabel({ adults: 2, children: 3 })).toBe('2 adultos · 3 niños')
    expect(roomsLabel(1)).toBe('1 habitación')
    expect(roomsLabel(2)).toBe('2 habitaciones')
    expect(guestsLabel(1)).toBe('1 huésped')
    expect(guestsLabel(4)).toBe('4 huéspedes')
  })
})
