import { describe, expect, it } from 'vitest'
import { addDays, anyRoomFree, dayInfo, maxNightsPerRange, monthGrid, monthsFromNow, occupiedNights, pickDay, roomFree, shiftMonth, type CalendarContext } from './availability'
import type { OccupiedRange, RoomOccupancy } from './types'

const room = (id: number, occupied: OccupiedRange[]): RoomOccupancy => ({ roomId: id, hotelId: 1, hotelName: 'H', roomNumber: String(id), type: 'Doble', pricePerNight: 80, active: true, from: '2026-10-27', to: '2027-10-27', occupied })
const stay = (startDate: string, endDate: string): OccupiedRange => ({ startDate, endDate })
const context = (rooms: RoomOccupancy[], extra: Partial<CalendarContext> = {}): CalendarContext => ({ today: '2026-10-27', start: '', end: '', rooms: occupiedNights(rooms), loaded: true, ...extra })

describe('fechas', () => {
  it('suma días cruzando mes, año y año bisiesto', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
  })
})

describe('noches ocupadas', () => {
  it('cuenta la entrada y deja libre la noche de salida', () => {
    const [taken] = occupiedNights([room(1, [stay('2026-11-10', '2026-11-13')])])
    expect([...taken].sort()).toEqual(['2026-11-10', '2026-11-11', '2026-11-12'])
    expect(taken.has('2026-11-13')).toBe(false)
  })
  it('acepta estancias consecutivas en la misma habitación', () => {
    const [taken] = occupiedNights([room(1, [stay('2026-11-10', '2026-11-13')])])
    expect(roomFree(taken, '2026-11-13', '2026-11-15')).toBe(true)
    expect(roomFree(taken, '2026-11-08', '2026-11-10')).toBe(true)
  })
  it('detecta cualquier solapamiento, también en los bordes', () => {
    const [taken] = occupiedNights([room(1, [stay('2026-11-10', '2026-11-13')])])
    expect(roomFree(taken, '2026-11-09', '2026-11-11')).toBe(false)
    expect(roomFree(taken, '2026-11-12', '2026-11-14')).toBe(false)
    expect(roomFree(taken, '2026-11-11', '2026-11-12')).toBe(false)
    expect(roomFree(taken, '2026-11-08', '2026-11-20')).toBe(false)
  })
  it('sin reservas todo está libre y una habitación vacía no cuenta como disponible', () => {
    expect(anyRoomFree(occupiedNights([room(1, [])]), '2026-11-01', '2026-11-30')).toBe(true)
    expect(anyRoomFree([], '2026-11-01', '2026-11-02')).toBe(false)
  })
  it('acota un rango corrupto para no quedarse calculando sin fin', () => {
    const [taken] = occupiedNights([room(1, [stay('2026-01-01', '2036-01-01')])])
    expect(taken.size).toBe(maxNightsPerRange)
  })
  it('une varias reservas de una misma habitación', () => {
    const [taken] = occupiedNights([room(1, [stay('2026-11-01', '2026-11-03'), stay('2026-11-10', '2026-11-11')])])
    expect([...taken].sort()).toEqual(['2026-11-01', '2026-11-02', '2026-11-10'])
  })
})

describe('una misma habitación durante toda la estadía', () => {
  // Habitación 1 ocupada la noche del 20; habitación 2, la del 21: cada noche tiene alguna libre,
  // pero ninguna cubre las dos.
  const rooms = [room(1, [stay('2026-11-20', '2026-11-21')]), room(2, [stay('2026-11-21', '2026-11-22')])]
  const nights = occupiedNights(rooms)
  it('cada noche suelta se puede ofrecer', () => {
    expect(anyRoomFree(nights, '2026-11-20', '2026-11-21')).toBe(true)
    expect(anyRoomFree(nights, '2026-11-21', '2026-11-22')).toBe(true)
  })
  it('la estadía de ambas noches no se puede ofrecer', () => {
    expect(anyRoomFree(nights, '2026-11-20', '2026-11-22')).toBe(false)
  })
  it('una estadía que una habitación sí cubre se ofrece', () => {
    expect(anyRoomFree(nights, '2026-11-22', '2026-11-25')).toBe(true)
    expect(anyRoomFree(nights, '2026-11-19', '2026-11-20')).toBe(true)
  })
  it('el calendario marca la salida inalcanzable y la deshabilita', () => {
    const ctx = context(rooms, { start: '2026-11-20' })
    expect(dayInfo('2026-11-21', ctx)).toMatchObject({ busy: false, reachable: true, unreachable: false, disabled: false })
    expect(dayInfo('2026-11-22', ctx)).toMatchObject({ busy: false, reachable: false, unreachable: true, disabled: true })
    expect(dayInfo('2026-11-23', ctx)).toMatchObject({ unreachable: true, disabled: true })
  })
  it('un tipo con una sola habitación ocupada la noche 20 la muestra ocupada', () => {
    const single = [room(1, [stay('2026-11-20', '2026-11-21')])]
    expect(dayInfo('2026-11-20', context(single))).toMatchObject({ busy: true, disabled: true })
  })
})

