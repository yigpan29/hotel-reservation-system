/** Reglas puras de los huéspedes: sin React ni red, para poder probarlas aisladas. */
export interface Guests { adults: number; children: number }

export const minAdults = 1, maxAdults = 20, maxChildren = 20
/** Una reserva sin adultos no existe: el contador empieza en el mínimo exigido. */
export const defaultGuests: Guests = { adults: 2, children: 0 }

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(Math.floor(value) || low, low), high)
const plural = (count: number, one: string, many: string) => count + ' ' + (count === 1 ? one : many)

export const totalGuests = ({ adults, children }: Guests) => adults + children
/** Los controles (+) y (−) nunca dejan la reserva sin un adulto ni producen cantidades negativas. */
export const changeGuests = (guests: Guests, field: keyof Guests, step: number): Guests => field === 'adults'
  ? { ...guests, adults: clamp(guests.adults + step, minAdults, maxAdults) }
  : { ...guests, children: clamp(guests.children + step, 0, maxChildren) }
export const canChange = (guests: Guests, field: keyof Guests, step: number) => changeGuests(guests, field, step)[field] !== guests[field]

/** Los huéspedes viven en la URL, como las fechas: recargar no pierde lo elegido ni admite valores inválidos. */
export const readGuests = (params: URLSearchParams): Guests => ({
  adults: params.has('adults') ? clamp(Number(params.get('adults')), minAdults, maxAdults) : defaultGuests.adults,
  children: params.has('children') ? clamp(Number(params.get('children')) || 0, 0, maxChildren) : defaultGuests.children,
})

export const adultsLabel = (adults: number) => plural(adults, 'adulto', 'adultos')
export const childrenLabel = (children: number) => plural(children, 'niño', 'niños')
export const guestLabel = (guests: Guests) => adultsLabel(guests.adults) + (guests.children ? ' · ' + childrenLabel(guests.children) : '')
export const roomsLabel = (rooms: number) => plural(rooms, 'habitación', 'habitaciones')
export const guestsLabel = (guests: number) => plural(guests, 'huésped', 'huéspedes')
/** Habitaciones mínimas para unos huéspedes con una capacidad dada; 0 si la capacidad no es utilizable. */
export const minimumRooms = (guests: number, capacity: number) => capacity < 1 ? 0 : Math.ceil(guests / capacity)
