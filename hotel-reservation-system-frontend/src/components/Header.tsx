import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth-context'
import { message } from '../api'
export default function Header() {
  const { user, logout, loading } = useAuth(), navigate = useNavigate()
  const [open, setOpen] = useState(false), [error, setError] = useState('')
  async function exit() { try { await logout(); setOpen(false); navigate('/') } catch (error) { setError(message(error)) } }
  return <header id="top" className="bg-gray-950 text-white sticky top-0 z-20 shadow">
    <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
      <Link to="/" className="font-bold text-orange-500 text-xl">▥ HOTEL MN</Link>
      <button className="md:hidden border rounded px-3 py-1" aria-expanded={open} onClick={() => setOpen(!open)}>Menú</button>
      <nav aria-label="Principal" className={(open ? 'flex' : 'hidden') + ' md:flex flex-wrap items-center gap-4 w-full md:w-auto'}>
        <Link to="/" onClick={() => setOpen(false)}>Inicio</Link><Link to="/products" onClick={() => setOpen(false)}>Hoteles</Link><Link to="/about" onClick={() => setOpen(false)}>Nosotros</Link>
        {user && <Link to="/my-reservations" onClick={() => setOpen(false)}>Mis reservas</Link>}
        {user?.role === 'ADMIN' && <Link to="/admin" onClick={() => setOpen(false)}>Administración</Link>}
        {!loading && (user ? <><span className="text-orange-300">{user.username}</span><button onClick={exit} className="border border-orange-500 rounded px-3 py-1">Cerrar sesión</button></> : <><Link to="/login">Iniciar sesión</Link><Link className="bg-orange-600 rounded px-3 py-2" to="/register">Registrarse</Link></>)}
      </nav>
    </div>{error && <p role="alert" className="p-2 text-red-300">{error}</p>}
  </header>
}
