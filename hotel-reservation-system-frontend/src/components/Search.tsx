import { useNavigate, useSearchParams } from 'react-router-dom'
export default function Search() {
  const navigate = useNavigate(), [params] = useSearchParams()
  return <form aria-label="Buscar hoteles" className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 text-gray-900" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); navigate('/products?q=' + encodeURIComponent(String(form.get('q') || ''))) }}>
    <label className="flex-1 min-w-48">Destino o nombre<input key={params.get('q') || ''} name="q" defaultValue={params.get('q') || ''} maxLength={100} placeholder="¿Dónde quieres hospedarte?" className="field" /></label>
    <button className="action self-end">Buscar hoteles</button>
  </form>
}
