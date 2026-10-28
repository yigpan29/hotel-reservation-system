import { CalendarIcon, CheckCircleIcon, UsersIcon } from '../ui/Icons'

const steps = [
  { Glyph: CalendarIcon, title: 'Elige tus fechas', text: 'El calendario marca cada noche libre y cada noche ocupada del hotel que estás viendo.' },
  { Glyph: UsersIcon, title: 'Arma tus habitaciones', text: 'Indica cuántos adultos y niños van en cada habitación y elige el tipo que los admite.' },
  { Glyph: CheckCircleIcon, title: 'Confirma la estadía', text: 'Revisa el resumen con el precio total y confirma. Los datos de cada huésped se registran en el check-in.' },
]

/** Los tres pasos del flujo, en el mismo orden en el que la interfaz los pide. */
export default function HowItWorks() {
  return <section aria-labelledby="como-funciona" className="mx-auto max-w-page px-4 pt-12 sm:px-6 lg:px-8">
    <h2 id="como-funciona" className="section-title">Reservar toma tres pasos</h2>
    <ol className="stagger mt-6 grid gap-5 md:grid-cols-3">
      {steps.map(({ Glyph, title, text }, index) => <li key={title} className="panel flex flex-col gap-3">
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Glyph className="h-5 w-5" /></span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Paso {index + 1}</span>
        </span>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        <p className="text-sm leading-relaxed text-ink-500">{text}</p>
      </li>)}
    </ol>
  </section>
}
