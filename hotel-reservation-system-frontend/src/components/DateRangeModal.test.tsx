import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DateRangeModal from './DateRangeModal'
import type { Room } from '../types'

const rooms: Room[] = [{ id: 1, hotelId: 1, hotelName: 'Hotel', roomNumber: '101', type: 'Doble', pricePerNight: 80, capacity: 2, active: true, available: null, totalPrice: null }]

function open(props: { initialStart?: string; initialEnd?: string } = {}) {
  const onConfirm = vi.fn(), onCancel = vi.fn()
  render(<DateRangeModal subtitle="Disponibilidad de Hotel" rooms={rooms} initialStart={props.initialStart ?? ''} initialEnd={props.initialEnd ?? ''} focus="2026-10-28" onConfirm={onConfirm} onCancel={onCancel} />)
  return { onConfirm, onCancel }
}
const day = (text: string) => screen.getByRole('button', { name: new RegExp('^' + text + ' · ') }) as HTMLButtonElement
const confirmButton = () => screen.getByRole('button', { name: 'Confirmar fechas' }) as HTMLButtonElement
const ready = () => waitFor(() => expect(screen.queryByText('Cargando disponibilidad…')).toBeNull())

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T12:00:00'))
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ roomId: 1, occupied: [{ startDate: '2026-10-30', endDate: '2026-11-02' }] }) })))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.style.overflow = '' })

describe('DateRangeModal', () => {
  it('es un diálogo modal con título y el foco dentro', async () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Seleccionar fechas' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(dialog)
    await ready()
  })

  it('no permite confirmar hasta tener entrada y salida', async () => {
    open()
    await ready()
    expect(confirmButton().disabled).toBe(true)
    fireEvent.click(day('28 de octubre de 2026'))
    expect(confirmButton().disabled).toBe(true)
    fireEvent.click(day('29 de octubre de 2026'))
    expect(confirmButton().disabled).toBe(false)
  })

  it('al confirmar entrega las fechas elegidas', async () => {
    const { onConfirm, onCancel } = open()
    await ready()
    fireEvent.click(day('28 de octubre de 2026'))
    fireEvent.click(day('30 de octubre de 2026'))
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('2026-10-28', '2026-10-30')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancelar no entrega fechas aunque haya una selección', async () => {
    const { onConfirm, onCancel } = open()
    await ready()
    fireEvent.click(day('28 de octubre de 2026'))
    fireEvent.click(day('29 de octubre de 2026'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Escape y un clic fuera del cuadro cancelan', async () => {
    const { onConfirm, onCancel } = open()
    await ready()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('un clic dentro del cuadro no lo cierra', async () => {
    const { onCancel } = open()
    await ready()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('parte de la estadía ya elegida para poder modificarla sin perderla', async () => {
    open({ initialStart: '2026-11-05', initialEnd: '2026-11-08' })
    await ready()
    expect(screen.getByText('Entrada 2026-11-05 → Salida 2026-11-08 · 3 noches')).toBeTruthy()
    expect(confirmButton().disabled).toBe(false)
  })

  it('no deja elegir días ocupados dentro del modal', async () => {
    open()
    await ready()
    expect(day('30 de octubre de 2026').disabled).toBe(true)
    expect(day('31 de octubre de 2026').disabled).toBe(true)
  })

  it('bloquea el scroll de la página mientras está abierto y lo restaura al cerrar', async () => {
    document.body.style.overflow = 'auto'
    open()
    expect(document.body.style.overflow).toBe('hidden')
    await ready()
    cleanup()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('el tabulador se queda dentro del modal', async () => {
    open()
    await ready()
    const dialog = screen.getByRole('dialog')
    const enabled = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), select, a[href]'))
    enabled[enabled.length - 1].focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(enabled[0])
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(enabled[enabled.length - 1])
  })
})
