import { Link } from 'react-router-dom'
import type { Hotel } from '../types'
import { useLoad } from '../useLoad'
import Badge from '../ui/Badge'
import Notice from '../ui/Notice'
import { SkeletonGrid } from '../ui/Loading'
import { buttonClass } from '../ui/button-class'
import { ArrowRightIcon, BuildingIcon, MapPinIcon, SearchIcon, StarIcon } from '../ui/Icons'

/** Calificación como estrellas llenas más el número: el color nunca es el único dato. */
function Rating({ value }: { value: number }) {
  const filled = Math.round(value)
  return <span className="flex items-center gap-1.5" aria-label={'Calificación ' + value + ' de 5'}>
    <span aria-hidden="true" className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(step => <StarIcon key={step}
        className={'h-3.5 w-3.5 ' + (step <= filled ? 'fill-brand-400 text-brand-500' : 'text-ink-300')} />)}
    </span>
    <span className="text-sm font-semibold text-ink-700 tabular">{value.toFixed(1)}</span>
  </span>
}

export default function HotelCatalog({ query = '' }: { query?: string }) {
  const { data, loading, error } = useLoad<Hotel[]>('/hotels?q=' + encodeURIComponent(query))
  if (loading) return <SkeletonGrid count={3} />
  if (error) return <Notice tone="error" role="alert" title="No se pudo cargar el catálogo">{error}</Notice>
  if (!data?.length) return <div className="panel flex flex-col items-center gap-3 py-12 text-center">
    <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-500"><SearchIcon className="h-6 w-6" /></span>
    <p className="text-lg font-semibold text-ink-900">No encontramos hoteles para esta búsqueda</p>
    <p className="max-w-sm text-sm text-ink-500">Prueba con el nombre del hotel o con otra ciudad. También puedes ver el catálogo completo.</p>
    <Link to="/products" className={buttonClass('secondary', 'md', 'mt-1')}>Ver todos los hoteles</Link>
  </div>

  return <div className="stagger grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {data.map(hotel => <article key={hotel.id} className="card card-hover flex flex-col" data-motion="transform">
      <div aria-hidden="true" className="relative h-40 overflow-hidden bg-gradient-to-br from-brand-100 via-brand-200 to-brand-400">
        <span className="absolute inset-0 grid place-items-center text-brand-800/70"><BuildingIcon className="h-12 w-12" strokeWidth={1.25} /></span>
        <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/55 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-sm text-ink-500">
          <MapPinIcon className="h-4 w-4 text-brand-600" />{hotel.location}
        </p>
        <h3 className="mt-2 text-lg font-semibold leading-snug text-ink-900">{hotel.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500">{hotel.description}</p>
        <div className="mt-4 flex items-center gap-3">
          {hotel.rating !== null ? <Rating value={hotel.rating} /> : <Badge tone="neutral">Sin calificación</Badge>}
        </div>
        <div className="mt-auto pt-5">
          <Link className={buttonClass('primary', 'md', 'w-full')} to={'/productDetail?id=' + hotel.id}>
            Ver habitaciones<ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>)}
  </div>
}
