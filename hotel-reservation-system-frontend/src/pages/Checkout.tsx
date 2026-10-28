import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { api, message } from '../api'
import { money } from '../types'

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
  return <section className="page max-w-2xl"><h1 className="title">Confirmar reserva y pago</h1>
    <p className="notice-success">Entorno de pruebas Stripe. No se mueve dinero real. Usa únicamente tarjetas de prueba. Las tarjetas se gestionan en Stripe; esta aplicación no recibe su número ni CVV.</p>
    {error && <p role="alert" className="notice-error">{error} <button className="underline" onClick={() => setRetry(value => value + 1)}>Consultar de nuevo</button></p>}
    {!checkout && !error && <p role="status">Consultando checkout…</p>}
    {checkout && <div className="panel mt-5"><p>{checkout.stage === 'PENDING' ? 'Total definitivo a autorizar: ' : 'Total del pedido: '}<strong>{money(checkout.amountCents / 100)}</strong></p>
      <p role="status">{labels[checkout.stage] || checkout.stage}</p>
      {!!checkout.items?.length && <section className="my-5"><h2 className="font-bold text-xl">Habitaciones del pedido</h2><p>Un solo pago. Cada habitación conserva su importe para cancelaciones con devolución parcial.</p><div className="overflow-x-auto"><table className="w-full mt-3 text-left"><thead><tr><th>Habitación</th><th>Huéspedes</th><th>Importe</th><th>Reserva</th><th>Devolución</th></tr></thead><tbody>{checkout.items.map(item => <tr key={item.position}><td>{item.roomNumber} · {item.roomType}</td><td>{item.adults} adultos · {item.children} niños</td><td>{money(item.amountCents / 100)}</td><td>{item.reservationId ? '#' + item.reservationId : 'Pendiente'}</td><td>{{ NONE: 'Sin devolución', PENDING: 'Pendiente de verificar', SUCCEEDED: 'Verificada', FAILED: 'Requiere atención' }[item.refundState] || item.refundState}</td></tr>)}</tbody></table></div></section>}
      {checkout.stage === 'PENDING' && <><p>Retención hasta: {new Date(checkout.expiresAt).toLocaleTimeString('es-PA')}. La autorización puede requerir verificación bancaria.</p>
        <div ref={mount} className="my-5" />
        {checkout.savedMethod && <p>Usarás tu método guardado autorizado sin introducir nuevamente los datos de tarjeta.</p>}
        {checkout.saveMethod && <p>Has autorizado guardar este método para futuras compras que confirmes personalmente. Puedes retirar la autorización desde Mis reservas.</p>}
        <p className="text-sm mb-3">Cancelación por habitación hasta el día de entrada inclusive, con devolución de su importe completo. Las demás habitaciones se conservan; cada devolución se verifica por separado.</p>
        <button className="action" disabled={!ready || busy} onClick={pay}>{busy ? 'Procesando…' : 'Autorizar y pagar'}</button>
        <button className="ml-4 underline" disabled={busy} onClick={cancel}>Cancelar checkout</button></>}
      {checkout.reservationId !== null && <p>Reserva #{checkout.reservationId}. <Link className="underline" to="/my-reservations">Ver mis reservas</Link></p>}
      {['CANCELLED', 'EXPIRED', 'FAILED'].includes(checkout.stage) && <Link className="underline" to="/products">Elegir habitación e iniciar otro checkout</Link>}
      <p className="text-sm mt-4">Puedes conservar esta página para consultar el resultado. Un estado pendiente no confirma la reserva.</p>
    </div>}
  </section>
}
