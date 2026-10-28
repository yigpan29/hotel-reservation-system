import './index.css'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import AuthProvider from './AuthProvider'
import { useAuth } from './auth-context'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Rooms from './pages/Rooms'
import RoomDetails from './pages/RoomDetails'
import About from './pages/About'
import Auth from './pages/Auth'
import MyReservations from './pages/MyReservations'
import AdminPanel from './pages/AdminPanel'
import Checkout from './pages/Checkout'
import { buttonClass } from './ui/button-class'
import { Loading } from './ui/Loading'
import Notice from './ui/Notice'
import { ShieldIcon } from './ui/Icons'

/** Pantalla breve y con salida: nunca un callejón sin botón. */
function Blocked({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) {
  return <section className="page">
    <div className="panel mx-auto flex max-w-lg flex-col items-center gap-3 py-12 text-center">
      <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ShieldIcon className="h-6 w-6" /></span>
      <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-500">{children}</p>
      <div className="mt-2">{action}</div>
    </div>
  </section>
}

function Guard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading, error } = useAuth(), location = useLocation()
  if (loading) return <div className="page"><Loading label="Cargando sesión…" /></div>
  if (error) return <div className="page"><Notice tone="error" role="alert" title="No se pudo verificar la sesión">{error}</Notice></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (admin && user.role !== 'ADMIN') return <Blocked title="Acceso denegado"
    action={<Link to="/" className={buttonClass('secondary')}>Volver al inicio</Link>}>
    Esta sección es exclusiva de administradores.
  </Blocked>
  return children
}

export default function App() {
  return <BrowserRouter>
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-ink-50">
        <Header />
        <main id="MainContent" className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Rooms />} />
            <Route path="/productDetail" element={<RoomDetails />} />
            <Route path="/hotels/:id" element={<RoomDetails />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth register />} />
            <Route path="/my-reservations" element={<Guard><MyReservations /></Guard>} />
            <Route path="/admin" element={<Guard admin><AdminPanel /></Guard>} />
            <Route path="/checkout/:id" element={<Guard><Checkout /></Guard>} />
            <Route path="*" element={<Blocked title="Página no encontrada"
              action={<Link to="/products" className={buttonClass('primary')}>Explorar hoteles</Link>}>
              La dirección que abriste no existe o la reserva que buscabas ya no está disponible.
            </Blocked>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  </BrowserRouter>
}
