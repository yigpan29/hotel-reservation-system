import { useLoad } from '../useLoad'

export interface PaymentChoice { paymentMethodId: string | null; saveMethod: boolean }
export interface SavedMethod { id: string; brand: string; lastFour: string; expiryMonth: number; expiryYear: number; expired: boolean }
export default function PaymentOptions({ value, onChange }: { value: PaymentChoice; onChange(value: PaymentChoice): void }) {
  const methods = useLoad<SavedMethod[]>('/payment-methods')
  return <fieldset className="panel mt-4"><legend className="font-bold">Método de pago de pruebas</legend>
    {methods.loading && <p role="status">Consultando métodos autorizados…</p>}
    {methods.error && <p role="alert">{methods.error}. Puedes continuar con una tarjeta nueva.</p>}
    {methods.data?.map(method => <label className="block my-3" key={method.id}>
      <input type="radio" name="payment-method" disabled={method.expired} checked={value.paymentMethodId === method.id}
        onChange={() => onChange({ paymentMethodId: method.id, saveMethod: false })} />
      {' '}{method.brand} •••• {method.lastFour} · {method.expiryMonth}/{method.expiryYear}{method.expired ? ' (vencida: utiliza una nueva)' : ''}
    </label>)}
    {!methods.loading && !methods.data?.length && <p>No tienes un método autorizado guardado. Puedes completar el primer checkout.</p>}
    <label className="block my-3"><input type="radio" name="payment-method" checked={value.paymentMethodId === null}
      onChange={() => onChange({ paymentMethodId: null, saveMethod: false })} /> Usar una tarjeta nueva</label>
    {value.paymentMethodId === null && <label className="block my-3"><input type="checkbox" checked={value.saveMethod}
      onChange={e => onChange({ paymentMethodId: null, saveMethod: e.target.checked })} />
      {' '}Autorizo guardar este método en Stripe para mis próximas reservas, solo cuando yo confirme cada compra. Puedo retirarlo desde Mis reservas. No autorizo cobros automáticos.
    </label>}
    {value.paymentMethodId !== null && <p>Usarás tus datos autorizados sin volver a escribir la tarjeta. El banco puede solicitar autenticación adicional.</p>}
  </fieldset>
}
