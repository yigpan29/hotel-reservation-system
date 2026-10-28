import { Link } from 'react-router-dom'
import Search from './Search'
import { ArrowRightIcon, BedIcon, ShieldIcon, TicketIcon } from '../ui/Icons'

const promises = [
  { Glyph: BedIcon, text: 'Disponibilidad real, habitación por habitación' },
  { Glyph: ShieldIcon, text: 'Confirmación inmediata de tu estadía' },
  { Glyph: TicketIcon, text: 'Cancela desde tu cuenta cuando lo necesites' },
]

export default function Hero() {
  return <section className="relative isolate overflow-hidden bg-ink-900">
    {/* La fotografía es decorativa: si no carga, el degradado sostiene el mismo contraste. */}
    <div aria-hidden="true" className="absolute inset-0 bg-[url(https://www.onvacation.com/portals/1080/img/about-us/mision.png)] bg-cover bg-center opacity-45" />
    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-900/85 to-brand-900/70" />
    <div aria-hidden="true" className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
    <div aria-hidden="true" className="absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-brand-700/25 blur-3xl" />

    <div className="relative mx-auto max-w-page px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">Tu próximo descanso</p>
        <h1 className="mt-4 text-display-md font-semibold text-white sm:text-display-lg">
          Encuentra el hotel<br className="hidden sm:block" /> perfecto para tus fechas
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-200">
          Busca un hotel, revisa qué habitaciones están libres cada noche y confirma tu estadía en tres pasos.
        </p>
      </div>

      <div className="mt-9 max-w-3xl"><Search /></div>

      <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
        {promises.map(({ Glyph, text }) => <li key={text} className="flex items-center gap-2 text-sm text-ink-200">
          <Glyph className="h-4 w-4 text-brand-300" />{text}
        </li>)}
      </ul>

      <Link to="/products"
        className="mt-9 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform,border-color] duration-160 ease-out-strong hover:border-white/35 hover:bg-white/10 active:scale-[0.97]">
        Explorar todos los hoteles<ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  </section>
}
