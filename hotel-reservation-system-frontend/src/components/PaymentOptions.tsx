import { useLoad } from '../useLoad'
import { Loading } from '../ui/Loading'
import { CreditCardIcon, ShieldIcon } from '../ui/Icons'

export interface PaymentChoice { paymentMethodId: string | null; saveMethod: boolean }
export interface SavedMethod { id: string; brand: string; lastFour: string; expiryMonth: number; expiryYear: number; expired: boolean }

/** Tarjeta seleccionable: el control nativo sigue siendo el control; el borde solo lo acompaña. */
const option = (selected: boolean, disabled = false) =>
  'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-[border-color,background-color,box-shadow] duration-160 ease-out-strong '
  + (disabled ? 'cursor-not-allowed border-ink-200 bg-ink-25 opacity-60'
    : selected ? 'border-brand-500 bg-brand-50/70 shadow-card'
    : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50')

/**
 * Elección del método de pago antes de ir al checkout. El consentimiento para guardar
 * la tarjeta es una casilla aparte, nunca marcada de antemano.
 */
export default function PaymentOptions({ value, onChange }: { value: PaymentChoice; onChange(value: PaymentChoice): void }) {
  const methods = useLoad<SavedMethod[]>('/payment-methods')
  return <fieldset className="min-w-0">
    <legend className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
      <CreditCardIcon className="h-4 w-4" />Método de pago de pruebas
    </legend>

    <div className="mt-2.5 space-y-2">
      {methods.loading && <Loading label="Consultando métodos autorizados…" />}
      {methods.error && <p role="alert" className="rounded-xl border border-warning-200 bg-warning-50 p-3.5 text-sm text-warning-700">
        {methods.error}. Puedes continuar con una tarjeta nueva.
      </p>}

      {methods.data?.map(method => <label key={method.id} className={option(value.paymentMethodId === method.id, method.expired)}>
        <input type="radio" name="payment-method" className="radio mt-0.5" disabled={method.expired}
          checked={value.paymentMethodId === method.id}
          onChange={() => onChange({ paymentMethodId: method.id, saveMethod: false })} />
        <span className="min-w-0 flex-1 text-sm font-medium text-ink-800">
          {method.brand} •••• {method.lastFour} · {method.expiryMonth}/{method.expiryYear}{method.expired ? ' (vencida: utiliza una nueva)' : ''}
        </span>
      </label>)}

      {!methods.loading && !methods.data?.length && <p className="rounded-xl border border-dashed border-ink-300 px-4 py-3 text-xs leading-relaxed text-ink-500">
        No tienes un método autorizado guardado. Puedes completar el primer checkout.
      </p>}

      <label className={option(value.paymentMethodId === null)}>
        <input type="radio" name="payment-method" className="radio mt-0.5" checked={value.paymentMethodId === null}
          onChange={() => onChange({ paymentMethodId: null, saveMethod: false })} />
        <span className="min-w-0 flex-1 text-sm font-medium text-ink-800">Usar una tarjeta nueva</span>
      </label>
    </div>

    {value.paymentMethodId === null && <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-ink-25 p-3.5">
      <input type="checkbox" className="checkbox mt-0.5" checked={value.saveMethod}
        onChange={e => onChange({ paymentMethodId: null, saveMethod: e.target.checked })} />
      <span className="text-xs leading-relaxed text-ink-600">
        Autorizo guardar este método en Stripe para mis próximas reservas, solo cuando yo confirme cada compra.
        Puedo retirarlo desde Mis reservas. No autorizo cobros automáticos.
      </span>
    </label>}

    {value.paymentMethodId !== null && <p className="mt-2 flex items-start gap-2 rounded-xl border border-ink-200 bg-ink-25 p-3.5 text-xs leading-relaxed text-ink-600">
      <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
      Usarás tus datos autorizados sin volver a escribir la tarjeta. El banco puede solicitar autenticación adicional.
    </p>}
  </fieldset>
}
