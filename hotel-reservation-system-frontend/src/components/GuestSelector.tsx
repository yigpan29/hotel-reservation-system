import { canChange, changeGuests, guestLabel, guestsLabel, maxAdults, maxChildren, minAdults, totalGuests, type Guests } from '../guests'
import { MinusIcon, PlusIcon, UsersIcon } from '../ui/Icons'

const counters: { field: keyof Guests; name: string; one: string; hint: string }[] = [
  { field: 'adults', name: 'Adultos', one: 'adulto', hint: 'Mínimo ' + minAdults + ', máximo ' + maxAdults },
  { field: 'children', name: 'Niños', one: 'niño', hint: 'Hasta ' + maxChildren + ', sin datos personales' },
]

const stepClass =
  'grid h-10 w-10 place-items-center rounded-full text-ink-700 transition-[background-color,color,transform] duration-160 ease-out-strong'
  + ' hover:bg-brand-50 hover:text-brand-700 active:scale-[0.92] disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:active:scale-100'

const step = (field: keyof Guests, one: string, amount: number, guests: Guests, onChange: (guests: Guests) => void, where: string) =>
  <button type="button" aria-label={(amount < 0 ? 'Quitar un ' : 'Agregar un ') + one + where} disabled={!canChange(guests, field, amount)}
    className={stepClass} onClick={() => onChange(changeGuests(guests, field, amount))}>
    {amount < 0 ? <MinusIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
  </button>

/** Controles (+) y (−) de huéspedes. No pide datos personales: se registran en el check-in. */
export default function GuestSelector({ guests, onChange, name = '', hints = true }: { guests: Guests; onChange: (guests: Guests) => void; name?: string; hints?: boolean }) {
  const where = name ? ' de ' + name : ''
  return <div role="group" aria-label={'Huéspedes' + where} className="flex flex-wrap items-start gap-x-8 gap-y-5">
    {counters.map(({ field, name: label, one, hint }) => <div key={field} className="min-w-[8.5rem]">
      <span className="label">{label}</span>
      <div className="mt-1.5 inline-flex items-center gap-0.5 rounded-full border border-ink-200 bg-white p-1 shadow-card">
        {step(field, one, -1, guests, onChange, where)}
        <output className="w-8 text-center text-base font-semibold text-ink-900 tabular">{guests[field]}</output>
        {step(field, one, 1, guests, onChange, where)}
      </div>
      {hints && <span className="hint mt-2">{hint}</span>}
    </div>)}
    <p role="status" className="chip mt-7 bg-brand-50 text-brand-800">
      <UsersIcon className="h-3.5 w-3.5" />{guestLabel(guests)} · {guestsLabel(totalGuests(guests))}
    </p>
  </div>
}
