import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../ui/Button'
import { SearchIcon } from '../ui/Icons'

/** Buscador de hoteles. Una sola caja, una sola acción: el resto son filtros del catálogo. */
export default function Search({ className = '' }: { className?: string }) {
  const navigate = useNavigate(), [params] = useSearchParams()
  return <form aria-label="Buscar hoteles"
    className={'rounded-2xl border border-ink-200/70 bg-white p-3 shadow-lift sm:p-3.5 ' + className}
    onSubmit={event => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      navigate('/products?q=' + encodeURIComponent(String(form.get('q') || '')))
    }}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1">
        <span className="label">Destino o nombre</span>
        <span className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 transition-[border-color,box-shadow] duration-160 ease-out-strong focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 hover:border-ink-400">
          <SearchIcon className="h-5 w-5 text-ink-400" />
          <input key={params.get('q') || ''} name="q" defaultValue={params.get('q') || ''} maxLength={100}
            placeholder="¿Dónde quieres hospedarte?"
            className="w-full min-w-0 bg-transparent text-ink-900 outline-none placeholder:text-ink-400" />
        </span>
      </label>
      <Button type="submit" size="lg" className="sm:w-auto" full>Buscar hoteles</Button>
    </div>
  </form>
}
