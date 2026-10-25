import { Link } from 'react-router-dom'
import type { Hotel } from '../types'
import { useLoad } from '../useLoad'
export default function HotelCatalog({ query = '' }: { query?: string }) {
  const { data, loading, error } = useLoad<Hotel[]>('/hotels?q=' + encodeURIComponent(query))
  if (loading) return <p role="status">Cargando hoteles…</p>
  if (error) return <p role="alert" className="notice-error">{error}</p>
  if (!data?.length) return <p className="panel">No encontramos hoteles para esta búsqueda.</p>
  return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{data.map(hotel => <article key={hotel.id} className="bg-white rounded-xl shadow overflow-hidden border">
    <div className="h-32 bg-gradient-to-br from-orange-100 to-orange-300 flex items-center justify-center text-orange-700 text-5xl" aria-hidden="true">▥</div>
    <div className="p-5"><p className="text-orange-700 text-sm">{hotel.location}</p><h2 className="text-xl font-bold my-2">{hotel.name}</h2><p className="text-gray-600 mb-3">{hotel.description}</p>{hotel.rating !== null && <p>Calificación: {hotel.rating}/5</p>}
      <Link className="action inline-block mt-4" to={'/productDetail?id=' + hotel.id}>Ver habitaciones</Link>
    </div></article>)}</div>
}
