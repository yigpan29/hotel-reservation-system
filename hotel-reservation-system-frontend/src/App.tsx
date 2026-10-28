import './index.css'
import './App.css'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
function Guard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading, error } = useAuth(), location = useLocation()
  if (loading) return <p className="page" role="status">Cargando sesión…</p>
  if (error) return <p className="page notice-error" role="alert">{error}</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (admin && user.role !== 'ADMIN') return <section className="page"><h1 className="title">Acceso denegado</h1><p>Esta sección es exclusiva de administradores.</p></section>
  return children
}
export default function App() { return <BrowserRouter><AuthProvider><Header /><main id="MainContent" className="min-h-[70vh]"><Routes>
  <Route path="/" element={<Home />} /><Route path="/products" element={<Rooms />} /><Route path="/productDetail" element={<RoomDetails />} /><Route path="/hotels/:id" element={<RoomDetails />} /><Route path="/about" element={<About />} />
  <Route path="/login" element={<Auth />} /><Route path="/register" element={<Auth register />} /><Route path="/my-reservations" element={<Guard><MyReservations /></Guard>} /><Route path="/admin" element={<Guard admin><AdminPanel /></Guard>} />
  <Route path="*" element={<section className="page"><h1 className="title">Página no encontrada</h1></section>} />
  <Route path="/checkout/:id" element={<Guard><Checkout /></Guard>} />
</Routes></main><Footer /></AuthProvider></BrowserRouter> }
