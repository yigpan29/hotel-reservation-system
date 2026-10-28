import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth-context'
import { message } from '../api'
import { buttonClass } from '../ui/button-class'
import Notice from '../ui/Notice'
import { CloseIcon, LogOutIcon, MenuIcon } from '../ui/Icons'
import Brand from './Brand'

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/products', label: 'Hoteles' },
  { to: '/about', label: 'Nosotros' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  'rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color] duration-160 ease-out-strong '
  + (isActive ? 'bg-white/10 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white')

export default function Header() {
  const { user, logout, loading } = useAuth(), navigate = useNavigate(), location = useLocation()
  const [open, setOpen] = useState(false), [error, setError] = useState('')
  const menuId = useId()
  // Navegar cierra el menú móvil: nadie quiere volver a una página con el menú encima.
  useEffect(() => { setOpen(false) }, [location.pathname, location.search])
  async function exit() { try { await logout(); setOpen(false); navigate('/') } catch (failure) { setError(message(failure)) } }

  const session = !loading && (user
    ? <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <span className="flex items-center gap-2.5 rounded-full bg-white/5 py-1 pl-1 pr-3.5 text-sm text-ink-200">
          <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-bold text-white">
            {user.username.slice(0, 2).toUpperCase()}
          </span>
          <span className="max-w-[12ch] truncate font-medium">{user.username}</span>
        </span>
        <button type="button" onClick={exit}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-ink-200 transition-[background-color,color,transform] duration-160 ease-out-strong hover:bg-white/10 hover:text-white active:scale-[0.97]">
          <LogOutIcon className="h-4 w-4" />Cerrar sesión
        </button>
      </div>
    : <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-200 transition-[background-color,color] duration-160 hover:bg-white/5 hover:text-white">Iniciar sesión</Link>
        <Link to="/register" className={buttonClass('primary', 'sm')}>Registrarse</Link>
      </div>)

  return <header id="top" className="sticky top-0 z-30 border-b border-white/10 bg-ink-900/95 text-white backdrop-blur-md">
    <a href="#MainContent" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-900">
      Saltar al contenido
    </a>
    <div className="mx-auto flex max-w-page items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <Brand to="/" />
      <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 md:flex">
        {links.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'} className={linkClass}>{link.label}</NavLink>)}
        {user && <NavLink to="/my-reservations" className={linkClass}>Mis reservas</NavLink>}
        {user?.role === 'ADMIN' && <NavLink to="/admin" className={linkClass}>Administración</NavLink>}
      </nav>
      <div className="ml-auto hidden md:ml-0 md:flex">{session}</div>
      <button type="button" className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium transition-[background-color,transform] duration-160 ease-out-strong hover:bg-white/10 active:scale-[0.97] md:hidden"
        aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}>
        {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}Menú
      </button>
    </div>
    {open && <div id={menuId} className="animate-enter-up border-t border-white/10 px-4 pb-5 pt-3 md:hidden" data-motion="transform">
      <nav aria-label="Principal móvil" className="flex flex-col gap-1">
        {links.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'} className={linkClass}>{link.label}</NavLink>)}
        {user && <NavLink to="/my-reservations" className={linkClass}>Mis reservas</NavLink>}
        {user?.role === 'ADMIN' && <NavLink to="/admin" className={linkClass}>Administración</NavLink>}
      </nav>
      <div className="mt-4 border-t border-white/10 pt-4">{session}</div>
    </div>}
    {error && <div className="mx-auto max-w-page px-4 pb-3 sm:px-6 lg:px-8"><Notice tone="error" role="alert">{error}</Notice></div>}
  </header>
}
