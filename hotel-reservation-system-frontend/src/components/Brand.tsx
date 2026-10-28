import { Link } from 'react-router-dom'

/** La marca, en un solo sitio: el mismo monograma y la misma palabra en header, footer y fichas. */
export default function Brand({ to, tone = 'light', className = '' }: { to?: string; tone?: 'light' | 'dark'; className?: string }) {
  const content = <>
    <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-[1.05rem] font-bold text-white shadow-card">
      MN
    </span>
    <span className="flex flex-col leading-none">
      <span className={'text-[0.95rem] font-bold tracking-[0.18em] ' + (tone === 'light' ? 'text-white' : 'text-ink-900')}>HOTEL MN</span>
      <span className={'mt-1 text-[0.6875rem] tracking-wide ' + (tone === 'light' ? 'text-ink-400' : 'text-ink-500')}>Reservas de estadía</span>
    </span>
  </>
  const shell = 'inline-flex items-center gap-2.5 rounded-xl transition-opacity duration-160 hover:opacity-90 ' + className
  return to ? <Link to={to} className={shell} aria-label="HOTEL MN · ir al inicio">{content}</Link> : <span className={shell}>{content}</span>
}
