import { Link } from 'react-router-dom'
import Brand from './Brand'
import { ArrowRightIcon } from '../ui/Icons'

const groups = [
  { title: 'Explorar', items: [{ to: '/', label: 'Inicio' }, { to: '/products', label: 'Hoteles' }, { to: '/about', label: 'Nosotros' }] },
  { title: 'Tu cuenta', items: [{ to: '/my-reservations', label: 'Mis reservas' }, { to: '/login', label: 'Iniciar sesión' }, { to: '/register', label: 'Crear cuenta' }] },
]

export default function Footer() {
  return <footer className="mt-16 border-t border-white/10 bg-ink-900 text-ink-300">
    <div className="mx-auto grid max-w-page gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
      <div>
        <Brand />
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
          Tu descanso empieza con una reserva. Consulta disponibilidad real, elige tus fechas y confirma en minutos.
        </p>
      </div>
      {groups.map(group => <nav key={group.title} aria-label={group.title}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">{group.title}</h2>
        <ul className="mt-4 space-y-2.5 text-sm">
          {group.items.map(item => <li key={item.to}>
            <Link to={item.to} className="rounded transition-colors duration-160 hover:text-white">{item.label}</Link>
          </li>)}
        </ul>
      </nav>)}
    </div>
    <div className="border-t border-white/10">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-ink-500 sm:px-6 lg:px-8">
        <p>HOTEL MN · Sistema de reservas con inventario de demostración.</p>
        <a href="#top" className="inline-flex items-center gap-1.5 rounded transition-colors duration-160 hover:text-white">
          Volver arriba<ArrowRightIcon className="h-3.5 w-3.5 -rotate-90" />
        </a>
      </div>
    </div>
  </footer>
}
