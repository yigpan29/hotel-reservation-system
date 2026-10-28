import { Link } from 'react-router-dom'
import { ArrowRightIcon, BedIcon, CalendarIcon, ChartIcon, ShieldIcon, SparkleIcon, UsersIcon } from '../ui/Icons'

const pillars = [
  { Glyph: CalendarIcon, title: 'Disponibilidad honesta', text: 'El calendario se construye con la ocupación real de cada habitación: una estadía solo se ofrece si una misma habitación está libre todas sus noches.' },
  { Glyph: UsersIcon, title: 'Huéspedes sin trámites', text: 'Solo necesitamos cuántas personas van en cada habitación. Los datos personales se registran en el check-in, no en la web.' },
  { Glyph: ShieldIcon, title: 'La reserva es tuya', text: 'Confirmas tu estadía en un paso y puedes cancelarla desde tu cuenta mientras no haya comenzado.' },
]

const capabilities = [
  { Glyph: BedIcon, title: 'Catálogo por hotel', text: 'Hoteles, habitaciones y tarifas gestionados desde el panel de administración.' },
  { Glyph: SparkleIcon, title: 'Reserva en grupo', text: 'Varias habitaciones en una sola operación, con su tipo y sus huéspedes.' },
  { Glyph: ChartIcon, title: 'Previsión de demanda', text: 'Análisis informativo de noches reservadas para el equipo del hotel.' },
]

export default function AboutUs() {
  return <div className="space-y-12">
    <section className="relative isolate overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 text-white sm:px-10 sm:py-14">
      <div aria-hidden="true" className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-brand-700/25 blur-3xl" />
      <div className="relative max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">Qué es HOTEL MN</p>
        <h2 className="mt-4 text-display-sm font-semibold text-white">Reservar una estadía, sin pasos de más</h2>
        <p className="mt-5 text-base leading-relaxed text-ink-200">
          HOTEL MN es un sistema de reservas que muestra la disponibilidad tal como está: noche por noche y habitación
          por habitación. Eliges fechas, armas tus habitaciones y confirmas. Nada más.
        </p>
        <Link to="/products" className="mt-7 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform,border-color] duration-160 ease-out-strong hover:border-white/35 hover:bg-white/10 active:scale-[0.97]">
          Ver los hoteles<ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>

    <section aria-labelledby="principios">
      <h2 id="principios" className="section-title">Nuestros principios</h2>
      <div className="stagger mt-6 grid gap-5 md:grid-cols-3">
        {pillars.map(({ Glyph, title, text }) => <article key={title} className="panel">
          <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Glyph className="h-5 w-5" /></span>
          <h3 className="mt-4 text-base font-semibold text-ink-900">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{text}</p>
        </article>)}
      </div>
    </section>

    <section aria-labelledby="capacidades">
      <h2 id="capacidades" className="section-title">Qué incluye el sistema</h2>
      <ul className="stagger mt-6 grid gap-5 md:grid-cols-3">
        {capabilities.map(({ Glyph, title, text }) => <li key={title} className="flex gap-4 rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card">
          <span aria-hidden="true" className="mt-0.5 text-brand-600"><Glyph className="h-5 w-5" /></span>
          <div>
            <h3 className="text-base font-semibold text-ink-900">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{text}</p>
          </div>
        </li>)}
      </ul>
    </section>

    <p className="rounded-2xl border border-ink-200/80 bg-ink-25 p-5 text-sm leading-relaxed text-ink-500">
      El inventario de hoteles y habitaciones de esta instalación es de demostración académica: los nombres, las tarifas
      y parte del historial existen para probar el sistema y no corresponden a operaciones comerciales reales.
    </p>
  </div>
}
