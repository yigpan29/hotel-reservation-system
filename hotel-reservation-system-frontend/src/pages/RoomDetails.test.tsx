import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoomDetails from './RoomDetails'
import { AuthContext, type Session } from '../auth-context'
import type { Allocation, Room, RoomType } from '../types'

const start = '2026-11-10', end = '2026-11-12'
const roomType = (name: string, capacity: number, available: number, price: number): RoomType =>
  ({ type: name, capacity, available, pricePerNight: price, totalPrice: price * 2 })
const doble = roomType('Doble', 2, 1, 80), suite = roomType('Suite', 4, 2, 200)
const room: Room = { id: 1, hotelId: 1, hotelName: 'Hotel Demo 1', roomNumber: '101', type: 'Doble', pricePerNight: 80, capacity: 2, active: true, available: true, totalPrice: 160 }
const blocked = 'No hay habitaciones suficientes para alojar a 9 huéspedes. Se requieren al menos 3 habitaciones, pero solo hay 2 disponibles para las fechas seleccionadas.'

/** El cálculo es del backend: estas son sus respuestas para cada total de huéspedes. */
const freshPlans = (): Record<string, Partial<Allocation>> => ({
  '2-0': { feasible: true, minimumRooms: 1, availableRooms: 3, types: [doble, suite] },
  '3-0': { feasible: true, minimumRooms: 1, availableRooms: 3, types: [doble, suite] },
  '4-0': { feasible: true, minimumRooms: 1, availableRooms: 3, types: [doble, suite] },
  '2-1': { feasible: true, minimumRooms: 1, availableRooms: 3, types: [doble, suite] },
  '4-2': { feasible: true, minimumRooms: 2, availableRooms: 3, types: [doble, suite] },
  '9-0': { feasible: false, minimumRooms: 3, availableRooms: 3, types: [doble, suite], message: blocked },
})
let plans = freshPlans(), calls: string[] = [], posted: unknown[] = []
const allocationCalls = () => calls.filter(path => path.startsWith('/api/rooms/allocation'))

