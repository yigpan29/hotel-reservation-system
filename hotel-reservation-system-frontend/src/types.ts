export interface User { id: number; username: string; email: string; role: 'USER' | 'ADMIN' }
export interface Hotel { id: number; name: string; location: string; description: string; rating: number | null; active: boolean }
export type HotelInput = Omit<Hotel, 'id'>
export interface Room { id: number; hotelId: number; hotelName: string; roomNumber: string; type: string; pricePerNight: number; active: boolean; available: boolean | null; totalPrice: number | null }
export type RoomInput = Pick<Room, 'hotelId' | 'roomNumber' | 'type' | 'pricePerNight' | 'active'>
export interface Reservation { id: number; hotelId: number; hotelName: string; roomId: number; roomNumber: string; userId: number; username: string; startDate: string | null; endDate: string | null; status: string; nightlyPrice: number | null; totalPrice: number | null; createdAt: string; cancelledAt: string | null }
export interface Page<T> { content: T[]; number: number; totalPages: number; totalElements: number }
export const money = (value: number | null) => value === null ? 'No registrado (legacy)' : new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(value)
export const dateAfter = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') }
