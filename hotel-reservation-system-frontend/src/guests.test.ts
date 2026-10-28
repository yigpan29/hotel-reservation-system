import { describe, expect, it } from 'vitest'
import { canChange, changeGuests, defaultGuests, guestLabel, guestsLabel, maxAdults, maxChildren, minimumRooms, readGuests, roomsLabel, totalGuests } from './guests'

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

describe('huéspedes en la URL', () => {
  it('sin parámetros usa la cantidad por defecto', () => expect(readGuests(new URLSearchParams(''))).toEqual(defaultGuests))
  it('conserva lo elegido al recargar', () => expect(readGuests(new URLSearchParams('adults=3&children=2'))).toEqual({ adults: 3, children: 2 }))
  it('corrige valores imposibles en lugar de confiar en la URL', () => {
    expect(readGuests(new URLSearchParams('adults=0&children=-4'))).toEqual({ adults: 1, children: 0 })
    expect(readGuests(new URLSearchParams('adults=99&children=99'))).toEqual({ adults: maxAdults, children: maxChildren })
    expect(readGuests(new URLSearchParams('adults=dos&children=x'))).toEqual({ adults: 1, children: 0 })
    expect(readGuests(new URLSearchParams('adults=2.7&children=1.9'))).toEqual({ adults: 2, children: 1 })
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