function mockBackend() {
  plans = freshPlans(); calls = []; posted = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    const path = String(url); calls.push(path)
    const body = (value: unknown, status = 200) => ({ ok: true, status, json: async () => value })
    if (path.startsWith('/api/hotels/1/rooms')) return body([room])
    if (path.startsWith('/api/hotels/1')) return body({ id: 1, name: 'Hotel Demo 1', location: 'Panamá', description: 'Inventario sintético', rating: null, active: true })
    if (path.startsWith('/api/auth/csrf')) return body({ token: 'synthetic', headerName: 'X-CSRF-TOKEN' })
    if (path.startsWith('/api/rooms/allocation')) {
      const query = new URLSearchParams(path.slice(path.indexOf('?')))
      const adults = Number(query.get('adults')), children = Number(query.get('children'))
      const plan = plans[adults + '-' + children] ?? plans['9-0']
      return body({ hotelId: 1, startDate: start, endDate: end, nights: 2, adults, children, guests: adults + children,
        maxRoomCapacity: 4, availableCapacity: 10, availableRooms: 3, message: '', ...plan })
    }
    if (path.startsWith('/api/reservations/group')) { posted.push(JSON.parse(String(options?.body))); return body([{ id: 7 }, { id: 8 }], 201) }
    throw new Error('URL no simulada: ' + path)
  }))
}
const session: Session = { user: { id: 1, username: 'owner', email: 'owner@example.invalid', role: 'USER' }, loading: false, error: '', login: async () => {}, logout: async () => {} }
/** Abre la página con fechas ya elegidas y espera al primer cálculo del backend. */
function open(query = '?id=1&startDate=' + start + '&endDate=' + end) {
  render(<AuthContext.Provider value={session}><MemoryRouter initialEntries={['/productDetail' + query]}>
    <Routes><Route path="/productDetail" element={<RoomDetails />} /></Routes>
  </MemoryRouter></AuthContext.Provider>)
  return screen.findByRole('region', { name: 'Habitación 1' })
}
const roomSection = (number: number) => screen.getByRole('region', { name: 'Habitación ' + number })
const choose = (type: string, number: number) => fireEvent.click(screen.getByRole('button', { name: 'Elegir ' + type + ' en la habitación ' + number }))
const guestControl = (name: string, number: number) => screen.getByRole('button', { name: name + ' de la habitación ' + number }) as HTMLButtonElement
const continueButton = () => screen.getByRole('button', { name: 'Continuar al resumen' }) as HTMLButtonElement
/** Intl separa la moneda con un espacio duro; se normaliza para comparar el total mostrado. */
const total = () => (screen.getByText('Precio total:').parentElement?.textContent ?? '').replace(/\s/g, ' ')
const recalculated = (query: string) => waitFor(() => expect(allocationCalls().some(path => path.includes(query))).toBe(true))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T12:00:00'))
  Element.prototype.scrollIntoView = vi.fn() // jsdom no lo implementa; la página lo usa al confirmar.
  mockBackend()
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('RoomDetails · habitaciones y huéspedes', () => {
  it('empieza con una habitación de dos adultos y pide elegir su tipo', async () => {
    await open()
    expect(allocationCalls()[0]).toBe('/api/rooms/allocation?hotelId=1&startDate=' + start + '&endDate=' + end + '&adults=2&children=0')
    expect(within(roomSection(1)).getByText('2 adultos · 2 huéspedes')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Habitación 2' })).toBeNull()
    expect(screen.getByText('Habitación 1: Elige un tipo de habitación.')).toBeTruthy()
    expect(continueButton().disabled).toBe(true)
  })

  it('solo ofrece los tipos que admiten a los huéspedes de cada habitación', async () => {
    await open()
    expect(within(roomSection(1)).getByRole('article', { name: 'Doble para la habitación 1' })).toBeTruthy()
    fireEvent.click(guestControl('Agregar un niño', 1))
    await recalculated('adults=2&children=1')
    expect(within(roomSection(1)).queryByRole('article', { name: 'Doble para la habitación 1' })).toBeNull()
    expect(within(roomSection(1)).getByRole('article', { name: 'Suite para la habitación 1' })).toBeTruthy()
  })

  it('habilita continuar al elegir un tipo válido y actualiza el precio', async () => {
    await open()
    choose('Doble', 1)
    expect(screen.getByText('Todo listo: 1 habitación para 2 huéspedes.')).toBeTruthy()
    expect(total()).toContain('USD 160.00')
    expect(continueButton().disabled).toBe(false)
  })

  it('suelta el tipo elegido si deja de admitir a los huéspedes de esa habitación', async () => {
    await open()
    choose('Doble', 1)
    fireEvent.click(guestControl('Agregar un niño', 1))
    await recalculated('adults=2&children=1')
    expect(screen.getByText('Habitación 1: Elige un tipo de habitación.')).toBeTruthy()
    expect(continueButton().disabled).toBe(true)
  })

  it('agrega una segunda habitación con sus propios huéspedes y tipo', async () => {
    await open()
    choose('Doble', 1)
    fireEvent.click(screen.getByRole('button', { name: 'Agregar habitación' }))
    await recalculated('adults=4&children=0')
    expect(screen.getByText('Habitación 2: Elige un tipo de habitación.')).toBeTruthy()
    fireEvent.click(guestControl('Agregar un niño', 2))
    fireEvent.click(guestControl('Agregar un niño', 2))
    await recalculated('adults=4&children=2')
    choose('Suite', 2)
    expect(screen.getByText('Todo listo: 2 habitaciones para 6 huéspedes.')).toBeTruthy()
    expect(total()).toContain('USD 560.00')
    expect(continueButton().disabled).toBe(false)
  })

  it('exige unidades suficientes cuando dos habitaciones piden el mismo tipo', async () => {
    await open()
    choose('Doble', 1)
    fireEvent.click(screen.getByRole('button', { name: 'Agregar habitación' }))
    await recalculated('adults=4&children=0')
    choose('Doble', 2)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Habitación 1: Solo 1 de tipo Doble queda libre en esas fechas.')
    expect(alert.textContent).toContain('Elige otro tipo de habitación o elimina una de las habitaciones solicitadas.')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(continueButton().disabled).toBe(true)
    choose('Suite', 2)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(continueButton().disabled).toBe(false)
  })

  it('permite eliminar una habitación', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar habitación' }))
    await recalculated('adults=4&children=0')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la habitación 2' }))
    await recalculated('adults=2&children=0')
    expect(screen.queryByRole('region', { name: 'Habitación 2' })).toBeNull()
  })

  it('bloquea con un mensaje claro cuando la disponibilidad no alcanza', async () => {
    await open()
    for (let step = 0; step < 7; step++) fireEvent.click(guestControl('Agregar un adulto', 1))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(blocked)
    expect(alert.textContent).toContain('Agrega otra habitación o reduce la cantidad de huéspedes para continuar.')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(continueButton().disabled).toBe(true)
    for (let step = 0; step < 5; step++) fireEvent.click(guestControl('Quitar un adulto', 1))
    await recalculated('adults=4&children=0')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(continueButton().disabled).toBe(true)
    choose('Suite', 1)
    expect(continueButton().disabled).toBe(false)
  })

  it('sugiere cambiar de fechas cuando el hotel no tiene nada libre', async () => {
    plans['2-0'] = { feasible: false, minimumRooms: 1, availableRooms: 0, types: [], message: 'No hay habitaciones disponibles para las fechas seleccionadas.' }
    await open()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('No hay habitaciones disponibles para las fechas seleccionadas.')
    expect(alert.textContent).toContain('Prueba con otras fechas para encontrar habitaciones libres.')
    expect(continueButton().disabled).toBe(true)
  })

  it('sugiere eliminar una habitación cuando se piden más de las que quedan', async () => {
    plans['4-0'] = { feasible: true, minimumRooms: 1, availableRooms: 1, types: [doble] }
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar habitación' }))
    await recalculated('adults=4&children=0')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Pediste 2 habitaciones y solo queda 1 disponible para las fechas seleccionadas.')
    expect(alert.textContent).toContain('Elimina una habitación o prueba con otras fechas.')
    expect(continueButton().disabled).toBe(true)
  })

  it('confirma enviando cada habitación con su tipo y sus huéspedes', async () => {
    await open()
    choose('Doble', 1)
    fireEvent.click(continueButton())
    const summary = screen.getByRole('dialog', { name: 'Resumen de tu reserva' })
    expect(summary.textContent).toContain('Habitación 1 · Doble')
    expect(summary.textContent).toContain('2 adultos · 2 huéspedes')
    const before = allocationCalls().length
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({ hotelId: 1, rooms: [{ type: 'Doble', adults: 2, children: 0 }], startDate: start, endDate: end })
    expect(allocationCalls().length).toBe(before + 1)
    expect(await screen.findByText('#7, #8')).toBeTruthy()
  })

  it('no reserva si el tipo elegido acaba de agotarse', async () => {
    await open()
    choose('Doble', 1)
    fireEvent.click(continueButton())
    plans['2-0'] = { feasible: true, minimumRooms: 1, availableRooms: 2, types: [suite] }
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Resumen de tu reserva' }).textContent).toContain('ya no admite'))
    expect(posted).toEqual([])
  })
})
