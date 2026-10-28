import type { RoomOccupancy } from './types'

/** Reglas puras del calendario de disponibilidad: sin React ni red, para poder probarlas aisladas. */
export const maxNightsPerRange = 400
export const monthsAhead = 11

export const toKey = (date: Date) => date.toISOString().slice(0, 10)
export const addDays = (day: string, amount: number) => { const date = new Date(day + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + amount); return toKey(date) }

/** Noches ocupadas por habitación: la entrada cuenta y la salida no (la noche de salida queda libre). */
export function occupiedNights(occupancy: RoomOccupancy[]): Set<string>[] {
  return occupancy.map(room => {
    const taken = new Set<string>()
    for (const range of room.occupied) {
      let day = range.startDate
      for (let guard = 0; day < range.endDate && guard < maxNightsPerRange; guard++) { taken.add(day); day = addDays(day, 1) }
    }
    return taken
  })
}

export const roomFree = (taken: Set<string>, from: string, to: string) => { for (let day = from; day < to; day = addDays(day, 1)) if (taken.has(day)) return false; return true }
/** Una estadía solo es posible si UNA MISMA habitación está libre durante todas sus noches. */
export const anyRoomFree = (rooms: Set<string>[], from: string, to: string) => rooms.some(taken => roomFree(taken, from, to))

export interface CalendarContext { today: string; start: string; end: string; rooms: Set<string>[]; loaded: boolean }
export interface DayInfo { past: boolean; busy: boolean; reachable: boolean; unreachable: boolean; selected: boolean; inside: boolean; disabled: boolean }

export function dayInfo(day: string, { today, start, end, rooms, loaded }: CalendarContext): DayInfo {
  const choosingEnd = Boolean(start) && !end
  const past = day < today, busy = loaded && !anyRoomFree(rooms, day, addDays(day, 1))
  // Con la entrada elegida, una salida es alcanzable si alguna habitación cubre toda la estadía hasta ese día.
  const reachable = choosingEnd && day > start && loaded && anyRoomFree(rooms, start, day)
  const unreachable = choosingEnd && day > start && loaded && !reachable && !busy
  const selected = day === start || day === end
  const inside = Boolean(start && end) && day > start && day < end
  return { past, busy, reachable, unreachable, selected, inside, disabled: !loaded || unreachable || ((past || busy) && !reachable) }
}

/** Resultado de pulsar un día: salida válida, nueva entrada, o nada si el día no se puede elegir. */
export function pickDay(day: string, { today, start, end, rooms }: CalendarContext): { start: string; end: string } | null {
  if (start && !end && day > start && anyRoomFree(rooms, start, day)) return { start, end: day }
  if (day >= today && anyRoomFree(rooms, day, addDays(day, 1))) return { start: day, end: '' }
  return null
}

/** Cuadrícula de un mes ('YYYY-MM'): huecos iniciales con la semana empezando en lunes, y los días. */
export function monthGrid(cursor: string) {
  const [year, month] = cursor.split('-').map(Number)
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { year, month, offset, days: Array.from({ length: total }, (_, index) => toKey(new Date(Date.UTC(year, month - 1, index + 1)))) }
}
export const shiftMonth = (cursor: string, amount: number) => { const [year, month] = cursor.split('-').map(Number); return toKey(new Date(Date.UTC(year, month - 1 + amount, 1))).slice(0, 7) }
export const monthsFromNow = (cursor: string, today: string) => (Number(cursor.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + (Number(cursor.slice(5, 7)) - Number(today.slice(5, 7)))
