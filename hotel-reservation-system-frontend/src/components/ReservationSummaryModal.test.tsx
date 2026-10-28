import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReservationSummaryModal from './ReservationSummaryModal'
import type { RoomGroup } from '../selection'
import type { RoomType } from '../types'

const types: RoomType[] = [
  { type: 'Doble', capacity: 2, available: 1, pricePerNight: 80, totalPrice: 160 },
  { type: 'Suite', capacity: 4, available: 2, pricePerNight: 200, totalPrice: 400 },
]
const rooms: RoomGroup[] = [{ adults: 2, children: 0, type: 'Doble' }, { adults: 2, children: 2, type: 'Suite' }]

function open(props: { rooms?: RoomGroup[]; busy?: boolean; error?: string } = {}) {
  const onBack = vi.fn(), onConfirm = vi.fn()
  render(<ReservationSummaryModal hotelName="Hotel Demo 1" types={types} rooms={props.rooms ?? rooms}
    start="2026-11-10" end="2026-11-12" busy={props.busy ?? false} error={props.error ?? ''} onBack={onBack} onConfirm={onConfirm} />)
  return { onBack, onConfirm, dialog: screen.getByRole('dialog', { name: 'Resumen de tu reserva' }) }
}
/** Intl separa la moneda con un espacio duro; se normaliza para comparar los importes mostrados. */
const text = (element: HTMLElement) => (element.textContent ?? '').replace(/\s/g, ' ')

afterEach(() => { cleanup(); document.body.style.overflow = '' })

describe('ReservationSummaryModal', () => {
  it('detalla cada habitación con su tipo, sus huéspedes y su precio', () => {
    const { dialog } = open()
    expect(text(dialog)).toContain('Habitación 1 · Doble')
    expect(text(dialog)).toContain('2 adultos · USD 160.00')
    expect(text(dialog)).toContain('Habitación 2 · Suite')
    expect(text(dialog)).toContain('2 adultos · 2 niños · USD 400.00')
  })

  it('resume habitaciones, huéspedes, fechas y precios', () => {
    const { dialog } = open()
    for (const row of ['Hotel Demo 1', '2 habitaciones', '4 adultos · 2 niños · 6 huéspedes', '2026-11-10', '2026-11-12'])
      expect(text(dialog)).toContain(row)
    expect(text(dialog)).toContain('USD 280.00') // por noche: 80 + 200
    expect(text(dialog)).toContain('USD 560.00') // total de las dos noches
  })

  it('una sola habitación se resume en singular', () => {
    const { dialog } = open({ rooms: [{ adults: 1, children: 0, type: 'Doble' }] })
    expect(text(dialog)).toContain('1 habitación')
    expect(text(dialog)).toContain('1 adulto · 1 huésped')
  })

  it('vuelve y confirma con los botones', () => {
    const { onBack, onConfirm } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(onBack).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('mientras confirma no se puede cerrar ni volver a enviar', () => {
    const { onBack, onConfirm, dialog } = open({ busy: true })
    expect((screen.getByRole('button', { name: 'Confirmando…' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Volver' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onBack).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('muestra el error del backend sin cerrarse', () => {
    const { dialog } = open({ error: 'La habitación 101 ya está reservada en esas fechas' })
    expect(screen.getByRole('alert').textContent).toBe('La habitación 101 ya está reservada en esas fechas')
    expect(dialog).toBeTruthy()
  })

  it('no pide datos personales de los huéspedes', () => {
    const { dialog } = open()
    expect(screen.queryAllByRole('textbox')).toEqual([])
    expect(text(dialog)).toContain('se registran en el check-in')
  })
})
