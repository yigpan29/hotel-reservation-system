import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoomDetails from './RoomDetails'
import { AuthContext, type Session } from '../auth-context'
import type { Allocation, Room } from '../types'

const start = '2026-11-10', end = '2026-11-12'
const room = (id: number, type: string, price: number, capacity: number, available = true): Room =>
  ({ id, hotelId: 1, hotelName: 'Hotel Demo 1', roomNumber: String(100 + id), type, pricePerNight: price, capacity, active: true, available, totalPrice: price * 2 })
const doble = room(1, 'Doble', 80, 2), suite = room(2, 'Suite', 200, 4)
const blocked = 'No hay habitaciones suficientes para alojar a 9 huéspedes. Se requieren al menos 3 habitaciones, pero solo hay 2 disponibles para las fechas seleccionadas.'

/** El cálculo es del backend: estas son sus respuestas para cada combinación de huéspedes. */
const freshPlans = (): Record<string, Partial<Allocation>> => ({
  '2-0': { feasible: true, minimumRooms: 1, rooms: [doble, suite] },
  '2-2': { feasible: true, minimumRooms: 1, rooms: [doble, suite] },
  '1-1': { feasible: true, minimumRooms: 1, rooms: [doble, suite] },
  '9-0': { feasible: false, minimumRooms: 3, rooms: [doble, suite], message: blocked },
})
let plans = freshPlans(), calls: string[] = [], posted: unknown[] = []
const allocationCalls = () => calls.filter(path => path.startsWith('/api/rooms/allocation'))

