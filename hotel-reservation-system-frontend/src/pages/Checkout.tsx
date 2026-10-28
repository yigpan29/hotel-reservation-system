import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { api, message } from '../api'
import { money } from '../types'
import Badge, { type BadgeTone } from '../ui/Badge'
import Button from '../ui/Button'
import { buttonClass } from '../ui/button-class'
import { Loading } from '../ui/Loading'
import Notice from '../ui/Notice'
import { ArrowRightIcon, ClockIcon, ShieldIcon } from '../ui/Icons'

interface CheckoutView {
  id: string; stage: string; paymentStatus: string; amountCents: number
  expiresAt: string; reservationId: number | null; clientSecret: string | null
  savedMethod: boolean; saveMethod: boolean
  items?: { position: number; roomNumber: string; roomType: string; adults: number; children: number; amountCents: number; reservationId: number | null; refundState: string }[]
}
export default function Checkout() {
  const { id } = useParams(), mount = useRef<HTMLDivElement>(null)
  const stripe = useRef<Stripe | null>(null), elements = useRef<StripeElements | null>(null)
  const [checkout, setCheckout] = useState<CheckoutView | null>(null)
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    window.history.replaceState(window.history.state, '', window.location.pathname)
    let active = true, timer: ReturnType<typeof setTimeout> | undefined
    async function sync() {
      try {
        const view = await api<CheckoutView>('/checkouts/' + id + '/sync', { method: 'POST' })
        if (!active) return
        setCheckout(view); setError('')
        if (['PENDING', 'FINALIZING', 'CANCEL_REQUESTED', 'REFUND_PENDING'].includes(view.stage) || view.items?.some(item => item.refundState === 'PENDING')) timer = setTimeout(sync, 4000)
      } catch (e) { if (active) setError(message(e)) }
    }
    void sync()
    return () => { active = false; clearTimeout(timer) }
  }, [id, retry])
  const secret = checkout?.stage === 'PENDING' ? checkout.clientSecret : null
  useEffect(() => {
    if (!secret) return
    let active = true
    let unmount: (() => void) | undefined
    async function setup() {
      try {
        const config = await api<{ publishableKey: string }>('/checkouts/config')
        const client = await loadStripe(config.publishableKey)
        if (!active || !client) return
        stripe.current = client
        if (checkout?.savedMethod) { setReady(true); return }
        if (!mount.current) return
        const form = client.elements({ clientSecret: secret as string, locale: 'es' })
        const payment = form.create('payment')
        payment.on('ready', () => { if (active) setReady(true) })
        payment.on('loaderror', () => { if (active) setError('No se pudo cargar el formulario seguro de Stripe.') })
        payment.mount(mount.current)
        stripe.current = client; elements.current = form
        unmount = () => payment.destroy()
      } catch (e) { if (active) setError(message(e)) }
    }
    setReady(false); void setup()
    return () => { active = false; unmount?.(); stripe.current = null; elements.current = null }
  }, [secret, checkout?.savedMethod])
  async function pay() {
    if (!stripe.current || (!checkout?.savedMethod && !elements.current) || !secret) return
    setBusy(true); setError('')
    try {
      const returnUrl = window.location.origin + '/checkout/' + id
      const result = checkout?.savedMethod
        ? await stripe.current.confirmCardPayment(secret, { return_url: returnUrl })
        : await stripe.current.confirmPayment({ elements: elements.current as StripeElements,
          confirmParams: { return_url: returnUrl, ...(checkout?.saveMethod ? { payment_method_data: { allow_redisplay: 'always' as const } } : {}) }, redirect: 'if_required' })
      if (result.error) setError(result.error.message || 'El pago no pudo autorizarse.')
      setRetry(value => value + 1)
    } catch { setError('No se pudo consultar el pago. Comprueba su estado antes de iniciar otro checkout.') }
    finally { setBusy(false) }
  }
  async function cancel() {
    setBusy(true); setError('')
    try { setCheckout(await api<CheckoutView>('/checkouts/' + id + '/cancel', { method: 'POST' })) }
    catch (e) { setError(message(e)) }
    finally { setBusy(false) }
  }
  const labels: Record<string, string> = { PENDING: 'Pendiente de pago', FINALIZING: 'Verificando el cobro',
    SUCCEEDED: 'Pago de prueba completado', CANCEL_REQUESTED: 'Cancelación en proceso', CANCELLED: 'Checkout cancelado',
    EXPIRED: 'Tiempo de reserva agotado', FAILED: 'Pago fallido', REFUND_PENDING: 'Reembolso en proceso',
    REFUNDED: 'Reembolso completado', REFUND_FAILED: 'El reembolso requiere atención del responsable' }
  // El tono acompaña a la etiqueta; el texto sigue siendo el que lo dice todo.
  const tones: Record<string, BadgeTone> = { PENDING: 'warning', FINALIZING: 'info', SUCCEEDED: 'success',
    CANCEL_REQUESTED: 'warning', CANCELLED: 'neutral', EXPIRED: 'neutral', FAILED: 'danger',
    REFUND_PENDING: 'info', REFUNDED: 'neutral', REFUND_FAILED: 'danger' }
  const refunds: Record<string, string> = { NONE: 'Sin devolución', PENDING: 'Pendiente de verificar', SUCCEEDED: 'Verificada', FAILED: 'Requiere atención' }
  const closed = checkout !== null && ['CANCELLED', 'EXPIRED', 'FAILED'].includes(checkout.stage)

  return <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
    <nav aria-label="Ruta" className="mb-5 flex items-center gap-2 text-sm text-ink-500">
      <Link to="/my-reservations" className="rounded transition-colors duration-160 hover:text-ink-800">Mis reservas</Link>
      <span aria-hidden="true">/</span>
      <span className="font-medium text-ink-700">Checkout</span>
    </nav>

    <h1 className="title">Confirmar reserva y pago</h1>

    <Notice tone="info" className="mt-6">
      Entorno de pruebas Stripe. No se mueve dinero real. Usa únicamente tarjetas de prueba. Las tarjetas se gestionan
      en Stripe; esta aplicación no recibe su número ni CVV.
    </Notice>

    {error && <Notice tone="error" role="alert" className="mt-5">
      <p>{error}</p>
      <button type="button" className="link mt-2 inline-block" onClick={() => setRetry(value => value + 1)}>Consultar de nuevo</button>
    </Notice>}

    {!checkout && !error && <Loading label="Consultando checkout…" className="mt-6" />}

    {checkout && <div className="mt-6 space-y-5">
      <div className="panel">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div>
            <p className="text-sm text-ink-500">{checkout.stage === 'PENDING' ? 'Total definitivo a autorizar' : 'Total del pedido'}</p>
            <p className="mt-1 text-3xl font-bold text-ink-900 tabular">{money(checkout.amountCents / 100)}</p>
          </div>
          <Badge role="status" tone={tones[checkout.stage] ?? 'neutral'} dot className="px-3 py-1 text-[0.8125rem]">
            {labels[checkout.stage] || checkout.stage}
          </Badge>
        </div>

        {checkout.stage === 'PENDING' && <div className="mt-5 border-t border-ink-100 pt-5">
          <p className="flex items-start gap-2 text-sm text-ink-600">
            <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            Retención hasta las {new Date(checkout.expiresAt).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })} · La autorización puede requerir verificación bancaria.
          </p>

          {/* Stripe monta aquí su formulario seguro; el contenedor no debe cambiar de sitio. */}
          <div ref={mount} className="my-5" />

          {checkout.savedMethod && <p className="flex items-start gap-2 rounded-xl border border-ink-200 bg-ink-25 p-3.5 text-sm text-ink-600">
            <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            Usarás tu método guardado autorizado sin introducir nuevamente los datos de tarjeta.
          </p>}
          {checkout.saveMethod && <p className="mt-3 flex items-start gap-2 rounded-xl border border-ink-200 bg-ink-25 p-3.5 text-sm text-ink-600">
            <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            Has autorizado guardar este método para futuras compras que confirmes personalmente. Puedes retirar la autorización desde Mis reservas.
          </p>}

          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            Cancelación por habitación hasta el día de entrada inclusive, con devolución de su importe completo.
            Las demás habitaciones se conservan; cada devolución se verifica por separado.
          </p>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" disabled={busy} onClick={cancel} className="sm:w-auto" full>Cancelar checkout</Button>
            <Button size="lg" disabled={!ready || busy} loading={busy} onClick={pay} className="sm:w-auto" full>
              {busy ? 'Procesando…' : 'Autorizar y pagar'}
            </Button>
          </div>
        </div>}
      </div>

      {!!checkout.items?.length && <section className="panel" aria-labelledby="order-rooms">
        <h2 id="order-rooms" className="text-base font-semibold text-ink-900">Habitaciones del pedido</h2>
        <p className="mt-1.5 text-sm text-ink-500">Un solo pago. Cada habitación conserva su importe para cancelaciones con devolución parcial.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Habitaciones incluidas en este checkout</caption>
            <thead><tr><th>Habitación</th><th>Huéspedes</th><th>Importe</th><th>Reserva</th><th>Devolución</th></tr></thead>
            <tbody>{checkout.items.map(item => <tr key={item.position}>
              <td className="whitespace-nowrap font-medium text-ink-800">{item.roomNumber} · {item.roomType}</td>
              <td className="whitespace-nowrap">{item.adults} adultos · {item.children} niños</td>
              <td className="whitespace-nowrap">{money(item.amountCents / 100)}</td>
              <td className="whitespace-nowrap">{item.reservationId ? '#' + item.reservationId : 'Pendiente'}</td>
              <td className="whitespace-nowrap">{refunds[item.refundState] || item.refundState}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>}

      {checkout.reservationId !== null && <div className="panel flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-800">Reserva #{checkout.reservationId}. Ya está disponible en tu cuenta.</p>
        <Link className={buttonClass('secondary', 'sm')} to="/my-reservations">Ver mis reservas<ArrowRightIcon className="h-4 w-4" /></Link>
      </div>}

      {closed && <div className="panel flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">Este checkout ya no admite pago.</p>
        <Link className={buttonClass('primary', 'sm')} to="/products">Elegir habitación e iniciar otro checkout<ArrowRightIcon className="h-4 w-4" /></Link>
      </div>}

      <p className="px-1 text-xs leading-relaxed text-ink-400">
        Puedes conservar esta página para consultar el resultado. Un estado pendiente no confirma la reserva.
      </p>
    </div>}
  </section>
}
