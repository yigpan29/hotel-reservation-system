import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import GuestSelector from './GuestSelector'
import { defaultGuests, type Guests } from '../guests'

/** El selector es controlado: este envoltorio guarda la cantidad como lo hace la página. */
function Harness({ initial = defaultGuests }: { initial?: Guests }) {
  const [guests, setGuests] = useState(initial)
  return <GuestSelector guests={guests} onChange={setGuests} />
}
const control = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const counters = () => Array.from(screen.getByRole('group', { name: 'Huéspedes' }).querySelectorAll('output')).map(value => value.textContent)

afterEach(cleanup)

describe('GuestSelector', () => {
  it('parte de la cantidad por defecto con un adulto como mínimo', () => {
    render(<Harness />)
    expect(counters()).toEqual(['2', '0'])
    expect(screen.getByText('2 adultos · 2 huéspedes')).toBeTruthy()
  })

  it('suma y resta adultos y niños con los controles (+) y (−)', () => {
    render(<Harness />)
    fireEvent.click(control('Agregar un adulto'))
    fireEvent.click(control('Agregar un niño'))
    fireEvent.click(control('Agregar un niño'))
    expect(counters()).toEqual(['3', '2'])
    expect(screen.getByText('3 adultos · 2 niños · 5 huéspedes')).toBeTruthy()
    fireEvent.click(control('Quitar un adulto'))
    fireEvent.click(control('Quitar un niño'))
    expect(counters()).toEqual(['2', '1'])
  })

  it('no deja quitar el último adulto ni bajar de cero niños', () => {
    render(<Harness initial={{ adults: 1, children: 0 }} />)
    expect(control('Quitar un adulto').disabled).toBe(true)
    expect(control('Quitar un niño').disabled).toBe(true)
    fireEvent.click(control('Quitar un adulto'))
    fireEvent.click(control('Quitar un niño'))
    expect(counters()).toEqual(['1', '0'])
    expect(screen.getByText('1 adulto · 1 huésped')).toBeTruthy()
  })

  it('no deja pasar del máximo admitido', () => {
    render(<Harness initial={{ adults: 20, children: 20 }} />)
    expect(control('Agregar un adulto').disabled).toBe(true)
    expect(control('Agregar un niño').disabled).toBe(true)
    fireEvent.click(control('Agregar un adulto'))
    expect(counters()).toEqual(['20', '20'])
  })

  it('no pide ningún dato personal de los huéspedes', () => {
    render(<Harness />)
    expect(screen.queryAllByRole('textbox')).toEqual([])
    expect(screen.getByText('Hasta 20, sin datos personales')).toBeTruthy()
  })
})
