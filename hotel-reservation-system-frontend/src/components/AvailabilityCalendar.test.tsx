import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AvailabilityCalendar from './AvailabilityCalendar'
import type { OccupiedRange, Room } from '../types'

const room = (id: number): Room => ({ id, hotelId: 1, hotelName: 'Hotel', roomNumber: String(100 + id), type: 'Doble', pricePerNight: 80, capacity: 2, active: true, available: null, totalPrice: null })
const stay = (startDate: string, endDate: string): OccupiedRange => ({ startDate, endDate })

/** Simula GET /rooms/{id}/occupancy con las reservas que se indiquen por habitación. */
function mockOccupancy(byRoom: Record<number, OccupiedRange[]>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const id = Number(String(url).match(/rooms\/(\d+)\/occupancy/)?.[1])
    return { ok: true, status: 200, json: async () => ({ roomId: id, occupied: byRoom[id] ?? [] }) }
  }))
}

/** El calendario es controlado: este envoltorio guarda la selección como lo hace el modal. */
function Harness({ rooms, initial = ['', ''] }: { rooms: Room[]; initial?: [string, string] }) {
  const [range, setRange] = useState<[string, string]>(initial)
  return <AvailabilityCalendar rooms={rooms} start={range[0]} end={range[1]} focus="2026-10-27" onChange={(start, end) => setRange([start, end])} />
}
const day = (text: string) => screen.getByRole('button', { name: new RegExp('^' + text + ' · ') }) as HTMLButtonElement
const ready = () => waitFor(() => expect(screen.queryByText('Cargando disponibilidad…')).toBeNull())

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T12:00:00')) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('AvailabilityCalendar', () => {
  it('bloquea los días mientras carga la disponibilidad y los habilita al terminar', async () => {
    mockOccupancy({})
    render(<Harness rooms={[room(1)]} />)
    expect(screen.getByText('Cargando disponibilidad…')).toBeTruthy()
    expect(day('30 de octubre de 2026').disabled).toBe(true)
    await ready()
    expect(day('30 de octubre de 2026').disabled).toBe(false)
  })

  it('distingue días pasados, ocupados y disponibles', async () => {
    mockOccupancy({ 1: [stay('2026-10-29', '2026-11-01')] })
    render(<Harness rooms={[room(1)]} />)
    await ready()
    const past = day('26 de octubre de 2026'), busy = day('29 de octubre de 2026'), free = day('28 de octubre de 2026')
    expect(past.getAttribute('aria-label')).toMatch(/fecha pasada$/)
    expect(busy.getAttribute('aria-label')).toMatch(/ocupado$/)
    expect(free.getAttribute('aria-label')).toMatch(/disponible$/)
    expect([past.disabled, busy.disabled, free.disabled]).toEqual([true, true, false])
    // La salida de la reserva ajena (1 de noviembre) está libre.
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(day('1 de noviembre de 2026').disabled).toBe(false)
  })

  it('empieza en el mes de hoy y no deja ir a meses pasados', async () => {
    mockOccupancy({})
    render(<Harness rooms={[room(1)]} />)
    await ready()
    expect(screen.getByText(/octubre 2026/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Mes anterior' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('navega entre meses y se detiene a los once meses', async () => {
    mockOccupancy({})
    render(<Harness rooms={[room(1)]} />)
    await ready()
    const next = screen.getByRole('button', { name: 'Mes siguiente' }) as HTMLButtonElement
    fireEvent.click(next)
    expect(screen.getByText(/noviembre 2026/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Mes anterior' }) as HTMLButtonElement).disabled).toBe(false)
    for (let step = 0; step < 10; step++) fireEvent.click(next)
    expect(screen.getByText(/septiembre 2027/)).toBeTruthy()
    expect(next.disabled).toBe(true)
  })

  it('elige entrada y salida y cuenta las noches', async () => {
    mockOccupancy({})
    render(<Harness rooms={[room(1)]} />)
    await ready()
    expect(screen.getByText('Elige tu fecha de entrada en el calendario.')).toBeTruthy()
    fireEvent.click(day('28 de octubre de 2026'))
    expect(screen.getByText(/Entrada 2026-10-28\. Ahora elige la salida/)).toBeTruthy()
    expect(day('28 de octubre de 2026').getAttribute('aria-label')).toMatch(/entrada seleccionada$/)
    fireEvent.click(day('31 de octubre de 2026'))
    expect(screen.getByText('Entrada 2026-10-28 → Salida 2026-10-31 · 3 noches')).toBeTruthy()
    expect(day('31 de octubre de 2026').getAttribute('aria-label')).toMatch(/salida seleccionada$/)
  })

  it('una sola noche se cuenta en singular', async () => {
    mockOccupancy({})
    render(<Harness rooms={[room(1)]} />)
    await ready()
    fireEvent.click(day('28 de octubre de 2026'))
    fireEvent.click(day('29 de octubre de 2026'))
    expect(screen.getByText('Entrada 2026-10-28 → Salida 2026-10-29 · 1 noche')).toBeTruthy()
  })

  it('permite salir justo antes de una reserva ajena y marca ese día como solo salida', async () => {
    mockOccupancy({ 1: [stay('2026-10-30', '2026-11-02')] })
    render(<Harness rooms={[room(1)]} />)
    await ready()
    fireEvent.click(day('28 de octubre de 2026'))
    const checkoutOnly = day('30 de octubre de 2026')
    expect(checkoutOnly.getAttribute('aria-label')).toMatch(/solo salida$/)
    expect(checkoutOnly.disabled).toBe(false)
    expect(day('31 de octubre de 2026').disabled).toBe(true)
    fireEvent.click(checkoutOnly)
    expect(screen.getByText('Entrada 2026-10-28 → Salida 2026-10-30 · 2 noches')).toBeTruthy()
  })

  it('no forma una estadía que cruza noches ocupadas', async () => {
    mockOccupancy({ 1: [stay('2026-10-30', '2026-11-02')] })
    render(<Harness rooms={[room(1)]} />)
    await ready()
    fireEvent.click(day('28 de octubre de 2026'))
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(day('3 de noviembre de 2026').getAttribute('aria-label')).toMatch(/ocupado para esta estadía$/)
    expect(day('3 de noviembre de 2026').disabled).toBe(true)
    expect(screen.getByText(/Entrada 2026-10-28\. Ahora elige la salida/)).toBeTruthy()
  })

  it('exige una misma habitación para toda la estadía aunque cada noche tenga alguna libre', async () => {
    mockOccupancy({ 1: [stay('2026-10-30', '2026-10-31')], 2: [stay('2026-10-31', '2026-11-01')] })
    render(<Harness rooms={[room(1), room(2)]} />)
    await ready()
    // Cada noche suelta tiene una habitación libre, así que ninguna aparece como ocupada.
    expect(day('30 de octubre de 2026').getAttribute('aria-label')).toMatch(/disponible$/)
    expect(day('31 de octubre de 2026').getAttribute('aria-label')).toMatch(/disponible$/)
    fireEvent.click(day('30 de octubre de 2026'))
    expect(day('31 de octubre de 2026').disabled).toBe(false)
    // Pero ninguna habitación cubre las noches del 30 y del 31 a la vez.
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(day('1 de noviembre de 2026').getAttribute('aria-label')).toMatch(/ocupado para esta estadía$/)
    expect(day('1 de noviembre de 2026').disabled).toBe(true)
  })

  it('un día anterior a la entrada reinicia la selección', async () => {
    mockOccupancy({})
    render(<Harness rooms={[room(1)]} />)
    await ready()
    fireEvent.click(day('30 de octubre de 2026'))
    fireEvent.click(day('28 de octubre de 2026'))
    expect(screen.getByText(/Entrada 2026-10-28\. Ahora elige la salida/)).toBeTruthy()
  })

  it('con un rango completo, un nuevo clic empieza otra selección', async () => {
    mockOccupancy({})
    render(<Harness rooms={[room(1)]} initial={['2026-10-28', '2026-10-30']} />)
    await ready()
    expect(screen.getByText('Entrada 2026-10-28 → Salida 2026-10-30 · 2 noches')).toBeTruthy()
    fireEvent.click(day('31 de octubre de 2026'))
    expect(screen.getByText(/Entrada 2026-10-31\. Ahora elige la salida/)).toBeTruthy()
  })

  it('consulta la ocupación de cada habitación del tipo', async () => {
    mockOccupancy({})
    render(<Harness rooms={[room(1), room(2), room(3)]} />)
    await ready()
    const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(call => String(call[0]))
    expect(urls.sort()).toEqual(['/api/rooms/1/occupancy', '/api/rooms/2/occupancy', '/api/rooms/3/occupancy'])
  })

  it('si la consulta falla muestra el error y no deja elegir nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ message: 'Servidor caído' }) })))
    render(<Harness rooms={[room(1)]} />)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/Servidor caído/)).toBeTruthy()
    expect(day('30 de octubre de 2026').disabled).toBe(true)
    fireEvent.click(day('30 de octubre de 2026'))
    expect(screen.getByText('Elige tu fecha de entrada en el calendario.')).toBeTruthy()
  })
})
