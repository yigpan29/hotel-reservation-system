import { Link } from 'react-router-dom'
import Search from './Search'
export default function Hero() {
  return <section className="bg-[url(https://www.onvacation.com/portals/1080/img/about-us/mision.png)] bg-cover bg-center">
    <div className="bg-black/75 px-4 py-16 md:py-24"><div className="max-w-5xl mx-auto">
      <p className="text-orange-300 uppercase tracking-widest mb-3">Tu próximo descanso</p>
      <h1 className="text-5xl md:text-7xl text-orange-500 font-bold">HOTEL FROM DREAMS</h1>
      <p className="text-gray-200 my-6">Encuentra un hotel, consulta sus habitaciones y reserva tus fechas.</p>
      <Search /><Link to="/products" className="inline-block text-orange-200 underline mt-6">Explorar hoteles</Link>
    </div></div>
  </section>
}
