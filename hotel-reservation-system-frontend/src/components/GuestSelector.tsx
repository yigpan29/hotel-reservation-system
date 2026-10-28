import { canChange, changeGuests, guestLabel, guestsLabel, maxAdults, maxChildren, minAdults, totalGuests, type Guests } from '../guests'

const counters: { field: keyof Guests; name: string; one: string; hint: string }[] = [
  { field: 'adults', name: 'Adultos', one: 'adulto', hint: 'Mínimo ' + minAdults + ', máximo ' + maxAdults },
  { field: 'children', name: 'Niños', one: 'niño', hint: 'Hasta ' + maxChildren + ', sin datos personales' },
]
const step = (field: keyof Guests, one: string, amount: number, guests: Guests, onChange: (guests: Guests) => void) =>
  <button type="button" aria-label={(amount < 0 ? 'Quitar un ' : 'Agregar un ') + one} disabled={!canChange(guests, field, amount)}
    className="rounded bg-orange-100 text-orange-700 w-9 h-9 text-lg font-bold hover:bg-orange-200 disabled:opacity-40 disabled:cursor-not-allowed"
    onClick={() => onChange(changeGuests(guests, field, amount))}>{amount < 0 ? '−' : '+'}</button>

/** Controles (+) y (−) de huéspedes. No pide datos personales: se registran en el check-in. */
export default function GuestSelector({ guests, onChange }: { guests: Guests; onChange: (guests: Guests) => void }) {
  return <div role="group" aria-label="Huéspedes" className="flex flex-wrap items-end gap-6">
    {counters.map(({ field, name, one, hint }) => <div key={field}>
      <span className="block text-sm text-gray-600">{name}</span>
      <div className="flex items-center gap-2 mt-1">
        {step(field, one, -1, guests, onChange)}
        <output className="w-8 text-center font-bold">{guests[field]}</output>
        {step(field, one, 1, guests, onChange)}
      </div>
      <span className="block text-xs text-gray-500 mt-1">{hint}</span>
    </div>)}
    <p role="status" className="text-gray-700">{guestLabel(guests)} · {guestsLabel(totalGuests(guests))}</p>
  </div>
}
