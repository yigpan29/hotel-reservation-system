import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RoomGroup from './RoomGroup'
import { chooseType, setRoomGuests, type RoomGroup as Group } from '../selection'
import type { RoomType } from '../types'

const roomType = (name: string, capacity: number, available: number, price: number): RoomType =>
  ({ type: name, capacity, available, pricePerNight: price, totalPrice: price * 2 })
const types = [roomType('Individual', 1, 2, 50), roomType('Doble', 2, 1, 80), roomType('Suite', 4, 3, 200)]
const group = (adults: number, children: number, chosen = ''): Group => ({ adults, children, type: chosen })

/** El componente es controlado: este envoltorio guarda la configuración como lo hace la página. */
function Harness({ initial = [group(2, 0)], index = 0, onRemove = () => {} }: { initial?: Group[]; index?: number; onRemove?: () => void }) {
  const [rooms, setRooms] = useState(initial)
  return <RoomGroup types={types} rooms={rooms} index={index} nights={2} onRemove={onRemove}
    onGuests={guests => setRooms(setRoomGuests(rooms, index, types, guests))}
    onType={type => setRooms(chooseType(rooms, index, type))} />
}
const section = (number = 1) => screen.getByRole('region', { name: 'Habitación ' + number })
const offered = () => screen.getAllByRole('article').map(card => card.getAttribute('aria-label'))
const pick = (type: string, number = 1) => fireEvent.click(screen.getByRole('button', { name: 'Elegir ' + type + ' en la habitación ' + number }))

afterEach(cleanup)

describe('RoomGroup', () => {
  it('ofrece solo los tipos que admiten a los huéspedes de esta habitación', () => {
    render(<Harness initial={[group(2, 0)]} />)
    expect(offered()).toEqual(['Doble para la habitación 1', 'Suite para la habitación 1'])
    cleanup()
    render(<Harness initial={[group(2, 1)]} />)
    expect(offered()).toEqual(['Suite para la habitación 1'])
  })

  it('muestra capacidad, unidades libres y precio de cada tipo', () => {
    render(<Harness />)
    const doble = screen.getByRole('article', { name: 'Doble para la habitación 1' })
    expect(doble.textContent).toContain('Hasta 2 huéspedes')
    expect(doble.textContent).toContain('1 habitación disponible')
    expect(doble.textContent).toContain('Total · 2 noches')
    expect(screen.getByRole('article', { name: 'Suite para la habitación 1' }).textContent).toContain('3 habitaciones disponibles')
  })

  it('elige un tipo y lo suelta al volver a pulsarlo', () => {
    render(<Harness />)
    pick('Doble')
    expect(screen.getByRole('button', { name: 'Quitar Doble en la habitación 1' }).textContent).toBe('Elegida')
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Doble en la habitación 1' }))
    expect(screen.getByRole('button', { name: 'Elegir Doble en la habitación 1' }).textContent).toBe('Elegir')
  })

  it('suelta el tipo elegido cuando deja de admitir a los huéspedes', () => {
    render(<Harness />)
    pick('Doble')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar un niño de la habitación 1' }))
    expect(offered()).toEqual(['Suite para la habitación 1'])
    expect(screen.getByRole('button', { name: 'Elegir Suite en la habitación 1' }).textContent).toBe('Elegir')
  })

  it('no ofrece ningún tipo cuando el grupo no cabe en una sola habitación', () => {
    render(<Harness initial={[group(5, 0)]} />)
    expect(screen.queryAllByRole('article')).toEqual([])
    expect(within(section()).getByText('5 adultos · 5 huéspedes')).toBeTruthy()
  })

  it('solo deja eliminar cuando hay más de una habitación', () => {
    const onRemove = vi.fn()
    render(<Harness initial={[group(2, 0)]} onRemove={onRemove} />)
    expect(screen.queryByRole('button', { name: 'Eliminar la habitación 1' })).toBeNull()
    cleanup()
    render(<Harness initial={[group(2, 0), group(1, 0)]} index={1} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la habitación 2' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('nombra sus contadores con el número de habitación y repite la ayuda solo en la primera', () => {
    render(<Harness initial={[group(2, 0), group(1, 0)]} index={1} />)
    expect(screen.getByRole('group', { name: 'Huéspedes de la habitación 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agregar un adulto de la habitación 2' })).toBeTruthy()
    expect(screen.queryByText('Mínimo 1, máximo 20')).toBeNull()
  })
})
