import { useSearchParams } from 'react-router-dom'
import Search from '../components/Search'
import HotelCatalog from '../components/HotelCatalog'
export default function Rooms() { const [params] = useSearchParams(); return <section className="page"><h1 className="title">Encuentra tu hotel</h1><Search /><div className="mt-8"><HotelCatalog query={params.get('q') || ''} /></div></section> }