describe('estado de cada día', () => {
  const rooms = [room(1, [stay('2026-11-10', '2026-11-13')])]
  it('los días pasados están deshabilitados y hoy no', () => {
    expect(dayInfo('2026-10-26', context(rooms))).toMatchObject({ past: true, disabled: true })
    expect(dayInfo('2026-10-27', context(rooms))).toMatchObject({ past: false, disabled: false })
  })
  it('los días ocupados están deshabilitados', () => {
    expect(dayInfo('2026-11-10', context(rooms))).toMatchObject({ busy: true, disabled: true })
    expect(dayInfo('2026-11-12', context(rooms))).toMatchObject({ busy: true, disabled: true })
  })
  it('el día de salida de una reserva ajena sigue libre', () => {
    expect(dayInfo('2026-11-13', context(rooms))).toMatchObject({ busy: false, disabled: false })
  })
  it('con la entrada elegida, una noche ocupada se admite solo como salida', () => {
    const ctx = context(rooms, { start: '2026-11-08' })
    expect(dayInfo('2026-11-10', ctx)).toMatchObject({ busy: true, reachable: true, disabled: false })
    expect(dayInfo('2026-11-11', ctx)).toMatchObject({ busy: true, reachable: false, disabled: true })
  })
  it('marca entrada, salida y los días intermedios', () => {
    const ctx = context(rooms, { start: '2026-11-01', end: '2026-11-04' })
    expect(dayInfo('2026-11-01', ctx).selected).toBe(true)
    expect(dayInfo('2026-11-04', ctx).selected).toBe(true)
    expect(dayInfo('2026-11-02', ctx)).toMatchObject({ inside: true, selected: false })
    expect(dayInfo('2026-11-05', ctx)).toMatchObject({ inside: false, selected: false })
  })
  it('mientras carga todo está deshabilitado y nada se marca ocupado', () => {
    const ctx = context([], { loaded: false })
    expect(dayInfo('2026-11-15', ctx)).toMatchObject({ busy: false, disabled: true })
  })
})

describe('elegir un día', () => {
  const rooms = [room(1, [stay('2026-11-10', '2026-11-13')])]
  it('el primer clic fija la entrada', () => {
    expect(pickDay('2026-11-01', context(rooms))).toEqual({ start: '2026-11-01', end: '' })
  })
  it('el segundo clic posterior fija la salida', () => {
    expect(pickDay('2026-11-05', context(rooms, { start: '2026-11-01' }))).toEqual({ start: '2026-11-01', end: '2026-11-05' })
  })
  it('se puede salir justo cuando empieza otra reserva', () => {
    expect(pickDay('2026-11-10', context(rooms, { start: '2026-11-08' }))).toEqual({ start: '2026-11-08', end: '2026-11-10' })
  })
  it('un día anterior a la entrada reinicia la entrada', () => {
    expect(pickDay('2026-11-01', context(rooms, { start: '2026-11-05' }))).toEqual({ start: '2026-11-01', end: '' })
  })
  it('con el rango completo, un nuevo clic empieza otra selección', () => {
    expect(pickDay('2026-11-20', context(rooms, { start: '2026-11-01', end: '2026-11-04' }))).toEqual({ start: '2026-11-20', end: '' })
  })
  it('no admite días pasados ni noches ocupadas como entrada', () => {
    expect(pickDay('2026-10-26', context(rooms))).toBeNull()
    expect(pickDay('2026-11-11', context(rooms))).toBeNull()
  })
  it('no admite elegir hoy como pasado pero sí como entrada', () => {
    expect(pickDay('2026-10-27', context(rooms))).toEqual({ start: '2026-10-27', end: '' })
  })
  it('una estadía que cruza una noche ocupada no se forma: el día pasa a ser la nueva entrada', () => {
    expect(pickDay('2026-11-14', context(rooms, { start: '2026-11-09' }))).toEqual({ start: '2026-11-14', end: '' })
  })
})

describe('cuadrícula del mes', () => {
  it('la semana empieza en lunes', () => {
    // 1 de noviembre de 2026 es domingo: seis huecos antes.
    expect(monthGrid('2026-11').offset).toBe(6)
    // 1 de marzo de 2027 es lunes: ningún hueco.
    expect(monthGrid('2027-03').offset).toBe(0)
  })
  it('conoce la longitud de cada mes, incluido febrero bisiesto', () => {
    expect(monthGrid('2026-11').days).toHaveLength(30)
    expect(monthGrid('2026-12').days).toHaveLength(31)
    expect(monthGrid('2027-02').days).toHaveLength(28)
    expect(monthGrid('2028-02').days).toHaveLength(29)
  })
  it('devuelve las fechas completas del mes en orden', () => {
    const { days } = monthGrid('2026-11')
    expect(days[0]).toBe('2026-11-01')
    expect(days[29]).toBe('2026-11-30')
  })
  it('navega entre meses y cruza el año', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2027-01', -1)).toBe('2026-12')
    expect(shiftMonth('2026-10', 3)).toBe('2027-01')
  })
  it('cuenta los meses desde hoy', () => {
    expect(monthsFromNow('2026-10', '2026-10-27')).toBe(0)
    expect(monthsFromNow('2026-09', '2026-10-27')).toBe(-1)
    expect(monthsFromNow('2027-09', '2026-10-27')).toBe(11)
  })
})
