import { useSearchParams } from 'react-router-dom'
import Search from '../components/Search'
import HotelCatalog from '../components/HotelCatalog'

export default function Rooms() {
  const [params] = useSearchParams(), query = params.get('q') || ''
  return <section className="page">
    <h1 className="title">Encuentra tu hotel</h1>
    <p className="subtitle">Busca por ciudad o por nombre y entra al hotel para ver sus habitaciones libres.</p>
    <div className="mt-7"><Search /></div>
    <h2 className="section-title mt-10">
      {query ? 'Resultados para “' + query + '”' : 'Todos los hoteles'}
    </h2>
    <div className="mt-6"><HotelCatalog query={query} /></div>
  </section>
}
