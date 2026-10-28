export interface User { id: number; username: string; email: string; role: 'USER' | 'ADMIN' }
export interface Hotel { id: number; name: string; location: string; description: string; rating: number | null; active: boolean }
export type HotelInput = Omit<Hotel, 'id'>
export interface Room { id: number; hotelId: number; hotelName: string; roomNumber: string; type: string; pricePerNight: number; capacity: number; active: boolean; available: boolean | null; totalPrice: number | null }
export type RoomInput = Pick<Room, 'hotelId' | 'roomNumber' | 'type' | 'pricePerNight' | 'active'>
export interface Reservation { id: number; hotelId: number; hotelName: string; roomId: number; roomNumber: string; roomType: string | null; userId: number; username: string; startDate: string; endDate: string; status: string; adults: number | null; children: number | null; nightlyPrice: number | null; totalPrice: number | null; createdAt: string; cancelledAt: string | null }
export interface OccupiedRange { startDate: string; endDate: string }
export interface RoomOccupancy { roomId: number; hotelId: number; hotelName: string; roomNumber: string; type: string; pricePerNight: number | null; active: boolean; from: string; to: string; occupied: OccupiedRange[] }
/** Referencia de habitaciones necesarias e inventario del hotel para unos huespedes y unas fechas. */
export interface Allocation { hotelId: number; startDate: string; endDate: string; nights: number; adults: number; children: number; guests: number; maxRoomCapacity: number; minimumRooms: number; availableRooms: number; availableCapacity: number; feasible: boolean; message: string; rooms: Room[] }
export interface Page<T> { content: T[]; number: number; totalPages: number; totalElements: number }
export const money = (value: number | null) => value === null ? 'No registrado (legacy)' : new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(value)
export const nightsBetween = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 86400000)
export const dateAfter = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') }
