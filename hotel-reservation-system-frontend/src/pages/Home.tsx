import Hero from '../components/Hero'
import HowItWorks from '../components/HowItWorks'
import HotelCatalog from '../components/HotelCatalog'

export default function Home() {
  return <>
    <Hero />
    <HowItWorks />
    <section aria-labelledby="catalogo" className="page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="catalogo" className="title">Nuestros hoteles</h2>
          <p className="subtitle">Cada hotel muestra sus habitaciones y la disponibilidad de las fechas que elijas.</p>
        </div>
      </div>
      <div className="mt-8"><HotelCatalog /></div>
    </section>
  </>
}
