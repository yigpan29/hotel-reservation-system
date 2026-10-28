import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth-context'
import { api, message } from '../api'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Notice from '../ui/Notice'

export default function Auth({ register = false }: { register?: boolean }) {
  const { login } = useAuth(), navigate = useNavigate(), location = useLocation()
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget), username = String(data.get('username')), password = String(data.get('password'))
    setBusy(true); setError('')
    try { if (register) await api('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, email: data.get('email') }) }); await login(username, password); const from: unknown = location.state?.from; navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/my-reservations') } catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  return <section className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
    <div className="text-center">
      <h1 className="text-display-sm font-semibold text-ink-900">{register ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
      <p className="mt-2 text-sm text-ink-500">
        {register ? 'Necesitas una cuenta para confirmar y gestionar tus reservas.' : 'Entra para ver y gestionar tus reservas.'}
      </p>
    </div>
    <form className="panel mt-7 space-y-5" onSubmit={submit}>
      <Field label="Usuario" hint={register ? 'Al menos 3 caracteres. Letras, números, punto, guion o guion bajo.' : undefined}>
        <input autoComplete="username" name="username" required minLength={register ? 3 : 1} maxLength={40}
          pattern={register ? '[a-zA-Z0-9._-]+' : undefined} className="field" />
      </Field>
      {register && <Field label="Email">
        <input type="email" name="email" autoComplete="email" required maxLength={255} className="field" />
      </Field>}
      <Field label="Contraseña" hint={register ? 'Mínimo 8 caracteres.' : undefined}>
        <input type="password" name="password" autoComplete={register ? 'new-password' : 'current-password'}
          required minLength={register ? 8 : 1} maxLength={72} className="field" />
      </Field>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      <Button type="submit" size="lg" full loading={busy}>{busy ? 'Procesando…' : register ? 'Registrarme' : 'Entrar'}</Button>
      <p className="text-center text-sm text-ink-500">
        {register ? '¿Ya tienes cuenta? ' : '¿Aún no tienes cuenta? '}
        <Link className="link" to={register ? '/login' : '/register'} state={location.state}>{register ? 'Iniciar sesión' : 'Registrarse'}</Link>
      </p>
    </form>
  </section>
}
