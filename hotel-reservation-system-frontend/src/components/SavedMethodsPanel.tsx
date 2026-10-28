import { useState } from 'react'
import { api, message } from '../api'
import { useLoad } from '../useLoad'
import type { SavedMethod } from './PaymentOptions'

export default function SavedMethodsPanel() {
  const methods = useLoad<SavedMethod[]>('/payment-methods')
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState('')
  async function revoke(id: string) {
    setBusy(id); setError('')
    try { await api('/payment-methods/' + id + '/revoke', { method: 'POST' }); methods.reload() }
    catch (e) { setError(message(e)) }
    finally { setBusy(null) }
  }
  return <section className="panel mt-6"><h2 className="text-xl font-bold">Mis métodos autorizados</h2>
    <p>Solo se reutilizan cuando confirmas una compra. Retirar la autorización impide nuevas compras con ese método; no cancela operaciones ya iniciadas.</p>
    {methods.loading && <p role="status">Consultando métodos…</p>}
    {(error || methods.error) && <p role="alert" className="notice-error">{error || methods.error}</p>}
    {!methods.loading && methods.data?.length === 0 && <p>No tienes métodos guardados autorizados.</p>}
    {methods.data?.map(method => <div className="my-3" key={method.id}>
      <span>{method.brand} •••• {method.lastFour} · {method.expiryMonth}/{method.expiryYear}{method.expired ? ' · Vencido' : ''}</span>
      <button className="underline ml-3" disabled={busy !== null} onClick={() => revoke(method.id)}>{busy === method.id ? 'Retirando…' : 'Retirar autorización de •••• ' + method.lastFour}</button>
    </div>)}
  </section>
}