function mockBackend() {
  plans = freshPlans(); calls = []; posted = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    const path = String(url); calls.push(path)
    const body = (value: unknown, status = 200) => ({ ok: true, status, json: async () => value })
    if (path.startsWith('/api/hotels/1/rooms')) return body([doble, suite])
    if (path.startsWith('/api/hotels/1')) return body({ id: 1, name: 'Hotel Demo 1', location: 'Panamá', description: 'Inventario sintético', rating: null, active: true })
    if (path.startsWith('/api/auth/csrf')) return body({ token: 'synthetic', headerName: 'X-CSRF-TOKEN' })
    if (path.startsWith('/api/rooms/allocation')) {
      const query = new URLSearchParams(path.slice(path.indexOf('?')))
      const adults = Number(query.get('adults')), children = Number(query.get('children'))
      const plan = plans[adults + '-' + children] ?? plans['9-0']
      return body({ hotelId: 1, startDate: start, endDate: end, nights: 2, adults, children, guests: adults + children,
        maxRoomCapacity: 4, availableRooms: 2, availableCapacity: 6, message: '', ...plan })
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
  return screen.findByRole('article', { name: 'Habitación 101' })
}
const card = (number: string) => screen.getByRole('article', { name: 'Habitación ' + number })
const pick = (number: string) => fireEvent.click(screen.getByRole('button', { name: 'Seleccionar la habitación ' + number }))
const drop = (number: string) => fireEvent.click(screen.getByRole('button', { name: 'Quitar la habitación ' + number }))
const guestControl = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const continueButton = () => screen.getByRole('button', { name: 'Continuar al resumen' }) as HTMLButtonElement
const recalculated = (query: string) => waitFor(() => expect(allocationCalls().some(path => path.includes(query))).toBe(true))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T12:00:00'))
  Element.prototype.scrollIntoView = vi.fn() // jsdom no lo implementa; la página lo usa al confirmar.
  mockBackend()
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('RoomDetails · selección de habitaciones', () => {
  it('muestra cada habitación con su capacidad y precio, sin elegir ninguna por el cliente', async () => {
    await open()
    expect(allocationCalls()[0]).toBe('/api/rooms/allocation?hotelId=1&startDate=' + start + '&endDate=' + end + '&adults=2&children=0')
    expect(card('101').textContent).toContain('hasta 2 huéspedes')
    expect(card('102').textContent).toContain('hasta 4 huéspedes')
    expect(screen.getByText(/hacen falta al menos 1 habitación/)).toBeTruthy()
    expect(screen.getByText('Elige al menos una habitación para continuar.')).toBeTruthy()
    expect(screen.getByText('Todavía no has elegido habitaciones.')).toBeTruthy()
    expect(continueButton().disabled).toBe(true)
  })

  it('suma la capacidad y el precio de lo elegido y habilita continuar al cubrir a todos', async () => {
    await open()
    fireEvent.click(guestControl('Agregar un niño'))
    fireEvent.click(guestControl('Agregar un niño'))
    await recalculated('adults=2&children=2')
    pick('101')
    expect(within(card('101')).getByText('Seleccionada · aporta 2 huéspedes')).toBeTruthy()
    expect(screen.getByText('Faltan por cubrir 2 huéspedes.')).toBeTruthy()
    expect(screen.getByText('Has elegido 1 habitación · capacidad 2 huéspedes · total USD 160.00')).toBeTruthy()
    expect(continueButton().disabled).toBe(true)
    pick('102')
    expect(screen.getByText('Las habitaciones elegidas alojan a 4 huéspedes.')).toBeTruthy()
    expect(screen.getByText('Has elegido 2 habitaciones · capacidad 6 huéspedes · total USD 560.00')).toBeTruthy()
    expect(continueButton().disabled).toBe(false)
  })

  it('permite quitar una habitación y vuelve a exigir cubrir a los huéspedes', async () => {
    await open()
    pick('102')
    expect(continueButton().disabled).toBe(false)
    drop('102')
    expect(screen.getByText('Elige al menos una habitación para continuar.')).toBeTruthy()
    expect(continueButton().disabled).toBe(true)
  })

  it('no deja elegir más habitaciones que adultos', async () => {
    await open()
    fireEvent.click(guestControl('Quitar un adulto'))
    fireEvent.click(guestControl('Agregar un niño'))
    await recalculated('adults=1&children=1')
    pick('101')
    pick('102')
    expect(screen.getByText('Cada habitación necesita al menos un adulto: 1 adulto no puede ocupar 2 habitaciones.')).toBeTruthy()
    expect(continueButton().disabled).toBe(true)
    drop('101')
    expect(continueButton().disabled).toBe(false)
  })

  it('no permite elegir una habitación ocupada', async () => {
    plans['2-0'] = { feasible: true, minimumRooms: 1, rooms: [{ ...doble, available: false }, suite] }
    await open()
    expect(within(card('101')).getByText('Ocupada en esas fechas')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Seleccionar la habitación 101' })).toBeNull()
    pick('102')
    expect(continueButton().disabled).toBe(false)
  })

  it('bloquea con un mensaje claro cuando la disponibilidad no alcanza', async () => {
    await open()
    for (let step = 0; step < 7; step++) fireEvent.click(guestControl('Agregar un adulto'))
    expect(await screen.findByText(blocked)).toBeTruthy()
    expect(continueButton().disabled).toBe(true)
  })

  it('confirma enviando las habitaciones elegidas y vuelve a validar antes de guardar', async () => {
    await open()
    pick('101')
    fireEvent.click(continueButton())
    const summary = screen.getByRole('dialog', { name: 'Resumen de tu reserva' })
    expect(summary.textContent).toContain('Doble 101')
    expect(summary.textContent).toContain('2 adultos · 2 huéspedes')
    const before = allocationCalls().length
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({ roomIds: [1], startDate: start, endDate: end, adults: 2, children: 0 })
    expect(allocationCalls().length).toBe(before + 1)
    expect(await screen.findByText('#7, #8')).toBeTruthy()
  })

  it('no reserva si una habitación elegida acaba de ocuparse', async () => {
    await open()
    pick('101')
    fireEvent.click(continueButton())
    plans['2-0'] = { feasible: true, minimumRooms: 1, rooms: [{ ...doble, available: false }, suite] }
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Resumen de tu reserva' }).textContent).toContain('acaba de ocuparse'))
    expect(posted).toEqual([])
  })
})
