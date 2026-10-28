import { useState } from 'react'
import { api, message } from '../api'
import { useLoad } from '../useLoad'
import type { SavedMethod } from './PaymentOptions'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { Loading } from '../ui/Loading'
import Notice from '../ui/Notice'
import { CreditCardIcon } from '../ui/Icons'

/** Métodos que el cliente autorizó a reutilizar. Cada uno con su estado y una sola acción. */
export default function SavedMethodsPanel({ className = '' }: { className?: string }) {
  const methods = useLoad<SavedMethod[]>('/payment-methods')
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState('')
  async function revoke(id: string) {
    setBusy(id); setError('')
    try { await api('/payment-methods/' + id + '/revoke', { method: 'POST' }); methods.reload() }
    catch (e) { setError(message(e)) }
    finally { setBusy(null) }
  }
  return <section className={'panel ' + className} aria-labelledby="saved-methods">
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
        <CreditCardIcon className="h-5 w-5" />
      </span>
      <h2 id="saved-methods" className="text-base font-semibold text-ink-900">Mis métodos autorizados</h2>
    </div>
    <p className="mt-3 text-sm leading-relaxed text-ink-500">
      Solo se reutilizan cuando confirmas una compra. Retirar la autorización impide nuevas compras con ese método;
      no cancela operaciones ya iniciadas.
    </p>

    {methods.loading && <Loading label="Consultando métodos…" className="mt-4" />}
    {(error || methods.error) && <Notice tone="error" role="alert" className="mt-4">{error || methods.error}</Notice>}
    {!methods.loading && methods.data?.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-ink-300 px-4 py-5 text-center text-sm text-ink-500">
      No tienes métodos guardados autorizados.
    </p>}

    {!!methods.data?.length && <ul className="mt-4 space-y-3">
      {methods.data.map(method => <li key={method.id} className="rounded-xl border border-ink-200 bg-ink-25 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2.5">
            <span className="rounded-md bg-white px-2 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-700 shadow-card">{method.brand}</span>
            <span className="text-sm font-semibold text-ink-900 tabular">•••• {method.lastFour}</span>
          </span>
          {method.expired && <Badge tone="warning">Vencido</Badge>}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-ink-500 tabular">Vence {String(method.expiryMonth).padStart(2, '0')}/{method.expiryYear}</span>
          <Button variant="ghost" size="sm" className="text-ink-600 hover:bg-danger-50 hover:text-danger-700"
            aria-label={'Retirar autorización de •••• ' + method.lastFour}
            disabled={busy !== null} loading={busy === method.id} onClick={() => revoke(method.id)}>
            {busy === method.id ? 'Retirando…' : 'Retirar autorización'}
          </Button>
        </div>
      </li>)}
    </ul>}
  </section>
}
